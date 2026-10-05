const { pool } = require('../config/database')

// 锁定同一销售方、同一提交审核自然周内的全部发票，作为财务整组提交的判断范围。
async function findInvoicesForWeekSubmission({
  connection = pool,
  sellerTaxId,
  cumulativeWeekStart,
}) {
  const [rows] = await connection.execute(
    `SELECT
       id,
       invoice_number,
       total_amount,
       submitted_at,
       qualification_status,
       finance_status,
       reimbursement_status,
       DATE_FORMAT(cumulative_week_start, '%Y-%m-%d') AS cumulative_week_start
     FROM invoices
     WHERE seller_tax_id = ?
       AND submitted_at >= ?
       AND submitted_at < DATE_ADD(?, INTERVAL 7 DAY)
     ORDER BY submitted_at, id
     FOR UPDATE`,
    [
      sellerTaxId,
      cumulativeWeekStart,
      cumulativeWeekStart,
    ],
  )

  return rows
}

// 查询当前自然周是否仍存在未完成的周累计凭证补齐任务。
async function findPendingWeeklyVoucherRequirement({
  connection = pool,
  sellerTaxId,
  cumulativeWeekStart,
}) {
  const [rows] = await connection.execute(
    `SELECT
       id,
       triggered_cumulative_amount
     FROM weekly_voucher_requirements
     WHERE seller_tax_id = ?
       AND cumulative_week_start = ?
       AND status = 'pending'
     FOR UPDATE`,
    [
      sellerTaxId,
      cumulativeWeekStart,
    ],
  )

  return rows[0] || null
}

// 查询报销进度页所需的发票数据，自然周以提交审核时间为准。
async function findInvoicesForFinanceWeekList({
  connection = pool,
  sellerKeyword,
  cumulativeWeekStart,
}) {
  const conditions = [
    'i.seller_tax_id IS NOT NULL',
    'i.submitted_at IS NOT NULL',
  ]
  const params = []

  if (sellerKeyword) {
    conditions.push('(i.seller_name LIKE ? OR i.seller_tax_id LIKE ?)')
    params.push(`%${sellerKeyword}%`)
    params.push(`%${sellerKeyword}%`)
  }

  if (cumulativeWeekStart) {
    conditions.push('i.submitted_at >= ?')
    conditions.push('i.submitted_at < DATE_ADD(?, INTERVAL 7 DAY)')
    params.push(cumulativeWeekStart)
    params.push(cumulativeWeekStart)
  }

  const [rows] = await connection.execute(
    `SELECT
       i.id,
       i.seller_name,
       i.seller_tax_id,
       i.total_amount,
       i.qualification_status,
       i.finance_status,
       i.reimbursement_status,
       DATE_FORMAT(i.cumulative_week_start, '%Y-%m-%d') AS cumulative_week_start,
       DATE_FORMAT(
         DATE_SUB(DATE(i.submitted_at), INTERVAL WEEKDAY(i.submitted_at) DAY),
         '%Y-%m-%d'
       ) AS submitted_week_start
     FROM invoices i
     WHERE ${conditions.join('\n       AND ')}
     ORDER BY i.submitted_at DESC, i.id DESC`,
    params,
  )

  return rows
}

// 查询自然周累计凭证任务的进行中进度及已完成标记。
async function findWeeklyVoucherProgress({
  connection = pool,
} = {}) {
  const [rows] = await connection.execute(
    `SELECT
       wvr.seller_tax_id,
       DATE_FORMAT(wvr.cumulative_week_start, '%Y-%m-%d') AS cumulative_week_start,
       SUM(
         CASE
           WHEN wvr.status = 'pending' AND wvri.id IS NOT NULL THEN 1
           ELSE 0
         END
       ) AS required_invoice_count,
       SUM(
         CASE
           WHEN wvr.status = 'pending' AND wvri.voucher_status = 'approved' THEN 1
           ELSE 0
         END
       ) AS approved_invoice_count,
       MAX(
         CASE
           WHEN wvr.status = 'pending' THEN wvr.triggered_cumulative_amount
           ELSE NULL
         END
       ) AS pending_triggered_cumulative_amount,
       MAX(wvr.status = 'pending') AS has_pending_requirement,
       MAX(wvr.status = 'completed') AS has_completed_requirement
     FROM weekly_voucher_requirements wvr
     LEFT JOIN weekly_voucher_requirement_invoices wvri
       ON wvri.requirement_id = wvr.id
     WHERE wvr.status IN ('pending', 'completed')
     GROUP BY
       wvr.seller_tax_id,
       wvr.cumulative_week_start`,
  )

  return rows
}

