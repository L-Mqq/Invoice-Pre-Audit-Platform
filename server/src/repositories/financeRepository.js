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

module.exports = {
  findInvoicesForWeekSubmission,
  findPendingWeeklyVoucherRequirement,
  markInvoicesAsFinanceSubmitted,
  createFinanceSubmissionLogs,
}
