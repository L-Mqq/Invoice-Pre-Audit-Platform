const { pool } = require('../config/database')
const financeRepository = require('../repositories/financeRepository')

const BLOCKING_QUALIFICATION_STATUSES = new Set([
  'pending',
  'pending_voucher',
  'pending_manual',
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

async function submitFinanceWeek({
  sellerTaxId,
  cumulativeWeekStart,
  operatorId,
}) {
  const normalizedSellerTaxId = parseSellerTaxId(sellerTaxId)
  const normalizedWeekStart = parseCumulativeWeekStart(cumulativeWeekStart)
  const normalizedOperatorId = parseOperatorId(operatorId)

  if (!isWeekCompleted({ cumulativeWeekStart: normalizedWeekStart })) {
    throw createHttpError(409, '该自然周尚未结束，请于下一周周一后提交财务')
  }

  const connection = await pool.getConnection()

  // 开启事务
  try {
    await connection.beginTransaction()

    const invoices = await financeRepository.findInvoicesForWeekSubmission({
      connection,
      sellerTaxId: normalizedSellerTaxId,
      cumulativeWeekStart: normalizedWeekStart,
    })

    if (invoices.length === 0) {
      throw createHttpError(404, '该销售方在此自然周没有已提交审核的发票')
    }

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

module.exports = {
  submitFinanceWeek,
}
