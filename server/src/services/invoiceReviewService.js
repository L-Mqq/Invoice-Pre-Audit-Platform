const { pool } = require('../config/database')
const invoiceReviewRepository = require('../repositories/invoiceReviewRepository')
const voucherRepository = require('../repositories/voucherRepository')
const {
  PRICE_TYPES,
  classifyUnitPrice,
} = require('./priceJudgmentService')

const ALLOWED_RESULTS = new Set(['可以', '存疑', '不可以'])
const QUALIFICATION_ACTIONS = new Set([
  'approve',
  'request_voucher',
  'mark_manual',
  'reject',
  'cancel',
])
const NOTE_REQUIRED_ACTIONS = new Set([
  'reject',
  'cancel',
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

  if (NOTE_REQUIRED_ACTIONS.has(action) && !normalizedNote) {
    throw createHttpError(400, '当前操作必须填写审核说明')
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

function sumInvoiceAmountsInCents(invoices) {
  return invoices.reduce(
    (total, invoice) => total + amountToCents(invoice.total_amount),
    0,
  )
}
// 处理非 approve 的直接操作（管理员手动流转）
function getDirectActionDecision(action, note) {
  const decisions = {
    request_voucher: {
      qualificationStatus: 'pending_voucher',
      qualificationReason: note || '管理员要求补充支付凭证',
    },
    mark_manual: {
      qualificationStatus: 'pending_manual',
      qualificationReason: note || '管理员标记为待人工处理',
    },
    reject: {
      qualificationStatus: 'rejected',
      qualificationReason: note,
    },
    cancel: {
      qualificationStatus: 'cancelled',
      qualificationReason: note,
    },
  }

  return decisions[action] || null
}
// approve 操作的完整业务决策链，返回最终状态和累计金额。
async function resolveApprovalDecision({
  connection,
  invoice,
  items,
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
  const approvedInvoices = await invoiceReviewRepository.findApprovedInvoicesForWeek({
    connection,
    invoiceId: invoice.id,
    sellerTaxId: invoice.seller_tax_id,
    weekStart,
  })
  const cumulativeAmount = (
    sumInvoiceAmountsInCents(approvedInvoices) + amountToCents(invoice.total_amount)
  ) / 100

  if (cumulativeAmount > 3000) {
    return {
      qualificationStatus: 'rejected',
      qualificationReason: `同销售方本自然周累计金额为 ${cumulativeAmount.toFixed(2)} 元，超过 3000 元`,
      cumulativeAmount,
      cumulativeWeekStart: weekStart,
      submittedAt,
    }
  }

  const requiresVoucher = priceDecision.hasLowValue || cumulativeAmount > 1000
  if (requiresVoucher) {
    const hasVoucher = await voucherRepository.hasApprovedCompleteGroup({
      connection,
      invoiceId: invoice.id,
    })

    if (!hasVoucher) {
      const reason = priceDecision.hasLowValue
        ? '发票包含低值品，需补充并审核通过订单截图和支付记录'
        : `同销售方本自然周累计金额为 ${cumulativeAmount.toFixed(2)} 元，需补充支付凭证`

      return {
        qualificationStatus: 'pending_voucher',
        qualificationReason: reason,
        cumulativeAmount,
        cumulativeWeekStart: weekStart,
        submittedAt,
      }
    }
  }

  return {
    qualificationStatus: 'approved',
    qualificationReason: '商品品类、单价、支付凭证和自然周累计规则校验通过',
    cumulativeAmount,
    cumulativeWeekStart: weekStart,
    submittedAt,
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

    if (
      invoice.qualification_status !== 'pending'
      && invoice.qualification_status !== 'pending_manual'
    ) {
      throw createHttpError(409, '当前发票状态不能提交审核')
    }

    // 判断商品品类是否确认
    const items = await invoiceReviewRepository.findItemsForQualificationReview({
      connection,
      invoiceId: normalizedInvoiceId,
    })
    const unresolvedItem = items.find(
      (item) => !item.final_category_result || item.final_category_result === '存疑',
    )

    if (items.length === 0 || unresolvedItem) {
      throw createHttpError(409, '请先完成全部商品的品类确认，再提交审核')
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

// 进入审核更改资质审核的最终结果qualification_status
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
      throw createHttpError(409, '已取消的发票不能再次审核')
    }

    if (invoice.qualification_status === 'rejected' && action === 'approve') {
      throw createHttpError(409, '审核不通过的发票不能直接审核通过，请重新上传或人工处理')
    }

    const beforeData = {
      qualificationStatus: invoice.qualification_status,
      qualificationReason: invoice.qualification_reason,
      cumulativeAmount: invoice.cumulative_amount,
      cumulativeWeekStart: invoice.cumulative_week_start,
      submittedAt: invoice.submitted_at,
      manualNote: invoice.manual_note,
    }
    let decision = getDirectActionDecision(action, normalizedNote)

    if (action === 'approve') {
      const items = await invoiceReviewRepository.findItemsForQualificationReview({
        connection,
        invoiceId: normalizedInvoiceId,
      })

      decision = await resolveApprovalDecision({
        connection,
        invoice,
        items,
      })
    }

    const cumulativeAmount = action === 'approve'
      ? decision.cumulativeAmount
      : invoice.cumulative_amount
    const cumulativeWeekStart = action === 'approve'
      ? decision.cumulativeWeekStart
      : invoice.cumulative_week_start
    const submittedAt = decision.submittedAt || null
    const manualNote = normalizedNote || invoice.manual_note

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
    }

    await invoiceReviewRepository.createQualificationReviewLog({
      connection,
      operatorId: normalizedOperatorId,
      invoiceId: normalizedInvoiceId,
      beforeData,
      afterData,
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
  reviewInvoiceQualification,
}
