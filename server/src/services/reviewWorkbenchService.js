const invoiceRepository = require('../repositories/invoiceRepository')
const reviewWorkbenchRepository = require('../repositories/reviewWorkbenchRepository')
const {
  DUPLICATE_REASON_PREFIX,
} = require('../utils/duplicateInvoice')
const {
  getManualProcessingContext,
} = require('./invoiceDataValidationService')

function badRequest(message) {
  const error = new Error(message)

  error.statusCode = 400
  error.expose = true

  return error
}

function parseLimit(value) {
  if (value === undefined) {
    return 10
  }

  const limit = Number(value)

  if (!Number.isInteger(limit) || limit <= 0 || limit > 20) {
    throw badRequest('limit 必须是 1 到 20 之间的整数')
  }

  return limit
}

function toNumber(value) {
  return Number(value || 0)
}

function getTaskReason(reason, fallbackReason) {
  if (typeof reason !== 'string' || !reason.trim()) {
    return fallbackReason
  }

  try {
    const parsedReason = JSON.parse(reason)

    if (Array.isArray(parsedReason)) {
      const messages = parsedReason
        .map((item) => {
          return typeof item?.message === 'string'
            ? item.message
            : null
        })
        .filter(Boolean)

      if (messages.length > 0) {
        return messages.join('；')
      }
    }
  } catch (error) {
    return reason
  }

  return reason
}

function mapPriorityTask(row) {
  const isWeeklyVoucherTask = Number(row.has_pending_voucher) === 1
  const taskDefinitions = {
    pending_manual: {
      preAuditStatus: 'pending_manual',
      priority: 1,
      fallbackReason: '需要人工补全发票信息或确认品类。',
    },
    pending_voucher: {
      preAuditStatus: isWeeklyVoucherTask
        ? 'pending_weekly_voucher'
        : 'pending_voucher',
      priority: 2,
      fallbackReason: isWeeklyVoucherTask
        ? '本自然周累计触发周凭证要求，需补齐支付凭证。'
        : '需补充订单截图和支付记录。',
    },
    pending_review: {
      preAuditStatus: 'pending',
      priority: 3,
      fallbackReason: '预审完成，等待确认审核结论。',
    },
  }
  const definition = taskDefinitions[row.task_type]

  return {
    invoiceId: row.id,
    invoiceNumber: row.invoice_number,
    sellerName: row.seller_name,
    totalAmount: toNumber(row.total_amount),
    submittedAt: row.submitted_at,
    preAuditStatus: definition.preAuditStatus,
    reason: getTaskReason(
      row.qualification_reason,
      definition.fallbackReason,
    ),
    priority: definition.priority,
  }
}

async function countIncompleteDataInvoices() {
  const invoices = await reviewWorkbenchRepository.findPendingManualInvoices()

  if (invoices.length === 0) {
    return 0
  }

  const invoiceIds = invoices.map((invoice) => invoice.id)
  const items = await invoiceRepository.findItemsByInvoiceIds(invoiceIds)
  const itemsByInvoiceId = new Map()

  for (const item of items) {
    const invoiceItems = itemsByInvoiceId.get(item.invoice_id) || []

    invoiceItems.push(item)
    itemsByInvoiceId.set(item.invoice_id, invoiceItems)
  }

  return invoices.reduce((count, invoice) => {
    const context = getManualProcessingContext({
      invoice,
      items: itemsByInvoiceId.get(invoice.id) || [],
    })

    return context.completionRequired ? count + 1 : count
  }, 0)
}

async function getReviewWorkbench(query = {}) {
  const limit = parseLimit(query.limit)
  const [
    pendingSummary,
    priorityTaskRows,
    exceptionCounts,
    dataIncompleteCount,
  ] = await Promise.all([
    reviewWorkbenchRepository.getPendingSummary(),
    reviewWorkbenchRepository.findPriorityTasks({
      limit,
    }),
    reviewWorkbenchRepository.getExceptionCounts({
      suspectedDuplicateReasonPrefix: DUPLICATE_REASON_PREFIX,
    }),
    countIncompleteDataInvoices(),
  ])

  return {
    summary: {
      pendingReviewCount: toNumber(pendingSummary.pending_review_count),
      pendingVoucherCount: toNumber(pendingSummary.pending_voucher_count),
      pendingManualCount: toNumber(pendingSummary.pending_manual_count),
    },
    priorityTasks: priorityTaskRows.map((row) => {
      return mapPriorityTask(row)
    }),
    exceptions: {
      duplicateCount: toNumber(exceptionCounts.duplicate_count),
      extractionFailedCount: toNumber(
        exceptionCounts.extraction_failed_count,
      ),
      dataIncompleteCount,
    },
  }
}

module.exports = {
  getReviewWorkbench,
}
