const { pool } = require('../config/database')

// 上传后写入草稿
async function createDraft({ connection = pool, sourceBatchId, createdBy = null }) {
  const [result] = await connection.execute(
    `INSERT INTO invoices
      (total_amount, qualification_status, source_batch_id, created_by)
     VALUES (0, 'pending_manual', ?, ?)`,
    [sourceBatchId, createdBy],
  )
  return { id: result.insertId, sourceBatchId, createdBy }
}

// 更新解析后的内容
async function updateExtractionResult({ connection = pool, id, data, rawResult, valid, errors }) {
  const normalizeDate = (value) => {
    if (typeof value !== 'string') return null
    const match = value.trim().match(/^(\d{4})[年./-](\d{1,2})[月./-](\d{1,2})日?$/)
    return match ? `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}` : null
  }
  const amount = Number(String(data.totalAmount ?? '').replace(/[￥¥元,，\s]/g, ''))
  await connection.execute(
    `UPDATE invoices SET
      invoice_number = ?, invoice_date = ?, seller_name = ?, seller_tax_id = ?,
      total_amount = ?, qualification_status = ?, qualification_reason = ?, ai_raw_result = ?
     WHERE id = ?`,
    [
      data.invoiceNumber || null,
      normalizeDate(data.invoiceDate),
      data.sellerName || null,
      data.sellerTaxId || null,
      Number.isFinite(amount) ? amount : 0,
      valid ? 'pending' : 'pending_manual',
      errors.length ? JSON.stringify(errors) : null,
      rawResult ? JSON.stringify(rawResult) : null,
      id,
    ],
  )
}

// 创建关联商品
async function createItems({ connection = pool, invoiceId, items }) {
  const createdItems = []
  for (const item of items) {
    const [result] = await connection.execute(
      `INSERT INTO invoice_items
        (invoice_id, item_name, quantity, unit_price, line_amount)
       VALUES (?, ?, ?, ?, ?)`,
      [invoiceId, item.itemName, Number(item.quantity), Number(item.unitPrice), Number(item.amount)],
    )
    createdItems.push({ id: result.insertId, ...item })
  }
  return createdItems
}

// 新增按多个 invoiceId 批量查询商品明细；
async function findItemsByInvoiceIds(invoiceIds) {
  if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) return []
  const placeholders = invoiceIds.map(() => '?').join(', ')
  const [rows] = await pool.execute(
    `SELECT id, invoice_id, item_name, quantity, unit_price, price_type,
       line_amount, ai_category_result, ai_category_reason,
       manual_category_result, manual_category_reason,
       final_category_result, created_at, updated_at
     FROM invoice_items
     WHERE invoice_id IN (${placeholders})
     ORDER BY invoice_id, id`,
    invoiceIds,
  )
  return rows
}

function buildPageQuery({
  qualificationStatus,
  preAuditStatus,
  financeStatus,
  reimbursementStatus,
  sellerName,
  invoiceNumber,
}) {
  const conditions = []
  const params = []

  const pendingWeeklyVoucherJoin = `
    LEFT JOIN (
      SELECT
        wvri.invoice_id,
        MAX(wvr.id) AS requirement_id,
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
      ON pending_weekly_voucher.invoice_id = i.id`

  if (preAuditStatus === 'pending_weekly_voucher') {
    conditions.push(`
      i.qualification_status NOT IN ('cancelled', 'rejected', 'pending_manual')
      AND pending_weekly_voucher.requirement_id IS NOT NULL
      AND pending_weekly_voucher.voucher_approved = 0
    `)
  } else if (preAuditStatus === 'waiting_group_vouchers') {
    conditions.push(`
      i.qualification_status NOT IN ('cancelled', 'rejected', 'pending_manual')
      AND pending_weekly_voucher.requirement_id IS NOT NULL
      AND pending_weekly_voucher.voucher_approved = 1
    `)
  } else if (preAuditStatus) {
    if (
      preAuditStatus === 'cancelled'
      || preAuditStatus === 'rejected'
      || preAuditStatus === 'pending_manual'
    ) {
      conditions.push('i.qualification_status = ?')
    } else {
      conditions.push('pending_weekly_voucher.requirement_id IS NULL')
      conditions.push('i.qualification_status = ?')
    }

    params.push(preAuditStatus)
  }
  if (qualificationStatus) {
    conditions.push('i.qualification_status = ?')
    params.push(qualificationStatus)
  }
  if (financeStatus) {
    conditions.push('i.finance_status = ?')
    params.push(financeStatus)
  }
  if (reimbursementStatus) {
    conditions.push('i.reimbursement_status = ?')
    params.push(reimbursementStatus)
  }
  if (sellerName) {
    conditions.push('i.seller_name LIKE ?')
    params.push(`%${sellerName}%`)
  }
  if (invoiceNumber) {
    conditions.push('i.invoice_number LIKE ?')
    params.push(`%${invoiceNumber}%`)
  }

  return {
    pendingWeeklyVoucherJoin,
    params,
    whereClause: conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '',
  }
}

