const { pool } = require('../config/database')

function getPendingWeeklyVoucherJoin() {
  return `
    LEFT JOIN (
      SELECT
        wvri.invoice_id,
        MAX(wvr.id) AS requirement_id,
        MAX(
          CASE
            WHEN wvri.voucher_status = 'pending' THEN 1
            ELSE 0
          END
        ) AS has_pending_voucher
      FROM weekly_voucher_requirement_invoices wvri
      JOIN weekly_voucher_requirements wvr
        ON wvr.id = wvri.requirement_id
       AND wvr.status = 'pending'
      GROUP BY wvri.invoice_id
    ) pending_weekly_voucher
      ON pending_weekly_voucher.invoice_id = i.id
  `
}

function getTaskTypeExpression() {
  return `
    CASE
      WHEN i.qualification_status = 'pending_manual'
        THEN 'pending_manual'
      WHEN pending_weekly_voucher.has_pending_voucher = 1
        THEN 'pending_voucher'
      WHEN i.qualification_status = 'pending_voucher'
        THEN 'pending_voucher'
      WHEN i.qualification_status = 'pending'
       AND pending_weekly_voucher.requirement_id IS NULL
        THEN 'pending_review'
      ELSE NULL
    END
  `
}

async function getPendingSummary() {
  const pendingWeeklyVoucherJoin = getPendingWeeklyVoucherJoin()
  const taskTypeExpression = getTaskTypeExpression()
  const [rows] = await pool.execute(
    `SELECT
       COALESCE(SUM(${taskTypeExpression} = 'pending_review'), 0)
         AS pending_review_count,
       COALESCE(SUM(${taskTypeExpression} = 'pending_voucher'), 0)
         AS pending_voucher_count,
       COALESCE(SUM(${taskTypeExpression} = 'pending_manual'), 0)
         AS pending_manual_count
     FROM invoices i
     ${pendingWeeklyVoucherJoin}`,
  )

  return rows[0] || {}
}

async function findPriorityTasks({
  limit,
}) {
  const pendingWeeklyVoucherJoin = getPendingWeeklyVoucherJoin()
  const taskTypeExpression = getTaskTypeExpression()
  const [rows] = await pool.execute(
    `SELECT
       i.id,
       i.invoice_number,
       i.seller_name,
       i.total_amount,
       i.submitted_at,
       i.created_at,
       i.qualification_reason,
       ${taskTypeExpression} AS task_type,
       pending_weekly_voucher.has_pending_voucher
     FROM invoices i
     ${pendingWeeklyVoucherJoin}
     WHERE ${taskTypeExpression} IS NOT NULL
     ORDER BY
       CASE ${taskTypeExpression}
         WHEN 'pending_manual' THEN 1
         WHEN 'pending_voucher' THEN 2
         ELSE 3
       END,
       COALESCE(i.submitted_at, i.created_at) ASC,
       i.id ASC
     LIMIT ?`,
    [limit],
  )

  return rows
}

async function getExceptionCounts({
  suspectedDuplicateReasonPrefix,
}) {
  const [rows] = await pool.execute(
    `SELECT
       (
         SELECT COUNT(*)
         FROM invoices
         WHERE qualification_status = 'pending_manual'
           AND qualification_reason LIKE ?
       ) AS duplicate_count,
       (
         SELECT COUNT(DISTINCT invoice_id)
         FROM invoice_files
         WHERE extraction_status = 'failed'
       ) AS extraction_failed_count`,
    [`${suspectedDuplicateReasonPrefix}%`],
  )

  return rows[0] || {}
}

async function findPendingManualInvoices() {
  const [rows] = await pool.execute(
    `SELECT
       id,
       invoice_number,
       invoice_date,
       seller_name,
       seller_tax_id,
       total_amount,
       qualification_status,
       finance_status,
       reimbursement_status
     FROM invoices
     WHERE qualification_status = 'pending_manual'
     ORDER BY id`,
  )

  return rows
}

module.exports = {
  findPendingManualInvoices,
  findPriorityTasks,
  getExceptionCounts,
  getPendingSummary,
}