// 查询指定销售方和自然周内的发票，并取得凭证状态判断所需的原始信息。
async function findInvoicesForFinanceWeekDetail({
  connection = pool,
  sellerTaxId,
  cumulativeWeekStart,
}) {
  const [rows] = await connection.execute(
    `SELECT
       i.id,
       i.invoice_number,
       i.total_amount,
       i.submitted_at,
       i.qualification_status,
       i.qualification_reason,
       i.finance_status,
       i.reimbursement_status,
       pending_requirement_invoice.voucher_status AS weekly_voucher_status,
       latest_voucher_group.review_status AS latest_voucher_review_status,
       EXISTS(
         SELECT 1
         FROM voucher_groups approved_group
         JOIN vouchers approved_voucher
           ON approved_voucher.voucher_group_id = approved_group.id
         WHERE approved_group.invoice_id = i.id
           AND approved_group.review_status = 'approved'
         GROUP BY approved_group.id
         HAVING COUNT(DISTINCT approved_voucher.voucher_type) = 2
       ) AS has_approved_complete_voucher_group
     FROM invoices i
     LEFT JOIN weekly_voucher_requirement_invoices pending_requirement_invoice
       ON pending_requirement_invoice.invoice_id = i.id
       AND pending_requirement_invoice.requirement_id = (
         SELECT pending_requirement.id
         FROM weekly_voucher_requirements pending_requirement
         WHERE pending_requirement.seller_tax_id = ?
           AND pending_requirement.cumulative_week_start = ?
           AND pending_requirement.status = 'pending'
         LIMIT 1
       )
     LEFT JOIN voucher_groups latest_voucher_group
       ON latest_voucher_group.id = (
         SELECT latest_group.id
         FROM voucher_groups latest_group
         WHERE latest_group.invoice_id = i.id
         ORDER BY latest_group.id DESC
         LIMIT 1
       )
     WHERE i.seller_tax_id = ?
       AND i.submitted_at >= ?
       AND i.submitted_at < DATE_ADD(?, INTERVAL 7 DAY)
     ORDER BY i.submitted_at ASC, i.id ASC`,
    [
      sellerTaxId,
      cumulativeWeekStart,
      sellerTaxId,
      cumulativeWeekStart,
      cumulativeWeekStart,
    ],
  )

  return rows
}

// 事务内将同一财务提交组的所有合格发票标记为已提交财务。
async function markInvoicesAsFinanceSubmitted({
  connection = pool,
  invoiceIds,
}) {
  if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
    return
  }

  const placeholders = invoiceIds.map(() => '?').join(', ')

  await connection.execute(
    `UPDATE invoices
     SET finance_status = 'submitted'
     WHERE id IN (${placeholders})
       AND qualification_status = 'approved'
       AND finance_status = 'not_submitted'
       AND reimbursement_status = 'not_completed'`,
    invoiceIds,
  )
}

// 每张发票均保留财务提交状态变更记录，便于后续按发票追溯。
async function createFinanceSubmissionLogs({
  connection = pool,
  operatorId,
  invoices,
  sellerTaxId,
  cumulativeWeekStart,
}) {
  for (const invoice of invoices) {
    const beforeData = {
      qualificationStatus: invoice.qualification_status,
      financeStatus: invoice.finance_status,
      reimbursementStatus: invoice.reimbursement_status,
    }
    const afterData = {
      qualificationStatus: invoice.qualification_status,
      financeStatus: 'submitted',
      reimbursementStatus: invoice.reimbursement_status,
      sellerTaxId,
      cumulativeWeekStart,
      groupInvoiceCount: invoices.length,
    }

    await connection.execute(
      `INSERT INTO operation_logs
        (
          operator_id,
          operation_type,
          resource_type,
          resource_id,
          before_data,
          after_data
        )
       VALUES (?, 'submit_finance_week', 'invoice', ?, ?, ?)`,
      [
        operatorId,
        invoice.id,
        JSON.stringify(beforeData),
        JSON.stringify(afterData),
      ],
    )
  }
}

// 更新最终报销状态前锁定发票，避免重复处理同一报销结果。
async function findInvoiceForReimbursementUpdate({
  connection = pool,
  invoiceId,
}) {
  const [rows] = await connection.execute(
    `SELECT
       id,
       invoice_number,
       qualification_status,
       finance_status,
       reimbursement_status
     FROM invoices
     WHERE id = ?
     FOR UPDATE`,
    [invoiceId],
  )

  return rows[0] || null
}

// 仅允许处于未完成状态的发票写入最终报销结果。
async function updateReimbursementStatus({
  connection = pool,
  invoiceId,
  reimbursementStatus,
}) {
  const [result] = await connection.execute(
    `UPDATE invoices
     SET reimbursement_status = ?
     WHERE id = ?
       AND qualification_status = 'approved'
       AND finance_status = 'submitted'
       AND reimbursement_status = 'not_completed'`,
    [
      reimbursementStatus,
      invoiceId,
    ],
  )

  return result.affectedRows
}

// 最终报销结果变更必须单独保留可追溯日志。
async function createReimbursementStatusLog({
  connection = pool,
  operatorId,
  invoice,
  reimbursementStatus,
}) {
  const beforeData = {
    qualificationStatus: invoice.qualification_status,
    financeStatus: invoice.finance_status,
    reimbursementStatus: invoice.reimbursement_status,
  }
  const afterData = {
    qualificationStatus: invoice.qualification_status,
    financeStatus: invoice.finance_status,
    reimbursementStatus,
  }

  await connection.execute(
    `INSERT INTO operation_logs
      (
        operator_id,
        operation_type,
        resource_type,
        resource_id,
        before_data,
        after_data
      )
     VALUES (?, 'update_reimbursement_status', 'invoice', ?, ?, ?)`,
    [
      operatorId,
      invoice.id,
      JSON.stringify(beforeData),
      JSON.stringify(afterData),
    ],
  )
}

module.exports = {
  findInvoicesForWeekSubmission,
  findPendingWeeklyVoucherRequirement,
  findInvoicesForFinanceWeekList,
  findWeeklyVoucherProgress,
  findInvoicesForFinanceWeekDetail,
  markInvoicesAsFinanceSubmitted,
  createFinanceSubmissionLogs,
  findInvoiceForReimbursementUpdate,
  updateReimbursementStatus,
  createReimbursementStatusLog,
}
