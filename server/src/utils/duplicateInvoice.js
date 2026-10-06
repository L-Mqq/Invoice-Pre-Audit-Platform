const DUPLICATE_REASON_PREFIX = '【疑似重复】'

function buildSuspectedDuplicateReason({
  duplicateInvoiceId,
}) {
  return `${DUPLICATE_REASON_PREFIX}与发票 #${duplicateInvoiceId} 疑似重复：销售方纳税人识别号、发票号码一致`
}

function isSuspectedDuplicateReason(reason) {
  return typeof reason === 'string'
    && reason.startsWith(DUPLICATE_REASON_PREFIX)
}

function getSuspectedDuplicateInvoiceId(reason) {
  if (!isSuspectedDuplicateReason(reason)) {
    return null
  }

  const match = reason.match(/与发票 #(\d+) 疑似重复/)

  return match ? Number(match[1]) : null
}

module.exports = {
  DUPLICATE_REASON_PREFIX,
  buildSuspectedDuplicateReason,
  isSuspectedDuplicateReason,
  getSuspectedDuplicateInvoiceId,
}
