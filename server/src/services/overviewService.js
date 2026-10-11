const overviewRepository = require('../repositories/overviewRepository')
const financeService = require('./financeService')
const {
  getBusinessNow,
} = require('../config/businessTime')

function getShanghaiDateString(date) {
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
      .map((part) => [
        part.type,
        part.value,
      ]),
  )

  return `${values.year}-${values.month}-${values.day}`
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`)

  date.setUTCDate(date.getUTCDate() + days)

  return date.toISOString().slice(0, 10)
}

function getCurrentWeekStart(date) {
  const shanghaiDate = getShanghaiDateString(date)
  const currentDate = new Date(`${shanghaiDate}T00:00:00.000Z`)
  const weekDay = currentDate.getUTCDay()
  const daysSinceMonday = weekDay === 0 ? 6 : weekDay - 1

  return addDays(shanghaiDate, -daysSinceMonday)
}

function toNumber(value) {
  return Number(value || 0)
}

function createTodos({
  invoiceSummary,
  financeSummary,
}) {
  return [
    {
      type: 'pending_review',
      count: toNumber(invoiceSummary.pending_review_count),
    },
    {
      type: 'pending_voucher',
      count: toNumber(invoiceSummary.pending_voucher_count),
    },
    {
      type: 'pending_manual',
      count: toNumber(invoiceSummary.pending_manual_count),
    },
    {
      type: 'ready_for_finance',
      count: financeSummary.readyForFinanceGroupCount,
    },
    {
      type: 'reimbursement_failed',
      count: toNumber(invoiceSummary.reimbursement_failed_count),
    },
  ]
}

function mapRecentOperations(rows) {
  return rows.map((row) => ({
    id: row.id,
    operationType: row.operation_type,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    operatorId: row.operator_id,
    operatorName: row.operator_name,
    createdAt: row.created_at,
  }))
}

async function getCurrentWeekOverview() {
  const businessNow = getBusinessNow()
  const weekStart = getCurrentWeekStart(businessNow)
  const weekEnd = addDays(weekStart, 6)
  const [
    invoiceSummary,
    financeWeeks,
    recentOperations,
  ] = await Promise.all([
    overviewRepository.getCurrentWeekInvoiceSummary({
      weekStart,
    }),
    financeService.listFinanceWeeks({
      cumulativeWeekStart: weekStart,
    }),
    overviewRepository.findRecentOperations({
      weekStart,
      limit: 10,
    }),
  ])
  const financeSummary = {
    pendingGroupCount: financeWeeks.summary.pendingGroupCount,
    submittedGroupCount: financeWeeks.summary.submittedGroupCount,
    readyForFinanceGroupCount: financeWeeks.items.filter((group) => {
      return group.groupProcessingStatus === 'ready_for_finance'
    }).length,
    pendingWeeklyVoucherGroupCount: financeWeeks.items.filter((group) => {
      return group.groupProcessingStatus === 'pending_weekly_voucher'
    }).length,
  }

  return {
    period: {
      weekStart,
      weekEnd,
      generatedAt: businessNow.toISOString(),
    },
    summary: {
      invoiceCount: toNumber(invoiceSummary.invoice_count),
      invoiceAmount: toNumber(invoiceSummary.invoice_amount),
      pendingReviewCount: toNumber(invoiceSummary.pending_review_count),
      pendingVoucherCount: toNumber(invoiceSummary.pending_voucher_count),
      waitingGroupVouchersCount: toNumber(
        invoiceSummary.waiting_group_vouchers_count,
      ),
      pendingManualCount: toNumber(invoiceSummary.pending_manual_count),
      approvedCount: toNumber(invoiceSummary.approved_count),
      rejectedCount: toNumber(invoiceSummary.rejected_count),
      cancelledCount: toNumber(invoiceSummary.cancelled_count),
      reimbursementFailedCount: toNumber(
        invoiceSummary.reimbursement_failed_count,
      ),
    },
    finance: financeSummary,
    todos: createTodos({
      invoiceSummary,
      financeSummary,
    }),
    recentOperations: mapRecentOperations(recentOperations),
  }
}

module.exports = {
  getCurrentWeekOverview,
}
