const invoiceRepository = require('../repositories/invoiceRepository')

const QUALIFICATION_STATUSES = new Set([
  'pending',
  'pending_voucher',
  'pending_manual',
  'approved',
  'rejected',
  'cancelled',
])
const FINANCE_STATUSES = new Set(['not_submitted', 'submitted'])
const REIMBURSEMENT_STATUSES = new Set(['not_completed', 'success', 'failed'])

function badRequest(message) {
  const error = new Error(message)
  error.statusCode = 400
  error.expose = true
  return error
}

function parsePositiveInteger(value, fallback) {
  if (value === undefined) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) throw badRequest('分页参数无效')
  return parsed
}

function validateStatus(value, allowed, message) {
  if (value !== undefined && !allowed.has(value)) throw badRequest(message)
}

async function listInvoices(query = {}) {
  const page = parsePositiveInteger(query.page, 1)
  const pageSize = Math.min(parsePositiveInteger(query.pageSize, 20), 100)
  const qualificationStatus = query.qualificationStatus || undefined
  const financeStatus = query.financeStatus || undefined
  const reimbursementStatus = query.reimbursementStatus || undefined
  const sellerName = typeof query.sellerName === 'string' ? query.sellerName.trim() : undefined
  const invoiceNumber = typeof query.invoiceNumber === 'string' ? query.invoiceNumber.trim() : undefined
  validateStatus(qualificationStatus, QUALIFICATION_STATUSES, '资质审核状态无效')
  validateStatus(financeStatus, FINANCE_STATUSES, '财务提交状态无效')
  validateStatus(reimbursementStatus, REIMBURSEMENT_STATUSES, '报销状态无效')
  const result = await invoiceRepository.findPage({
    page,
    pageSize,
    qualificationStatus,
    financeStatus,
    reimbursementStatus,
    sellerName,
    invoiceNumber,
  })
  return {
    items: result.rows.map((row) => ({
      id: row.id,
      invoiceNumber: row.invoice_number,
      invoiceDate: row.invoice_date,
      sellerName: row.seller_name,
      sellerTaxId: row.seller_tax_id,
      totalAmount: row.total_amount,
      submittedAt: row.submitted_at,
      qualificationStatus: row.qualification_status,
      qualificationReason: row.qualification_reason,
      cumulativeAmount: row.cumulative_amount,
      cumulativeWeekStart: row.cumulative_week_start,
      financeStatus: row.finance_status,
      reimbursementStatus: row.reimbursement_status,
      sourceBatchId: row.source_batch_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      file: row.file_id
        ? {
            id: row.file_id,
            originalName: row.original_name,
            extractionStatus: row.extraction_status,
            extractionError: row.extraction_error,
          }
        : null,
    })),
    pagination: {
      page,
      pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / pageSize),
    },
  }
}

module.exports = { listInvoices }