async function findPage({
  page,
  pageSize,
  qualificationStatus,
  preAuditStatus,
  financeStatus,
  reimbursementStatus,
  sellerName,
  invoiceNumber,
}) {
  const {
    pendingWeeklyVoucherJoin,
    params,
    whereClause,
  } = buildPageQuery({
    qualificationStatus,
    preAuditStatus,
    financeStatus,
    reimbursementStatus,
    sellerName,
    invoiceNumber,
  })
  const offset = (page - 1) * pageSize
  const preAuditStatusExpression = `
    CASE
      WHEN i.qualification_status IN ('cancelled', 'rejected', 'pending_manual')
        THEN i.qualification_status
      WHEN pending_weekly_voucher.requirement_id IS NOT NULL
       AND pending_weekly_voucher.voucher_approved = 1
        THEN 'waiting_group_vouchers'
      WHEN pending_weekly_voucher.requirement_id IS NOT NULL
        THEN 'pending_weekly_voucher'
      ELSE i.qualification_status
    END
  `
  const [summaryRows] = await pool.execute(
    `SELECT
       COUNT(*) AS total,
       COALESCE(SUM(
         CASE
           WHEN ${preAuditStatusExpression} IN (
             'pending_voucher',
             'pending_weekly_voucher',
             'waiting_group_vouchers'
           ) THEN 1
           ELSE 0
         END
       ), 0) AS pending_voucher_count,
       COALESCE(SUM(
         CASE
           WHEN ${preAuditStatusExpression} IN ('pending', 'pending_manual') THEN 1
           ELSE 0
         END
       ), 0) AS pending_count,
       COALESCE(SUM(
         CASE
           WHEN ${preAuditStatusExpression} = 'approved' THEN 1
           ELSE 0
         END
       ), 0) AS approved_count
     FROM invoices i
     ${pendingWeeklyVoucherJoin}
     ${whereClause}`,
    params,
  )
  const [rows] = await pool.execute(
    `SELECT
       i.id,
       i.invoice_number,
       i.invoice_date,
       i.seller_name,
       i.seller_tax_id,
       i.total_amount,
       i.submitted_at,
       i.qualification_status,
       i.qualification_reason,
       i.cumulative_amount,
       i.cumulative_week_start,
       i.finance_status,
       i.reimbursement_status,
       i.source_batch_id,
       i.created_at,
       i.updated_at,
       pending_weekly_voucher.requirement_id AS pending_weekly_voucher_requirement_id,
       pending_weekly_voucher.voucher_approved AS pending_weekly_voucher_approved,
       f.id AS file_id,
       f.original_name,
       f.extraction_status,
       f.extraction_error
     FROM invoices i
     ${pendingWeeklyVoucherJoin}
     LEFT JOIN invoice_files f ON f.invoice_id = i.id
     ${whereClause}
     ORDER BY i.created_at DESC, i.id DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  )

  const summaryRow = summaryRows[0] || {}

  return {
    rows,
    summary: {
      total: Number(summaryRow.total || 0),
      pendingVoucherCount: Number(summaryRow.pending_voucher_count || 0),
      pendingCount: Number(summaryRow.pending_count || 0),
      approvedCount: Number(summaryRow.approved_count || 0),
    },
  }
}

async function findById(invoiceId) {
  const [rows] = await pool.execute(
    `SELECT
       i.id,
       i.invoice_number,
       i.invoice_date,
       i.seller_name,
       i.seller_tax_id,
       i.total_amount,
       i.submitted_at,
       i.qualification_status,
       i.finance_status,
       i.reimbursement_status,
       i.qualification_reason,
       i.cumulative_amount,
       i.cumulative_week_start,
       i.source_batch_id,
       i.ai_raw_result,
       i.manual_note,
       i.created_at,
       i.updated_at
     FROM invoices i
     WHERE i.id = ?`,
    [invoiceId],
  )

  return rows[0] || null
}

async function findItemsByInvoiceId(invoiceId) {
  const [rows] = await pool.execute(
    `SELECT
       id,
       invoice_id,
       item_name,
       quantity,
       unit_price,
       price_type,
       line_amount,
       ai_category_result,
       ai_category_reason,
       manual_category_result,
       manual_category_reason,
       final_category_result,
       created_at,
       updated_at
     FROM invoice_items
     WHERE invoice_id = ?
     ORDER BY id`,
    [invoiceId],
  )

  return rows
}

async function updateQualificationByCategory({ connection = pool, id, categoryResult, reason }) {
  if (categoryResult === '可以') {
    return
  }

  const qualificationStatus = categoryResult === '不可以'
    ? 'rejected'
    : 'pending_manual'

  await connection.execute(
    `UPDATE invoices
        SET qualification_status = ?, qualification_reason = ?
      WHERE id = ?`,
    [qualificationStatus, reason, id],
  )
}

async function updateItemPriceType({ connection = pool, itemId, priceType }) {
  await connection.execute(
    `UPDATE invoice_items
        SET price_type = ?
      WHERE id = ?`,
    [priceType, itemId],
  )
}

async function updateQualificationByPrice({ connection = pool, id, priceResult, reason }) {
  if (priceResult === 'asset') {
    await connection.execute(
      `UPDATE invoices
          SET qualification_status = 'rejected', qualification_reason = ?
        WHERE id = ?`,
      [reason, id],
    )
  } else if (priceResult === 'invalid') {
    await connection.execute(
      `UPDATE invoices
          SET qualification_status = 'pending_manual', qualification_reason = ?
        WHERE id = ? AND qualification_status <> 'rejected'`,
      [reason, id],
    )
  } else if (priceResult === 'low_value') {
    await connection.execute(
      `UPDATE invoices
          SET qualification_status = 'pending_voucher', qualification_reason = ?
        WHERE id = ? AND qualification_status = 'pending'`,
      [reason, id],
    )
  }
}

// 校验失败转人工
async function markExtractionFailure({ connection = pool, id, error }) {
  await connection.execute(
    `UPDATE invoices SET qualification_status = 'pending_manual', qualification_reason = ? WHERE id = ?`,
    [error, id],
  )
}

module.exports = {
  createDraft,
  updateExtractionResult,
  createItems,
  findItemsByInvoiceIds,
  findPage,
  findById,
  findItemsByInvoiceId,
  updateQualificationByCategory,
  updateItemPriceType,
  updateQualificationByPrice,
  markExtractionFailure,
}
