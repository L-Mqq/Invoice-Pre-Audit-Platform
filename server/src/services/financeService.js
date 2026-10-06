const { pool } = require('../config/database')
const financeRepository = require('../repositories/financeRepository')
const {
  getBusinessNow,
} = require('../config/businessTime')
const {
  getPreAuditStatus,
  getPreAuditStatusReason,
} = require('../utils/preAuditStatus')

const BLOCKING_QUALIFICATION_STATUSES = new Set([
  'pending',
  'pending_voucher',
  'pending_manual',
])
const ALLOWED_REIMBURSEMENT_STATUSES = new Set([
  'success',
  'failed',
])
const ALLOWED_FINANCE_STATUSES = new Set([
  'not_submitted',
  'submitted',
])

// 创建带 HTTP 状态码的错误
function createHttpError(statusCode, message) {
  const error = new Error(message)
  error.statusCode = statusCode
  error.expose = true
  return error
}

// 校验操作人 ID
function parseOperatorId(value) {
  const parsed = Number(value)

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw createHttpError(400, '操作人 ID 无效')
  }

  return parsed
}

function parseInvoiceId(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw createHttpError(400, '发票 ID 无效')
  }

  const invoiceId = Number(value)

  if (!Number.isSafeInteger(invoiceId) || invoiceId <= 0) {
    throw createHttpError(400, '发票 ID 无效')
  }

  return invoiceId
}

function parseReimbursementStatus(value) {
  if (!ALLOWED_REIMBURSEMENT_STATUSES.has(value)) {
    throw createHttpError(400, '最终报销状态仅可更新为 success 或 failed')
  }

  return value
}

// 校验销售方税号
function parseSellerTaxId(value) {
  if (typeof value !== 'string') {
    throw createHttpError(400, '销售方纳税人识别号不能为空')
  }

  const sellerTaxId = value.trim()

  if (!sellerTaxId || sellerTaxId.length > 32) {
    throw createHttpError(400, '销售方纳税人识别号无效')
  }

  return sellerTaxId
}

// 校验“自然周起始日”
function parseCumulativeWeekStart(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw createHttpError(400, '自然周起始日必须为 YYYY-MM-DD 格式')
  }

  const date = new Date(`${value}T00:00:00.000Z`)

  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw createHttpError(400, '自然周起始日无效')
  }

  if (date.getUTCDay() !== 1) {
    throw createHttpError(400, '自然周起始日必须是周一')
  }

  return value
}

function parseOptionalCumulativeWeekStart(value) {
  if (value === undefined || value === null || value === '') {
    return undefined
  }

  return parseCumulativeWeekStart(value)
}

function parseOptionalFinanceStatus(value) {
  if (value === undefined || value === null || value === '') {
    return undefined
  }

  if (!ALLOWED_FINANCE_STATUSES.has(value)) {
    throw createHttpError(400, '财务提交状态无效')
  }

  return value
}

function parseOptionalSellerKeyword(value) {
  if (value === undefined || value === null || value === '') {
    return undefined
  }

  if (typeof value !== 'string') {
    throw createHttpError(400, '销售方筛选条件无效')
  }

  const keyword = value.trim()

  if (!keyword) {
    return undefined
  }

  if (keyword.length > 255) {
    throw createHttpError(400, '销售方筛选条件过长')
  }

  return keyword
}

// 返回上海时区的日期字符串
function getShanghaiDateString(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(date)
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )

  return `${values.year}-${values.month}-${values.day}`
}

// 算“下一周的周一”
function getNextWeekStart(cumulativeWeekStart) {
  const date = new Date(`${cumulativeWeekStart}T00:00:00.000Z`)

  date.setUTCDate(date.getUTCDate() + 7)

  return date.toISOString().slice(0, 10)
}

// 判断周结束没
function isWeekCompleted({
  cumulativeWeekStart,
  now = new Date(),
}) {
  return getShanghaiDateString(now) >= getNextWeekStart(cumulativeWeekStart)
}

// 把发票列表格式化成字符串
function formatInvoiceNumbers(invoices) {
  return invoices
    .map((invoice) => invoice.invoice_number || `#${invoice.id}`)
    .join('、')
}

// 把金额转成“分
function amountToCents(value) {
  return Math.round(Number(value || 0) * 100)
}

