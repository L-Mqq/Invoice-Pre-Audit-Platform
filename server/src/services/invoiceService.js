const invoiceRepository = require('../repositories/invoiceRepository')
const invoiceFileRepository = require('../repositories/invoiceFileRepository')
const {
  getPreAuditStatus,
  getPreAuditStatusReason,
} = require('../utils/preAuditStatus')
const {
  getManualProcessingContext,
} = require('./invoiceDataValidationService')

const QUALIFICATION_STATUSES = new Set([
  'pending',
  'pending_voucher',
  'pending_manual',
  'approved',
  'rejected',
  'cancelled',
])
const PRE_AUDIT_STATUSES = new Set([
  'pending',
  'pending_voucher',
  'pending_weekly_voucher',
  'waiting_group_vouchers',
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

function parseInvoiceId(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw badRequest('发票 ID 无效')
  }

  const invoiceId = Number(value)
  if (!Number.isSafeInteger(invoiceId) || invoiceId <= 0) {
    throw badRequest('发票 ID 无效')
  }

  return invoiceId
}

function notFound(message) {
  const error = new Error(message)
  error.statusCode = 404
  error.expose = true
  return error
}

async function listInvoices(query = {}) {
  const page = parsePositiveInteger(query.page, 1)
  const pageSize = Math.min(parsePositiveInteger(query.pageSize, 20), 100)
  const qualificationStatus = query.qualificationStatus || undefined
  const preAuditStatus = query.preAuditStatus || undefined
  const financeStatus = query.financeStatus || undefined
  const reimbursementStatus = query.reimbursementStatus || undefined
  const sellerName = typeof query.sellerName === 'string' ? query.sellerName.trim() : undefined
  const invoiceNumber = typeof query.invoiceNumber === 'string' ? query.invoiceNumber.trim() : undefined
  validateStatus(qualificationStatus, QUALIFICATION_STATUSES, '资质审核状态无效')
  validateStatus(preAuditStatus, PRE_AUDIT_STATUSES, '预审状态无效')
  validateStatus(financeStatus, FINANCE_STATUSES, '财务提交状态无效')
  validateStatus(reimbursementStatus, REIMBURSEMENT_STATUSES, '报销状态无效')
  const result = await invoiceRepository.findPage({
    page,
    pageSize,
    qualificationStatus,
    preAuditStatus,
    financeStatus,
    reimbursementStatus,
    sellerName,
    invoiceNumber,
  })
  return {
    items: result.rows.map((row) => {
      const weeklyVoucherStatus = row.pending_weekly_voucher_requirement_id
        ? Number(row.pending_weekly_voucher_approved) === 1
          ? 'approved'
          : 'pending'
        : null
      const preAuditStatus = getPreAuditStatus({
        qualificationStatus: row.qualification_status,
        weeklyVoucherStatus,
      })

      return {
        id: row.id,
        invoiceNumber: row.invoice_number,
        invoiceDate: row.invoice_date,
        sellerName: row.seller_name,
        sellerTaxId: row.seller_tax_id,
        totalAmount: row.total_amount,
        submittedAt: row.submitted_at,
        qualificationStatus: row.qualification_status,
        qualificationReason: row.qualification_reason,
        preAuditStatus,
        preAuditStatusReason: getPreAuditStatusReason({
          qualificationReason: row.qualification_reason,
          preAuditStatus,
        }),
        weeklyVoucherStatus: weeklyVoucherStatus || 'not_required',
        weeklyVoucherRequirementId: row.pending_weekly_voucher_requirement_id || null,
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
      }
    }),
    pagination: {
      page,
      pageSize,
      total: result.summary.total,
      totalPages: Math.ceil(result.summary.total / pageSize),
    },
    summary: result.summary,
  }
}

async function getInvoiceDetail(rawInvoiceId) {
  const invoiceId = parseInvoiceId(rawInvoiceId)
  const invoice = await invoiceRepository.findById(invoiceId)

  if (!invoice) {
    throw notFound('发票不存在')
  }

  const [items, files] = await Promise.all([
    invoiceRepository.findItemsByInvoiceId(invoiceId),
    invoiceFileRepository.findByInvoiceId(invoiceId),
  ])
  const manualProcessing = getManualProcessingContext({
    invoice,
    items,
  })

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoice_number,
    invoiceDate: invoice.invoice_date,
    sellerName: invoice.seller_name,
    sellerTaxId: invoice.seller_tax_id,
    totalAmount: invoice.total_amount,
    submittedAt: invoice.submitted_at,
    qualificationStatus: invoice.qualification_status,
    financeStatus: invoice.finance_status,
    reimbursementStatus: invoice.reimbursement_status,
    qualificationReason: invoice.qualification_reason,
    cumulativeAmount: invoice.cumulative_amount,
    cumulativeWeekStart: invoice.cumulative_week_start,
    sourceBatchId: invoice.source_batch_id,
    aiRawResult: invoice.ai_raw_result,
    manualNote: invoice.manual_note,
    completionRequired: manualProcessing.completionRequired,
    dataIssues: manualProcessing.dataIssues,
    manualProcessingType: manualProcessing.manualProcessingType,
    canManualCompleteData: manualProcessing.canManualCompleteData,
    canConfirmCategory: manualProcessing.canConfirmCategory,
    createdAt: invoice.created_at,
    updatedAt: invoice.updated_at,
    items: items.map((item) => ({
      id: item.id,
      invoiceId: item.invoice_id,
      itemName: item.item_name,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      priceType: item.price_type,
      lineAmount: item.line_amount,
      aiCategoryResult: item.ai_category_result,
      aiCategoryReason: item.ai_category_reason,
      manualCategoryResult: item.manual_category_result,
      manualCategoryReason: item.manual_category_reason,
      finalCategoryResult: item.final_category_result,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    })),
    files: files.map((file) => ({
      id: file.id,
      batchId: file.batch_id,
      invoiceId: file.invoice_id,
      originalName: file.original_name,
      mimeType: file.mime_type,
      fileSize: file.file_size,
      extractionStatus: file.extraction_status,
      extractionError: file.extraction_error,
      createdAt: file.created_at,
      updatedAt: file.updated_at,
    })),
  }
}

module.exports = {
  listInvoices,
  getInvoiceDetail,
}
