const {
  validateInvoiceExtraction,
} = require('../validators/invoiceExtractionValidator')


// 复用既有结构化校验规则，把当前数据库数据转换为 dataIssues。
function normalizeDateValue(value) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  return String(value).slice(0, 10)
}

function buildValidationInput({
  invoice,
  items,
}) {
  return {
    invoiceNumber: invoice.invoice_number,
    invoiceDate: normalizeDateValue(invoice.invoice_date),
    sellerName: invoice.seller_name,
    sellerTaxId: invoice.seller_tax_id,
    totalAmount: invoice.total_amount,
    items: items.map((item) => {
      return {
        itemName: item.item_name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        amount: item.line_amount,
      }
    }),
  }
}

function validateStoredInvoiceData({
  invoice,
  items,
}) {
  return validateInvoiceExtraction(
    buildValidationInput({
      invoice,
      items,
    }),
  )
}

function toDataIssues(errors) {
  return errors.map((error) => {
    const isItemIssue = error.field.startsWith('items.')
    const sourceField = isItemIssue
      ? error.field.replace(/^items\./, '')
      : error.field

    return {
      code: error.code,
      scope: isItemIssue ? 'item' : 'invoice',
      field: sourceField === 'amount'
        ? 'lineAmount'
        : sourceField,
      itemIndex: error.index,
      message: error.message,
    }
  })
}

function getDataIssueReason(dataIssues) {
  return `资料待补全：${dataIssues
    .map((issue) => {
      return issue.message
    })
    .join('；')}`
}

function getManualProcessingContext({
  invoice,
  items,
}) {
  const validation = validateStoredInvoiceData({
    invoice,
    items,
  })
  const dataIssues = toDataIssues(validation.errors).map((issue) => {
    if (issue.scope !== 'item' || issue.itemIndex === null) {
      return issue
    }

    return {
      ...issue,
      itemId: items[issue.itemIndex]?.id || null,
    }
  })
  const completionRequired = dataIssues.length > 0
  const isPendingManual = invoice.qualification_status === 'pending_manual'
  const canModifyData = invoice.finance_status === 'not_submitted'
    && invoice.reimbursement_status === 'not_completed'

  return {
    completionRequired,
    dataIssues,
    manualProcessingType: isPendingManual
      ? completionRequired
        ? 'data_completion'
        : 'category_confirmation'
      : null,
    canManualCompleteData: completionRequired
      && isPendingManual
      && canModifyData,
    canConfirmCategory: !completionRequired
      && isPendingManual
      && canModifyData,
  }
}

module.exports = {
  getManualProcessingContext,
  toDataIssues,
  getDataIssueReason,
  validateStoredInvoiceData,
}