// 根据“周一”，算出“周日
function getWeekEnd(cumulativeWeekStart) {
  const date = new Date(`${cumulativeWeekStart}T00:00:00.000Z`)

  date.setUTCDate(date.getUTCDate() + 6)

  return date.toISOString().slice(0, 10)
}

// 生成“财务组”的唯一 key
function getFinanceWeekKey({
  sellerTaxId,
  cumulativeWeekStart,
}) {
  return `${sellerTaxId}#${cumulativeWeekStart}`
}

// 创建一个“财务组”的初始结构
function createFinanceWeekGroup({
  invoice,
  voucherProgress,
}) {
  return {
    sellerName: invoice.seller_name || '未识别销售方名称',
    sellerTaxId: invoice.seller_tax_id,
    weekStart: invoice.submitted_week_start,
    weekEnd: getWeekEnd(invoice.submitted_week_start),
    totalInvoiceCount: 0,
    activeInvoiceCount: 0,
    approvedInvoiceCount: 0,
    pendingInvoiceCount: 0,
    rejectedInvoiceCount: 0,
    cancelledInvoiceCount: 0,
    submittedApprovedInvoiceCount: 0,
    invalidSnapshotCount: 0,
    validCumulativeAmountInCents: 0,
    reimbursementSummary: {
      notCompletedCount: 0,
      successCount: 0,
      failedCount: 0,
    },
    voucherProgress: {
      requiredInvoiceCount: Number(voucherProgress?.required_invoice_count || 0),
      approvedInvoiceCount: Number(voucherProgress?.approved_invoice_count || 0),
      triggeredCumulativeAmount: voucherProgress?.pending_triggered_cumulative_amount === null
        || voucherProgress?.pending_triggered_cumulative_amount === undefined
        ? null
        : Number(voucherProgress.pending_triggered_cumulative_amount),
      hasCompletedRequirement: Number(voucherProgress?.has_completed_requirement || 0) === 1,
      hasPendingRequirement: Number(voucherProgress?.has_pending_requirement || 0) === 1,
    },
  }
}

// 把一张发票的数据，累加到对应的“财务组”里
function appendInvoiceToFinanceWeekGroup({
  group,
  invoice,
}) {
  group.totalInvoiceCount += 1

  if (invoice.qualification_status === 'rejected') {
    group.rejectedInvoiceCount += 1
    return
  }

  if (invoice.qualification_status === 'cancelled') {
    group.cancelledInvoiceCount += 1
    return
  }

  group.activeInvoiceCount += 1

  if (BLOCKING_QUALIFICATION_STATUSES.has(invoice.qualification_status)) {
    group.pendingInvoiceCount += 1
    return
  }

  if (invoice.qualification_status !== 'approved') {
    return
  }

  group.approvedInvoiceCount += 1
  group.validCumulativeAmountInCents += amountToCents(invoice.total_amount)

  if (invoice.cumulative_week_start !== group.weekStart) {
    group.invalidSnapshotCount += 1
  }

  if (invoice.finance_status === 'submitted') {
    group.submittedApprovedInvoiceCount += 1
  }

  if (invoice.reimbursement_status === 'success') {
    group.reimbursementSummary.successCount += 1
  } else if (invoice.reimbursement_status === 'failed') {
    group.reimbursementSummary.failedCount += 1
  } else {
    group.reimbursementSummary.notCompletedCount += 1
  }
}

