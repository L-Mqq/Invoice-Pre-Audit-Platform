const { pool } = require('../config/database')

async function getCurrentWeekInvoiceSummary({
  weekStart,
}) {
  const [rows] = await pool.execute(
    `SELECT
       COUNT(*) AS invoice_count,
       COALESCE(SUM(i.total_amount), 0) AS invoice_amount,
       COALESCE(SUM(
         CASE
           WHEN i.qualification_status = 'pending'
            AND pending_weekly_voucher.invoice_id IS NULL THEN 1
           ELSE 0
         END
       ), 0) AS pending_review_count,
       COALESCE(SUM(
         CASE
           WHEN pending_weekly_voucher.invoice_id IS NULL
            AND i.qualification_status = 'pending_voucher' THEN 1
           WHEN pending_weekly_voucher.invoice_id IS NOT NULL
            AND pending_weekly_voucher.voucher_approved = 0 THEN 1
           ELSE 0
         END
       ), 0) AS pending_voucher_count,
       COALESCE(SUM(
         CASE
           WHEN pending_weekly_voucher.invoice_id IS NOT NULL
            AND pending_weekly_voucher.voucher_approved = 1 THEN 1
           ELSE 0
         END
       ), 0) AS waiting_group_vouchers_count,
       COALESCE(SUM(i.qualification_status = 'pending_manual'), 0) AS pending_manual_count,
       COALESCE(SUM(
         CASE
           WHEN i.qualification_status = 'approved'
            AND pending_weekly_voucher.invoice_id IS NULL THEN 1
           ELSE 0
         END
       ), 0) AS approved_count,
       COALESCE(SUM(i.qualification_status = 'rejected'), 0) AS rejected_count,
       COALESCE(SUM(i.qualification_status = 'cancelled'), 0) AS cancelled_count,
       COALESCE(SUM(i.reimbursement_status = 'failed'), 0) AS reimbursement_failed_count
     FROM invoices i
     LEFT JOIN (
       SELECT
         wvri.invoice_id,
         MIN(
           CASE
             WHEN wvri.voucher_status = 'approved' THEN 1
             ELSE 0
           END
         ) AS voucher_approved
       FROM weekly_voucher_requirement_invoices wvri
       JOIN weekly_voucher_requirements wvr
         ON wvr.id = wvri.requirement_id
        AND wvr.status = 'pending'
       GROUP BY wvri.invoice_id
     ) pending_weekly_voucher
       ON pending_weekly_voucher.invoice_id = i.id
     WHERE i.submitted_at >= ?
       AND i.submitted_at < DATE_ADD(?, INTERVAL 7 DAY)`,
    [
      weekStart,
      weekStart,
    ],
  )

  return rows[0] || {}
}

async function findRecentOperations({
  weekStart,
  limit,
}) {
  const [rows] = await pool.execute(
    `SELECT
       l.id,
       l.operation_type,
       l.resource_type,
       l.resource_id,
       l.operator_id,
       u.username AS operator_name,
       l.created_at
     FROM operation_logs l
     LEFT JOIN users u
       ON u.id = l.operator_id
     WHERE l.created_at >= ?
       AND l.created_at < DATE_ADD(?, INTERVAL 7 DAY)
     ORDER BY l.created_at DESC, l.id DESC
     LIMIT ?`,
    [
      weekStart,
      weekStart,
      limit,
    ],
  )

  return rows
}

module.exports = {
  findRecentOperations,
  getCurrentWeekInvoiceSummary,
}
