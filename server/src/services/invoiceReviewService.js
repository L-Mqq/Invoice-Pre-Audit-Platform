const { pool } = require('../config/database')
const invoiceReviewRepository = require('../repositories/invoiceReviewRepository')
const voucherRepository = require('../repositories/voucherRepository')
const weeklyVoucherRequirementRepository = require('../repositories/weeklyVoucherRequirementRepository')
const {
  PRICE_TYPES,
  classifyUnitPrice,
} = require('./priceJudgmentService')

const ALLOWED_RESULTS = new Set(['可以', '存疑', '不可以'])
const QUALIFICATION_ACTIONS = new Set([
  'execute_rules',
  'abandon',
])
const ABANDONABLE_QUALIFICATION_STATUSES = new Set([
  'pending',
  'pending_voucher',
  'pending_manual',
  'rejected',
])

// 创建http错误码
function createHttpError(statusCode, message) {
  const error = new Error(message)
  error.statusCode = statusCode
  error.expose = true
  return error
}
// 把输入解析为正整数，不合法就抛 400
function parsePositiveInteger(value, fieldName) {
  const parsed = Number(value)

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw createHttpError(400, `${fieldName} 无效`)
  }

  return parsed
}
// 校验并规范化审核备注 note
function validateNote(note, action) {
  if (note !== undefined && note !== null && typeof note !== 'string') {
    throw createHttpError(400, 'note 必须是文本')
  }

  const normalizedNote = typeof note === 'string' ? note.trim() : ''

  if (normalizedNote.length > 2000) {
    throw createHttpError(400, 'note 不能超过 2000 个字符')
  }

  if (action === 'abandon' && !normalizedNote) {
    throw createHttpError(400, '放弃当前发票必须填写放弃原因')
  }

  return normalizedNote || null
}
// 根据商品品类结果判断发票是否能通过
function getCategoryDecision(items) {
  if (items.length === 0) {
    return {
      status: 'pending_manual',
      reason: '发票暂无商品明细，无法完成资质审核',
    }
  }

  const rejectedItems = items.filter(
    (item) => item.final_category_result === '不可以',
  )

  if (rejectedItems.length > 0) {
    return {
      status: 'rejected',
      reason: `商品“${rejectedItems[0].item_name}”品类判定为不可以`,
    }
  }

  const unresolvedItems = items.filter(
    (item) => item.final_category_result !== '可以',
  )

  if (unresolvedItems.length > 0) {
    return {
      status: 'pending_manual',
      reason: `商品“${unresolvedItems[0].item_name}”品类仍需人工确认`,
    }
  }

  return null
}
// 根据商品单价判断价格类型
function getPriceDecision(items) {
  const results = items.map((item) => ({
    item,
    result: classifyUnitPrice(item.unit_price),
  }))
  const invalidItem = results.find((entry) => !entry.result.valid)

  if (invalidItem) {
    return {
      status: 'pending_manual',
      reason: `商品“${invalidItem.item.item_name}”单价无效，需人工处理`,
      hasLowValue: false,
    }
  }

  const assetItem = results.find(
    (entry) => entry.result.priceType === PRICE_TYPES.ASSET,
  )

  if (assetItem) {
    return {
      status: 'rejected',
      reason: `商品“${assetItem.item.item_name}”单价达到资产标准，不能走材料费流程`,
      hasLowValue: false,
    }
  }

  return {
    status: null,
    reason: null,
    hasLowValue: results.some(
      (entry) => entry.result.priceType === PRICE_TYPES.LOW_VALUE,
    ),
  }
}
// 金额转「分」做整数运算，避免浮点误差
function amountToCents(value) {
  return Math.round(Number(value || 0) * 100)
}

// 计算累计金额
function sumInvoiceAmountsInCents(invoices) {
  return invoices.reduce(
    (total, invoice) => total + amountToCents(invoice.total_amount),
    0,
  )
}

