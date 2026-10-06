const qualificationStatusLabels: Record<string, string> = {
  pending: '待审核',
  pending_voucher: '待补凭证',
  pending_manual: '待人工处理',
  approved: '审核通过',
  rejected: '审核不通过',
  cancelled: '已取消',
}

const preAuditStatusLabels: Record<string, string> = {
  pending: '待审核',
  pending_voucher: '待补凭证',
  pending_weekly_voucher: '待补凭证（周累计）',
  waiting_group_vouchers: '组内凭证待完成',
  pending_manual: '待人工处理',
  approved: '审核通过',
  rejected: '审核不通过',
  cancelled: '已取消',
}

const financeStatusLabels: Record<string, string> = {
  not_submitted: '未提交',
  submitted: '已提交',
}

const reimbursementStatusLabels: Record<string, string> = {
  not_completed: '未完成',
  success: '报销成功',
  failed: '报销失败',
}

const extractionStatusLabels: Record<string, string> = {
  pending: '处理中',
  success: '已完成',
  failed: '处理失败',
}

const extractionStatusTypes: Record<string, 'warning' | 'success' | 'danger'> = {
  pending: 'warning',
  success: 'success',
  failed: 'danger',
}

const suspectedDuplicateReasonPrefix = '【疑似重复】'

function getStatusLabel(
  labels: Record<string, string>,
  value: string | null | undefined,
) {
  if (!value) return '未知'
  return labels[value] || value
}

export function getQualificationStatusLabel(
  value: string | null | undefined,
) {
  return getStatusLabel(qualificationStatusLabels, value)
}

export function getPreAuditStatusLabel(
  value: string | null | undefined,
) {
  return getStatusLabel(preAuditStatusLabels, value)
}

export function getFinanceStatusLabel(
  value: string | null | undefined,
) {
  return getStatusLabel(financeStatusLabels, value)
}

export function getReimbursementStatusLabel(
  value: string | null | undefined,
) {
  return getStatusLabel(reimbursementStatusLabels, value)
}

export function getExtractionStatusLabel(
  value: string | null | undefined,
) {
  return getStatusLabel(extractionStatusLabels, value)
}

export function getExtractionStatusType(
  value: string | null | undefined,
) {
  if (!value) {
    return 'info'
  }

  return extractionStatusTypes[value] || 'info'
}

export function isSuspectedDuplicateInvoice(
  qualificationReason: string | null | undefined,
) {
  return typeof qualificationReason === 'string'
    && qualificationReason.startsWith(suspectedDuplicateReasonPrefix)
}

export function getSuspectedDuplicateInvoiceId(
  qualificationReason: string | null | undefined,
) {
  if (!isSuspectedDuplicateInvoice(qualificationReason)) {
    return null
  }

  const reason = qualificationReason || ''
  const match = reason.match(/与发票 #(\d+) 疑似重复/)

  return match ? Number(match[1]) : null
}
