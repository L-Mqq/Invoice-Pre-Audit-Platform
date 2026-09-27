const { pool } = require('../config/database')

async function hasApprovedCompleteGroup({ connection = pool, invoiceId }) {
  const [rows] = await connection.execute(
    `SELECT 1
       FROM voucher_groups vg
      WHERE vg.invoice_id = ?
        AND vg.review_status = 'approved'
        AND EXISTS (
          SELECT 1 FROM vouchers v1
           WHERE v1.voucher_group_id = vg.id
             AND v1.voucher_type = 'order_screenshot'
        )
        AND EXISTS (
          SELECT 1 FROM vouchers v2
           WHERE v2.voucher_group_id = vg.id
             AND v2.voucher_type = 'payment_record'
        )
      LIMIT 1`,
    [invoiceId],
  )
  return rows.length > 0
}

module.exports = { hasApprovedCompleteGroup }