// 处理累计超过 1000 元时 A/B/C 发票共同补齐支付凭证的任务。
async function resolveWeeklyVoucherRequirement({
  connection,
  invoice,
  cumulativeWeekStart,
  cumulativeAmount,
  persistRequirement,
}) {
  const relatedInvoices = await invoiceReviewRepository.findInvoicesForWeeklyVoucherRequirement({
    connection,
    sellerTaxId: invoice.seller_tax_id,
    cumulativeWeekStart,
    triggerInvoiceId: invoice.id,
    forUpdate: persistRequirement,
  })
  const triggerInvoice = relatedInvoices.find((relatedInvoice) => {
    return Number(relatedInvoice.id) === Number(invoice.id)
  })

  if (!triggerInvoice) {
    throw createHttpError(409, '当前发票未纳入周累计凭证任务范围')
  }

  const evaluatedAt = new Date()
  const relatedInvoiceVouchers = []

  for (const relatedInvoice of relatedInvoices) {
    const approvedVoucherGroup = await voucherRepository.findApprovedCompleteGroup({
      connection,
      invoiceId: relatedInvoice.id,
      forUpdate: persistRequirement,
    })

    relatedInvoiceVouchers.push({
      invoice: relatedInvoice,
      approvedVoucherGroup,
    })
  }

  const allInvoicesHaveApprovedVoucher = relatedInvoiceVouchers.every((entry) => {
    return Boolean(entry.approvedVoucherGroup)
  })

  if (!persistRequirement) {
    return {
      allInvoicesHaveApprovedVoucher,
      relatedInvoiceCount: relatedInvoiceVouchers.length,
      requirement: null,
    }
  }

  const existingRequirement = await weeklyVoucherRequirementRepository.findPendingRequirementForWeek({
    connection,
    sellerTaxId: invoice.seller_tax_id,
    cumulativeWeekStart,
    forUpdate: true,
  })

  if (existingRequirement) {
    throw createHttpError(
      409,
      '同一销售方本自然周已有未完成的凭证补齐任务，请先完成或放弃该任务',
    )
  }

  const requirement = await weeklyVoucherRequirementRepository.createRequirement({
    connection,
    sellerTaxId: invoice.seller_tax_id,
    cumulativeWeekStart,
    triggerInvoiceId: invoice.id,
    triggeredCumulativeAmount: cumulativeAmount,
  })

  for (const entry of relatedInvoiceVouchers) {
    const completedAt = entry.approvedVoucherGroup
      ? entry.approvedVoucherGroup.reviewed_at || evaluatedAt
      : null

    await weeklyVoucherRequirementRepository.createRequirementInvoice({
      connection,
      requirementId: requirement.id,
      invoiceId: entry.invoice.id,
      invoiceRole: Number(entry.invoice.id) === Number(invoice.id)
        ? 'trigger'
        : 'existing',
      voucherStatus: entry.approvedVoucherGroup ? 'approved' : 'pending',
      approvedVoucherGroupId: entry.approvedVoucherGroup?.id || null,
      completedAt,
    })
  }

  if (allInvoicesHaveApprovedVoucher) {
    await weeklyVoucherRequirementRepository.completeRequirement({
      connection,
      requirementId: requirement.id,
      completedAt: evaluatedAt,
    })

    return {
      allInvoicesHaveApprovedVoucher,
      relatedInvoiceCount: relatedInvoiceVouchers.length,
      requirement: {
        ...requirement,
        status: 'completed',
      },
    }
  }

  return {
    allInvoicesHaveApprovedVoucher,
    relatedInvoiceCount: relatedInvoiceVouchers.length,
    requirement,
  }
}