// 函数把“财务组”转成前端格式，同时算出“能不能提交财务”和“不能提交的原因”
function serializeFinanceWeekGroup({
  group,
  now,
}) {
  const validCumulativeAmount = group.validCumulativeAmountInCents / 100
  const financeStatus = group.approvedInvoiceCount > 0
    && group.submittedApprovedInvoiceCount === group.approvedInvoiceCount
    ? 'submitted'
    : 'not_submitted'
  const submitBlockedReasons = []

  if (financeStatus === 'not_submitted') {
    if (!isWeekCompleted({ cumulativeWeekStart: group.weekStart, now })) {
      submitBlockedReasons.push('该自然周尚未结束，请于下一周周一后提交财务')
    }

    if (group.voucherProgress.hasPendingRequirement) {
      const pendingVoucherCount = group.voucherProgress.requiredInvoiceCount
        - group.voucherProgress.approvedInvoiceCount

      submitBlockedReasons.push(
        `周累计凭证尚有 ${pendingVoucherCount} 张未完成`,
      )
    } else if (group.pendingInvoiceCount > 0) {
      submitBlockedReasons.push(
        `组内仍有 ${group.pendingInvoiceCount} 张发票待审核或待补凭证`,
      )
    }

    if (group.approvedInvoiceCount === 0) {
      submitBlockedReasons.push('该自然周没有可提交财务的审核通过发票')
    }

    if (group.invalidSnapshotCount > 0) {
      submitBlockedReasons.push('存在自然周审核快照异常的发票，请先重新审核')
    }

    if (group.submittedApprovedInvoiceCount > 0) {
      submitBlockedReasons.push('存在已进入财务流程的发票，请人工处理该异常组')
    }

    if (validCumulativeAmount > 3000) {
      submitBlockedReasons.push('该自然周审核通过发票累计金额超过 3000 元，不能提交财务')
    }
  }

  const currentPreAuditCompletedInvoiceCount = group.voucherProgress.hasPendingRequirement
    ? 0
    : group.approvedInvoiceCount
  const canSubmitFinance = financeStatus === 'not_submitted'
    && submitBlockedReasons.length === 0
  const groupProcessingStatus = financeStatus === 'submitted'
    ? 'submitted'
    : group.voucherProgress.hasPendingRequirement
      ? 'pending_weekly_voucher'
      : canSubmitFinance
        ? 'ready_for_finance'
        : 'waiting'

  return {
    sellerName: group.sellerName,
    sellerTaxId: group.sellerTaxId,
    weekStart: group.weekStart,
    weekEnd: group.weekEnd,
    totalInvoiceCount: group.totalInvoiceCount,
    activeInvoiceCount: group.activeInvoiceCount,
    approvedInvoiceCount: group.approvedInvoiceCount,
    pendingInvoiceCount: group.pendingInvoiceCount,
    rejectedInvoiceCount: group.rejectedInvoiceCount,
    cancelledInvoiceCount: group.cancelledInvoiceCount,
    validCumulativeAmount,
    currentPreAuditCompletedInvoiceCount,
    voucherProgress: group.voucherProgress,
    financeStatus,
    groupProcessingStatus,
    reimbursementSummary: group.reimbursementSummary,
    canSubmitFinance,
    submitBlockedReason: submitBlockedReasons[0] || null,
    submitBlockedReasons,
  }
}

// 获取凭证状态
function getVoucherStatus(invoice) {
  if (invoice.weekly_voucher_status === 'pending') {
    return {
      code: 'pending',
      label: '周累计凭证待补齐',
    }
  }

  if (invoice.weekly_voucher_status === 'approved') {
    return {
      code: 'approved',
      label: '本票凭证已通过，等待组内凭证',
    }
  }

  if (Number(invoice.has_approved_complete_voucher_group) === 1) {
    return {
      code: 'approved',
      label: '凭证已通过',
    }
  }

  if (invoice.latest_voucher_review_status === 'rejected') {
    return {
      code: 'rejected',
      label: '凭证已驳回',
    }
  }

  if (invoice.qualification_status === 'pending_voucher') {
    return {
      code: 'pending',
      label: '凭证待补齐',
    }
  }

  return {
    code: 'not_required',
    label: '无需凭证',
  }
}

// 查询某个销售方在某个自然周内已提交审核的发票列表
async function getFinanceWeekInvoices({
  sellerTaxId,
  cumulativeWeekStart,
}) {
  const normalizedSellerTaxId = parseSellerTaxId(sellerTaxId)
  const normalizedWeekStart = parseCumulativeWeekStart(cumulativeWeekStart)
  const invoices = await financeRepository.findInvoicesForFinanceWeekDetail({
    sellerTaxId: normalizedSellerTaxId,
    cumulativeWeekStart: normalizedWeekStart,
  })

  if (invoices.length === 0) {
    throw createHttpError(404, '该销售方在此自然周没有已提交审核的发票')
  }

  return {
    sellerTaxId: normalizedSellerTaxId,
    weekStart: normalizedWeekStart,
    weekEnd: getWeekEnd(normalizedWeekStart),
    items: invoices.map((invoice) => {
      const preAuditStatus = getPreAuditStatus({
        qualificationStatus: invoice.qualification_status,
        weeklyVoucherStatus: invoice.weekly_voucher_status,
      })

      return {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        totalAmount: Number(invoice.total_amount),
        submittedAt: invoice.submitted_at,
        qualificationStatus: invoice.qualification_status,
        qualificationReason: invoice.qualification_reason,
        preAuditStatus,
        preAuditStatusReason: getPreAuditStatusReason({
          qualificationReason: invoice.qualification_reason,
          preAuditStatus,
        }),
        voucherStatus: getVoucherStatus(invoice),
        financeStatus: invoice.finance_status,
        reimbursementStatus: invoice.reimbursement_status,
      }
    }),
  }
}

