const TERMINAL_OR_MANUAL_QUALIFICATION_STATUSES = new Set([
  'cancelled',
  'rejected',
  'pending_manual',
])

function getPreAuditStatus({
  qualificationStatus,
  weeklyVoucherStatus = null,
}) {
  if (TERMINAL_OR_MANUAL_QUALIFICATION_STATUSES.has(qualificationStatus)) {
    return qualificationStatus
  }

  if (weeklyVoucherStatus === 'approved') {
    return 'waiting_group_vouchers'
  }

  if (weeklyVoucherStatus === 'pending') {
    return 'pending_weekly_voucher'
  }

  return qualificationStatus
}

function getPreAuditStatusReason({
  qualificationReason,
  preAuditStatus,
}) {
  if (preAuditStatus === 'pending_weekly_voucher') {
    return '资质审核已通过；本自然周累计超过 1000 元，需补齐支付凭证'
  }

  if (preAuditStatus === 'waiting_group_vouchers') {
    return '本票支付凭证已通过，等待组内其他关联发票完成凭证'
  }

  return qualificationReason
}

module.exports = {
  getPreAuditStatus,
  getPreAuditStatusReason,
}
