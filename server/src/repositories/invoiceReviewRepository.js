const { pool } = require('../config/database')

// 管理员审核商品品类
async function reviewItemCategory({ connection = pool, itemId, result, note, operatorId }) {
  await connection.beginTransaction()
  try {
    const [items] = await connection.execute(
      `SELECT ii.id, ii.invoice_id AS invoiceId, ii.item_name AS itemName,
              ii.final_category_result AS previousResult,
              i.qualification_status AS qualificationStatus
         FROM invoice_items ii
         JOIN invoices i ON i.id = ii.invoice_id
        WHERE ii.id = ?
        FOR UPDATE`,
      [itemId],
    )
    const item = items[0]
    if (!item) {
      const error = new Error('商品明细不存在')
      error.statusCode = 404
      error.expose = true
      throw error
    }

    await connection.execute(
      `UPDATE invoice_items
          SET manual_category_result = ?, final_category_result = ?, category_reason = ?
        WHERE id = ?`,
      [result, result, note || '管理员人工确认', itemId],
    )

    const [summary] = await connection.execute(
      `SELECT
          SUM(final_category_result = '不可以') AS rejectedCount,
          SUM(final_category_result = '存疑') AS uncertainCount,
          COUNT(*) AS totalCount,
          SUM(final_category_result = '可以') AS approvedCount
         FROM invoice_items
        WHERE invoice_id = ?`,
      [item.invoiceId],
    )
    const totals = summary[0]
    const invoiceResult = Number(totals.rejectedCount) > 0
      ? '不可以'
      : Number(totals.uncertainCount) > 0
        ? '存疑'
        : Number(totals.totalCount) > 0 && Number(totals.approvedCount) === Number(totals.totalCount)
          ? '可以'
          : '存疑'
    const qualificationStatus = invoiceResult === '可以' ? 'pending' : 'pending_manual'
    const reason = `管理员确认商品“${item.itemName}”为${result}${note ? `：${note}` : ''}`

    await connection.execute(
      `UPDATE invoices
          SET qualification_status = ?, qualification_reason = ?
        WHERE id = ?`,
      [qualificationStatus, reason, item.invoiceId],
    )
    await connection.execute(
      `INSERT INTO operation_logs
        (operator_id, operation_type, resource_type, resource_id, before_data, after_data)
       VALUES (?, 'manual_category_review', 'invoice_item', ?, ?, ?)`,
      [operatorId, itemId, JSON.stringify({ finalCategoryResult: item.previousResult }), JSON.stringify({ finalCategoryResult: result, note: note || null })],
    )

    await connection.commit()
    return { itemId, invoiceId: item.invoiceId, itemName: item.itemName, result, invoiceResult, qualificationStatus }
  } catch (error) {
    await connection.rollback()
    throw error
  }
}

// 查发票级信息
async function findInvoiceForQualificationReview({
  connection = pool,
  invoiceId,
}) {
  const [rows] = await connection.execute(
    `SELECT
       id,
       seller_tax_id,
       total_amount,
       submitted_at,
       qualification_status,
       qualification_reason,
       cumulative_amount,
       cumulative_week_start,
       manual_note
     FROM invoices
     WHERE id = ?
     FOR UPDATE`,
    [invoiceId],
  )

  return rows[0] || null
}

// 查商品级信息
async function findItemsForQualificationReview({
  connection = pool,
  invoiceId,
}) {
  const [rows] = await connection.execute(
    `SELECT
       id,
       item_name,
       unit_price,
       price_type,
       final_category_result,
       category_reason
     FROM invoice_items
     WHERE invoice_id = ?
     ORDER BY id
     FOR UPDATE`,
    [invoiceId],
  )

  return rows
}

// 算出一个日期所在自然周的「周一」日期
async function getWeekStart({
  connection = pool,
  date,
}) {
  const [rows] = await connection.execute(
    `SELECT DATE_SUB(
       DATE(?),
       INTERVAL WEEKDAY(DATE(?)) DAY
     ) AS week_start`,
    [date, date],
  )

  return rows[0].week_start
}

// 查出同一销售方 同一自然周 已审核通过的发票
async function findApprovedInvoicesForWeek({
  connection = pool,
  invoiceId,
  sellerTaxId,
  weekStart,
}) {
  const [rows] = await connection.execute(
    `SELECT
       id,
       total_amount
     FROM invoices
     WHERE seller_tax_id = ?
       AND cumulative_week_start = ?
       AND qualification_status = 'approved'
       AND id <> ?
     FOR UPDATE`,
    [sellerTaxId, weekStart, invoiceId],
  )

  return rows
}

// 更新发票资质审核状态
async function updateInvoiceQualificationReview({
  connection = pool,
  invoiceId,
  qualificationStatus,
  qualificationReason,
  cumulativeAmount,
  cumulativeWeekStart,
  submittedAt,
  manualNote,
}) {
  await connection.execute(
    `UPDATE invoices
     SET qualification_status = ?,
         qualification_reason = ?,
         cumulative_amount = ?,
         cumulative_week_start = ?,
         submitted_at = CASE
           WHEN ? IS NULL THEN submitted_at
           ELSE COALESCE(submitted_at, ?)
         END,
         manual_note = ?
     WHERE id = ?`,
    [
      qualificationStatus,
      qualificationReason,
      cumulativeAmount,
      cumulativeWeekStart,
      submittedAt,
      submittedAt,
      manualNote,
      invoiceId,
    ],
  )
}

// 插入一条操作日志
async function createQualificationReviewLog({
  connection = pool,
  operatorId,
  invoiceId,
  beforeData,
  afterData,
}) {
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
     VALUES (
       ?,
       'qualification_review',
       'invoice',
       ?,
       ?,
       ?
     )`,
    [
      operatorId,
      invoiceId,
      JSON.stringify(beforeData),
      JSON.stringify(afterData),
    ],
  )
}

module.exports = {
  reviewItemCategory,
  findInvoiceForQualificationReview,
  findItemsForQualificationReview,
  getWeekStart,
  findApprovedInvoicesForWeek,
  updateInvoiceQualificationReview,
  createQualificationReviewLog,
}