// 报销进度页的核心数据
async function listFinanceWeeks({
  financeStatus,
  cumulativeWeekStart,
  sellerKeyword,
}) {
  const businessNow = getBusinessNow()
  const normalizedFinanceStatus = parseOptionalFinanceStatus(financeStatus)
  const normalizedWeekStart = parseOptionalCumulativeWeekStart(cumulativeWeekStart)
  const normalizedSellerKeyword = parseOptionalSellerKeyword(sellerKeyword)
  const [invoices, voucherProgressRows] = await Promise.all([
    financeRepository.findInvoicesForFinanceWeekList({
      sellerKeyword: normalizedSellerKeyword,
      cumulativeWeekStart: normalizedWeekStart,
    }),
    financeRepository.findWeeklyVoucherProgress(),
  ])
  const voucherProgressByWeek = new Map(
    voucherProgressRows.map((row) => [
      getFinanceWeekKey({
        sellerTaxId: row.seller_tax_id,
        cumulativeWeekStart: row.cumulative_week_start,
      }),
      row,
    ]),
  )
  const groupsByWeek = new Map()

  for (const invoice of invoices) {
    const groupKey = getFinanceWeekKey({
      sellerTaxId: invoice.seller_tax_id,
      cumulativeWeekStart: invoice.submitted_week_start,
    })
    let group = groupsByWeek.get(groupKey)

    if (!group) {
      group = createFinanceWeekGroup({
        invoice,
        voucherProgress: voucherProgressByWeek.get(groupKey),
      })
      groupsByWeek.set(groupKey, group)
    }

    appendInvoiceToFinanceWeekGroup({ group, invoice })
  }

  const allGroups = [...groupsByWeek.values()]
    .map((group) => serializeFinanceWeekGroup({
      group,
      now: businessNow,
    }))
    .sort((left, right) => right.weekStart.localeCompare(left.weekStart))
  const items = normalizedFinanceStatus
    ? allGroups.filter((group) => group.financeStatus === normalizedFinanceStatus)
    : allGroups

  return {
    summary: {
      pendingGroupCount: allGroups.filter((group) => group.financeStatus === 'not_submitted').length,
      submittedGroupCount: allGroups.filter((group) => group.financeStatus === 'submitted').length,
    },
    items,
  }
}