// 执行规则审核的完整业务决策链，返回最终状态和累计金额。
async function resolveApprovalDecision({
  connection,
  invoice,
  items,
  findApprovedInvoicesForWeek = invoiceReviewRepository.findApprovedInvoicesForWeek,
  persistWeeklyVoucherRequirement = true,
}) {
  const categoryDecision = getCategoryDecision(items)
  if (categoryDecision) {
    return {
      qualificationStatus: categoryDecision.status,
      qualificationReason: categoryDecision.reason,
      cumulativeAmount: null,
      cumulativeWeekStart: null,
      submittedAt: null,
    }
  }

  const priceDecision = getPriceDecision(items)
  if (priceDecision.status) {
    return {
      qualificationStatus: priceDecision.status,
      qualificationReason: priceDecision.reason,
      cumulativeAmount: null,
      cumulativeWeekStart: null,
      submittedAt: null,
    }
  }

  if (!invoice.seller_tax_id) {
    return {
      qualificationStatus: 'pending_manual',
      qualificationReason: '未识别销售方纳税人识别号，无法计算自然周累计',
      cumulativeAmount: null,
      cumulativeWeekStart: null,
      submittedAt: null,
    }
  }

  const submittedAt = invoice.submitted_at

  if (!submittedAt) {
    throw createHttpError(409, '发票尚未提交审核，无法计算自然周累计')
  }
  const weekStart = await invoiceReviewRepository.getWeekStart({
    connection,
    date: submittedAt,
  })
  const approvedInvoices = await findApprovedInvoicesForWeek({
    connection,
    invoiceId: invoice.id,
    sellerTaxId: invoice.seller_tax_id,
    weekStart,
  })
  const priorCumulativeAmount = sumInvoiceAmountsInCents(approvedInvoices) / 100
  const cumulativeAmount = (
    amountToCents(priorCumulativeAmount) + amountToCents(invoice.total_amount)
  ) / 100

  if (cumulativeAmount > 3000) {
    return {
      qualificationStatus: 'rejected',
      qualificationReason: `同销售方本自然周累计金额为 ${cumulativeAmount.toFixed(2)} 元，超过 3000 元`,
      cumulativeAmount,
      cumulativeWeekStart: weekStart,
      submittedAt,
      priorCumulativeAmount,
    }
  }

  if (cumulativeAmount > 1000) {
    const weeklyVoucherDecision = await resolveWeeklyVoucherRequirement({
      connection,
      invoice,
      cumulativeWeekStart: weekStart,
      cumulativeAmount,
      persistRequirement: persistWeeklyVoucherRequirement,
    })

    if (!weeklyVoucherDecision.allInvoicesHaveApprovedVoucher) {
      return {
        qualificationStatus: 'pending_voucher',
        qualificationReason: `同销售方本自然周累计金额为 ${cumulativeAmount.toFixed(2)} 元，已关联 ${weeklyVoucherDecision.relatedInvoiceCount} 张发票，需全部补齐并审核通过支付凭证`,
        cumulativeAmount,
        cumulativeWeekStart: weekStart,
        submittedAt,
        priorCumulativeAmount,
        weeklyVoucherRequirement: weeklyVoucherDecision.requirement,
      }
    }

    return {
      qualificationStatus: 'approved',
      qualificationReason: '商品品类、单价、同周关联发票支付凭证和自然周累计规则校验通过',
      cumulativeAmount,
      cumulativeWeekStart: weekStart,
      submittedAt,
      priorCumulativeAmount,
      weeklyVoucherRequirement: weeklyVoucherDecision.requirement,
    }
  }

  if (priceDecision.hasLowValue) {
    const hasVoucher = await voucherRepository.hasApprovedCompleteGroup({
      connection,
      invoiceId: invoice.id,
    })

    if (!hasVoucher) {
      return {
        qualificationStatus: 'pending_voucher',
        qualificationReason: '发票包含低值品，需补充并审核通过订单截图和支付记录',
        cumulativeAmount,
        cumulativeWeekStart: weekStart,
        submittedAt,
        priorCumulativeAmount,
      }
    }
  }

  return {
    qualificationStatus: 'approved',
    qualificationReason: '商品品类、单价、支付凭证和自然周累计规则校验通过',
    cumulativeAmount,
    cumulativeWeekStart: weekStart,
    submittedAt,
    priorCumulativeAmount,
  }
}

// 预览规则计算结果，不更新发票状态、累计字段或操作日志。
async function getInvoiceQualificationPreview({
  invoiceId,
}) {
  const normalizedInvoiceId = parsePositiveInteger(invoiceId, 'invoiceId')
  const invoice = await invoiceReviewRepository.findInvoiceForQualificationPreview({
    invoiceId: normalizedInvoiceId,
  })

  if (!invoice) {
    throw createHttpError(404, '发票不存在')
  }

  if (!invoice.submitted_at) {
    throw createHttpError(409, '请先提交审核，再查看规则预览')
  }

  if (invoice.qualification_status === 'cancelled') {
    throw createHttpError(409, '已取消的发票不能查看审核预览')
  }

  const items = await invoiceReviewRepository.findItemsForQualificationPreview({
    invoiceId: normalizedInvoiceId,
  })
  const decision = await resolveApprovalDecision({
    connection: pool,
    invoice,
    items,
    findApprovedInvoicesForWeek: invoiceReviewRepository.findApprovedInvoicesForWeekPreview,
    persistWeeklyVoucherRequirement: false,
  })

  return {
    invoiceId: normalizedInvoiceId,
    priorCumulativeAmount: decision.priorCumulativeAmount ?? null,
    currentInvoiceAmount: amountToCents(invoice.total_amount) / 100,
    projectedCumulativeAmount: decision.cumulativeAmount,
    cumulativeWeekStart: decision.cumulativeWeekStart,
    projectedQualificationStatus: decision.qualificationStatus,
    projectedQualificationReason: decision.qualificationReason,
    requiresVoucher: decision.qualificationStatus === 'pending_voucher',
    calculable: decision.cumulativeAmount !== null,
  }
}
// 单独审核某个商品的品类（人工改判）
async function reviewItemCategory({ itemId, result, note, operatorId }) {
  if (!Number.isInteger(Number(itemId)) || Number(itemId) <= 0) {
    const error = new Error('itemId 无效')
    error.statusCode = 400
    error.expose = true
    throw error
  }
  if (!ALLOWED_RESULTS.has(result)) {
    const error = new Error('result 必须是可以、存疑或不可以')
    error.statusCode = 400
    error.expose = true
    throw error
  }
  if (note !== undefined && note !== null && (typeof note !== 'string' || note.length > 2000)) {
    const error = new Error('note 必须是不超过 2000 个字符的文本')
    error.statusCode = 400
    error.expose = true
    throw error
  }
  const connection = await pool.getConnection()
  try {
    return await invoiceReviewRepository.reviewItemCategory({ connection, itemId: Number(itemId), result, note, operatorId })
  } finally {
    connection.release()
  }
}