// 提交财务数据
async function submitFinanceWeek({
  sellerTaxId,
  cumulativeWeekStart,
  operatorId,
}) {
  const normalizedSellerTaxId = parseSellerTaxId(sellerTaxId)
  const normalizedWeekStart = parseCumulativeWeekStart(cumulativeWeekStart)
  const normalizedOperatorId = parseOperatorId(operatorId)
  const businessNow = getBusinessNow()

  if (!isWeekCompleted({
    cumulativeWeekStart: normalizedWeekStart,
    now: businessNow,
  })) {
    throw createHttpError(409, '该自然周尚未结束，请于下一周周一后提交财务')
  }

  const connection = await pool.getConnection()

  // 开启事务
  try {
    await connection.beginTransaction()

    // 查询当前销售方加锁
    const invoices = await financeRepository.findInvoicesForWeekSubmission({
      connection,
      sellerTaxId: normalizedSellerTaxId,
      cumulativeWeekStart: normalizedWeekStart,
    })

    if (invoices.length === 0) {
      throw createHttpError(404, '该销售方在此自然周没有已提交审核的发票')
    }

    // 寻找发票中属于阻塞状态的发票，如果有则不能提交财务
    const blockingInvoices = invoices.filter((invoice) => {
      return BLOCKING_QUALIFICATION_STATUSES.has(invoice.qualification_status)
    })

    if (blockingInvoices.length > 0) {
      throw createHttpError(
        409,
        `该自然周仍有未完成资质审核或凭证的发票：${formatInvoiceNumbers(blockingInvoices)}`,
      )
    }

    const pendingRequirement = await financeRepository.findPendingWeeklyVoucherRequirement({
      connection,
      sellerTaxId: normalizedSellerTaxId,
      cumulativeWeekStart: normalizedWeekStart,
    })

    if (pendingRequirement) {
      throw createHttpError(409, '该自然周存在未完成的周累计凭证补齐任务')
    }

    const approvedInvoices = invoices.filter((invoice) => {
      return invoice.qualification_status === 'approved'
    })

    if (approvedInvoices.length === 0) {
      throw createHttpError(409, '该自然周没有可提交财务的审核通过发票')
    }

    const inconsistentInvoices = approvedInvoices.filter((invoice) => {
      return invoice.cumulative_week_start !== normalizedWeekStart
    })

    if (inconsistentInvoices.length > 0) {
      throw createHttpError(
        409,
        `发票自然周审核快照异常，请先重新审核：${formatInvoiceNumbers(inconsistentInvoices)}`,
      )
    }

    const nonSubmittableInvoices = approvedInvoices.filter((invoice) => {
      return invoice.finance_status !== 'not_submitted'
        || invoice.reimbursement_status !== 'not_completed'
    })

    if (nonSubmittableInvoices.length > 0) {
      throw createHttpError(
        409,
        `存在已进入财务或报销流程的发票：${formatInvoiceNumbers(nonSubmittableInvoices)}`,
      )
    }

    const cumulativeAmount = approvedInvoices.reduce((total, invoice) => {
      return total + Math.round(Number(invoice.total_amount || 0) * 100)
    }, 0) / 100

    if (cumulativeAmount > 3000) {
      throw createHttpError(409, '该自然周审核通过发票累计金额超过 3000 元，不能提交财务')
    }

    await financeRepository.markInvoicesAsFinanceSubmitted({
      connection,
      invoiceIds: approvedInvoices.map((invoice) => invoice.id),
    })

    await financeRepository.createFinanceSubmissionLogs({
      connection,
      operatorId: normalizedOperatorId,
      invoices: approvedInvoices,
      sellerTaxId: normalizedSellerTaxId,
      cumulativeWeekStart: normalizedWeekStart,
    })

    await connection.commit()

    return {
      sellerTaxId: normalizedSellerTaxId,
      cumulativeWeekStart: normalizedWeekStart,
      financeStatus: 'submitted',
      invoiceCount: approvedInvoices.length,
      cumulativeAmount,
      invoiceIds: approvedInvoices.map((invoice) => invoice.id),
    }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

// 更新最终的报销状态
async function updateInvoiceReimbursementStatus({
  invoiceId,
  reimbursementStatus,
  operatorId,
}) {
  const normalizedInvoiceId = parseInvoiceId(invoiceId)
  const normalizedReimbursementStatus = parseReimbursementStatus(reimbursementStatus)
  const normalizedOperatorId = parseOperatorId(operatorId)
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const invoice = await financeRepository.findInvoiceForReimbursementUpdate({
      connection,
      invoiceId: normalizedInvoiceId,
    })

    if (!invoice) {
      throw createHttpError(404, '发票不存在')
    }

    if (invoice.qualification_status !== 'approved') {
      throw createHttpError(409, '仅审核通过的发票可以更新最终报销状态')
    }

    if (invoice.finance_status !== 'submitted') {
      throw createHttpError(409, '请先提交财务，再更新最终报销状态')
    }

    if (invoice.reimbursement_status !== 'not_completed') {
      throw createHttpError(409, '该发票已有最终报销结果，不能重复更新')
    }

    const affectedRows = await financeRepository.updateReimbursementStatus({
      connection,
      invoiceId: normalizedInvoiceId,
      reimbursementStatus: normalizedReimbursementStatus,
    })

    if (affectedRows !== 1) {
      throw createHttpError(409, '发票状态已变化，请刷新后重试')
    }

    await financeRepository.createReimbursementStatusLog({
      connection,
      operatorId: normalizedOperatorId,
      invoice,
      reimbursementStatus: normalizedReimbursementStatus,
    })

    await connection.commit()

    return {
      id: normalizedInvoiceId,
      reimbursementStatus: normalizedReimbursementStatus,
    }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

module.exports = {
  listFinanceWeeks,
  getFinanceWeekInvoices,
  submitFinanceWeek,
  updateInvoiceReimbursementStatus,
}