// 提交审核的更新submitted_at的时间
async function submitInvoiceForReview({
  invoiceId,
  operatorId,
}) {
  const normalizedInvoiceId = parsePositiveInteger(invoiceId, 'invoiceId')
  const normalizedOperatorId = parsePositiveInteger(operatorId, 'operatorId')
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const invoice = await invoiceReviewRepository.findInvoiceForQualificationReview({
      connection,
      invoiceId: normalizedInvoiceId,
    })

    if (!invoice) {
      throw createHttpError(404, '发票不存在')
    }

    if (invoice.submitted_at) {
      throw createHttpError(409, '发票已提交审核，不能重复提交')
    }

    if (invoice.qualification_status !== 'pending') {
      throw createHttpError(409, '当前发票状态不能提交审核')
    }

    // 仅所有商品最终品类均为“可以”的发票可以提交审核。
    const items = await invoiceReviewRepository.findItemsForQualificationReview({
      connection,
      invoiceId: normalizedInvoiceId,
    })
    const nonApprovedItem = items.find(
      (item) => item.final_category_result !== '可以',
    )

    if (items.length === 0 || nonApprovedItem) {
      throw createHttpError(
        409,
        `商品“${nonApprovedItem?.item_name || '未知'}”品类不是“可以”，不能提交审核`,
      )
    }

    const submittedAt = new Date()
    const qualificationReason = '管理员已提交审核，等待发票级审核'
    const beforeData = {
      qualificationStatus: invoice.qualification_status,
      qualificationReason: invoice.qualification_reason,
      submittedAt: invoice.submitted_at,
    }

    // 更新发票的资质状态为pending
    await invoiceReviewRepository.updateInvoiceQualificationReview({
      connection,
      invoiceId: normalizedInvoiceId,
      qualificationStatus: 'pending',
      qualificationReason,
      cumulativeAmount: invoice.cumulative_amount,
      cumulativeWeekStart: invoice.cumulative_week_start,
      submittedAt,
      manualNote: invoice.manual_note,
    })

    const afterData = {
      qualificationStatus: 'pending',
      qualificationReason,
      submittedAt,
    }

    // 创建发票的提交时间
    await invoiceReviewRepository.createQualificationReviewLog({
      connection,
      operatorId: normalizedOperatorId,
      invoiceId: normalizedInvoiceId,
      beforeData,
      afterData,
      operationType: 'submit_qualification_review',
    })

    // 提交事务
    await connection.commit()

    return {
      id: normalizedInvoiceId,
      qualificationStatus: 'pending',
      qualificationReason,
      submittedAt,
    }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

// 管理员只能执行规则审核，或放弃当前发票。
async function reviewInvoiceQualification({
  invoiceId,
  action,
  note,
  operatorId,
}) {
  const normalizedInvoiceId = parsePositiveInteger(invoiceId, 'invoiceId')
  const normalizedOperatorId = parsePositiveInteger(operatorId, 'operatorId')

  if (!QUALIFICATION_ACTIONS.has(action)) {
    throw createHttpError(400, 'action 无效')
  }

  const normalizedNote = validateNote(note, action)

  if (action === 'execute_rules' && normalizedNote) {
    throw createHttpError(400, '执行规则审核不接受审核说明')
  }

  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const invoice = await invoiceReviewRepository.findInvoiceForQualificationReview({
      connection,
      invoiceId: normalizedInvoiceId,
    })

    if (!invoice) {
      throw createHttpError(404, '发票不存在')
    }

    if (!invoice.submitted_at) {
      throw createHttpError(409, '请先提交审核，再进行发票级审核')
    }

    if (invoice.qualification_status === 'cancelled') {
      throw createHttpError(409, '已取消的发票不能执行规则审核或再次放弃')
    }

    if (
      action === 'execute_rules'
      && invoice.qualification_status !== 'pending'
    ) {
      throw createHttpError(409, '当前发票不是待审核状态，不能执行规则审核')
    }

    if (
      action === 'abandon'
      && !ABANDONABLE_QUALIFICATION_STATUSES.has(invoice.qualification_status)
    ) {
      throw createHttpError(409, '当前发票状态不能放弃')
    }

    if (
      action === 'abandon'
      && (
        invoice.finance_status !== 'not_submitted'
        || invoice.reimbursement_status !== 'not_completed'
      )
    ) {
      throw createHttpError(409, '已进入财务或报销流程的发票不能放弃')
    }

    const beforeData = {
      qualificationStatus: invoice.qualification_status,
      qualificationReason: invoice.qualification_reason,
      cumulativeAmount: invoice.cumulative_amount,
      cumulativeWeekStart: invoice.cumulative_week_start,
      submittedAt: invoice.submitted_at,
      manualNote: invoice.manual_note,
    }
    let decision

    if (action === 'execute_rules') {
      const items = await invoiceReviewRepository.findItemsForQualificationReview({
        connection,
        invoiceId: normalizedInvoiceId,
      })

      decision = await resolveApprovalDecision({
        connection,
        invoice,
        items,
      })
    } else {
      const pendingRequirement = await weeklyVoucherRequirementRepository.findPendingRequirementByTriggerInvoiceId({
        connection,
        triggerInvoiceId: normalizedInvoiceId,
        forUpdate: true,
      })

      if (pendingRequirement) {
        await weeklyVoucherRequirementRepository.cancelRequirement({
          connection,
          requirementId: pendingRequirement.id,
          cancelledAt: new Date(),
        })
      }

      decision = {
        qualificationStatus: 'cancelled',
        qualificationReason: normalizedNote,
        cumulativeAmount: invoice.cumulative_amount,
        cumulativeWeekStart: invoice.cumulative_week_start,
        submittedAt: invoice.submitted_at,
        weeklyVoucherRequirement: pendingRequirement
          ? {
            id: pendingRequirement.id,
            status: 'cancelled',
          }
          : null,
      }
    }

    const cumulativeAmount = action === 'execute_rules'
      ? decision.cumulativeAmount
      : invoice.cumulative_amount
    const cumulativeWeekStart = action === 'execute_rules'
      ? decision.cumulativeWeekStart
      : invoice.cumulative_week_start
    const submittedAt = decision.submittedAt
    const manualNote = invoice.manual_note

    await invoiceReviewRepository.updateInvoiceQualificationReview({
      connection,
      invoiceId: normalizedInvoiceId,
      qualificationStatus: decision.qualificationStatus,
      qualificationReason: decision.qualificationReason,
      cumulativeAmount,
      cumulativeWeekStart,
      submittedAt,
      manualNote,
    })

    const afterData = {
      action,
      qualificationStatus: decision.qualificationStatus,
      qualificationReason: decision.qualificationReason,
      cumulativeAmount,
      cumulativeWeekStart,
      submittedAt: submittedAt || invoice.submitted_at,
      manualNote,
      weeklyVoucherRequirement: decision.weeklyVoucherRequirement || null,
    }

    await invoiceReviewRepository.createQualificationReviewLog({
      connection,
      operatorId: normalizedOperatorId,
      invoiceId: normalizedInvoiceId,
      beforeData,
      afterData,
      operationType: action === 'execute_rules'
        ? 'execute_qualification_rules'
        : 'abandon_invoice',
    })

    await connection.commit()

    return {
      id: normalizedInvoiceId,
      action,
      qualificationStatus: decision.qualificationStatus,
      qualificationReason: decision.qualificationReason,
      cumulativeAmount,
      cumulativeWeekStart,
      submittedAt: submittedAt || invoice.submitted_at,
      manualNote,
      weeklyVoucherRequirement: decision.weeklyVoucherRequirement || null,
    }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

module.exports = {
  reviewItemCategory,
  submitInvoiceForReview,
  getInvoiceQualificationPreview,
  reviewInvoiceQualification,
}
