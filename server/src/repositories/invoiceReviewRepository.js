const { pool } = require('../config/database')

// 管理员审核商品品类
async function reviewItemCategory({ connection = pool, itemId, result, note, operatorId }) {
  await connection.beginTransaction()
  try {
    const [items] = await connection.execute(
      `SELECT ii.id, ii.invoice_id AS invoiceId, ii.item_name AS itemName,
              ii.final_category_result AS previousResult,
              ii.ai_category_reason AS aiCategoryReason,
              ii.manual_category_reason AS previousManualCategoryReason,
              i.qualification_status AS qualificationStatus,
              i.submitted_at AS submittedAt
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

    if (item.submittedAt) {
      const error = new Error('发票已提交审核，不能再修改商品品类')
      error.statusCode = 409
      error.expose = true
      throw error
    }

    if (
      item.qualificationStatus !== 'pending'
      && item.qualificationStatus !== 'pending_manual'
    ) {
      const error = new Error('当前发票状态不允许修改商品品类')
      error.statusCode = 409
      error.expose = true
      throw error
    }

    if (
      item.previousResult
      && item.previousResult !== '存疑'
    ) {
      const error = new Error('仅品类结果为“存疑”的商品允许人工确认')

      error.statusCode = 409
      error.expose = true

      throw error
    }

    await connection.execute(
      `UPDATE invoice_items
          SET manual_category_result = ?,
              manual_category_reason = ?,
              final_category_result = ?
        WHERE id = ?`,
      [
        result,
        note || '管理员人工确认',
        result,
        itemId,
      ],
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
    const qualificationStatus = invoiceResult === '不可以'
      ? 'rejected'
      : invoiceResult === '存疑'
        ? 'pending_manual'
        : 'pending'
    const reason = invoiceResult === '不可以'
      ? `商品“${item.itemName}”品类人工确认结果为不可以${note ? `：${note}` : ''}`
      : `管理员确认商品“${item.itemName}”为${result}${note ? `：${note}` : ''}`

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
      [
        operatorId,
        itemId,
        JSON.stringify({
          aiCategoryReason: item.aiCategoryReason,
          finalCategoryResult: item.previousResult,
          manualCategoryReason: item.previousManualCategoryReason,
        }),
        JSON.stringify({
          finalCategoryResult: result,
          manualCategoryReason: note || '管理员人工确认',
        }),
      ],
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
       finance_status,
       reimbursement_status,
       manual_note
     FROM invoices
     WHERE id = ?
     FOR UPDATE`,
    [invoiceId],
  )

  return rows[0] || null
}

// 查询发票级审核预览所需信息；预览不修改数据，因此不加行锁。
async function findInvoiceForQualificationPreview({
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
       finance_status,
       reimbursement_status,
       manual_note
     FROM invoices
     WHERE id = ?`,
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
       ai_category_reason,
       manual_category_reason,
       final_category_result
     FROM invoice_items
     WHERE invoice_id = ?
     ORDER BY id
     FOR UPDATE`,
    [invoiceId],
  )

  return rows
}

// 查询商品明细供审核预览使用；不加锁，正式审核时仍使用锁定查询。
async function findItemsForQualificationPreview({
  connection = pool,
  invoiceId,
}) {
  const [rows] = await connection.execute(
    `SELECT
       id,
       item_name,
       unit_price,
       price_type,
       ai_category_reason,
       manual_category_reason,
       final_category_result
     FROM invoice_items
     WHERE invoice_id = ?
     ORDER BY id`,
    [invoiceId],
  )

  return rows
}

// 锁定人工补全资料所需的发票字段；AI 原始结果不参与更新。
async function findInvoiceForManualCompletion({
  connection = pool,
  invoiceId,
}) {
  const [rows] = await connection.execute(
    `SELECT
       id,
       invoice_number,
       invoice_date,
       seller_name,
       seller_tax_id,
       total_amount,
       submitted_at,
       qualification_status,
       qualification_reason,
       finance_status,
       reimbursement_status,
       manual_note
     FROM invoices
     WHERE id = ?
     FOR UPDATE`,
    [invoiceId],
  )

  return rows[0] || null
}

// 锁定人工补全资料所需的商品明细，避免并发修改同一发票。
async function findItemsForManualCompletion({
  connection = pool,
  invoiceId,
}) {
  const [rows] = await connection.execute(
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
       final_category_result
     FROM invoice_items
     WHERE invoice_id = ?
     ORDER BY id
     FOR UPDATE`,
    [invoiceId],
  )

  return rows
}

async function updateInvoiceManualData({
  connection = pool,
  invoiceId,
  sellerName,
  sellerTaxId,
  invoiceDate,
  totalAmount,
  manualNote,
}) {
  await connection.execute(
    `UPDATE invoices
     SET seller_name = ?,
         seller_tax_id = ?,
         invoice_date = ?,
         total_amount = ?,
         manual_note = ?,
         cumulative_amount = NULL,
         cumulative_week_start = NULL
     WHERE id = ?`,
    [
      sellerName,
      sellerTaxId,
      invoiceDate,
      totalAmount,
      manualNote,
      invoiceId,
    ],
  )
}

async function updateItemManualData({
  connection = pool,
  itemId,
  itemName,
  quantity,
  unitPrice,
  priceType,
  lineAmount,
}) {
  await connection.execute(
    `UPDATE invoice_items
     SET item_name = ?,
         quantity = ?,
         unit_price = ?,
         price_type = ?,
         line_amount = ?,
         manual_category_result = NULL,
         manual_category_reason = NULL,
         final_category_result = NULL
     WHERE id = ?`,
    [
      itemName,
      quantity,
      unitPrice,
      priceType,
      lineAmount,
      itemId,
    ],
  )
}

async function createManualItemData({
  connection = pool,
  invoiceId,
  itemName,
  quantity,
  unitPrice,
  priceType,
  lineAmount,
}) {
  const [result] = await connection.execute(
    `INSERT INTO invoice_items
      (
        invoice_id,
        item_name,
        quantity,
        unit_price,
        price_type,
        line_amount
      )
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      invoiceId,
      itemName,
      quantity,
      unitPrice,
      priceType,
      lineAmount,
    ],
  )

  return result.insertId
}

async function updateManualCompletionState({
  connection = pool,
  invoiceId,
  qualificationStatus,
  qualificationReason,
}) {
  await connection.execute(
    `UPDATE invoices
     SET qualification_status = ?,
         qualification_reason = ?
     WHERE id = ?`,
    [
      qualificationStatus,
      qualificationReason,
      invoiceId,
    ],
  )
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

// 查询同周已审核通过发票供预览使用；正式审核时仍使用 FOR UPDATE。
async function findApprovedInvoicesForWeekPreview({
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
       AND id <> ?`,
    [sellerTaxId, weekStart, invoiceId],
  )

  return rows
}

// 锁定创建周累计凭证任务所涉及的既有已通过发票与当前触发发票。
async function findInvoicesForWeeklyVoucherRequirement({
  connection = pool,
  sellerTaxId,
  cumulativeWeekStart,
  triggerInvoiceId,
  forUpdate = true,
}) {
  const lockClause = forUpdate ? ' FOR UPDATE' : ''
  const [rows] = await connection.execute(
    `SELECT
       id,
       invoice_number,
       seller_tax_id,
       total_amount,
       submitted_at,
       qualification_status,
       finance_status,
       reimbursement_status,
       cumulative_amount,
       cumulative_week_start
     FROM invoices
     WHERE (
       seller_tax_id = ?
       AND cumulative_week_start = ?
       AND qualification_status = 'approved'
     )
       OR id = ?
     ORDER BY
       CASE
         WHEN id = ? THEN 1
         ELSE 0
       END,
       id${lockClause}`,
    [
      sellerTaxId,
      cumulativeWeekStart,
      triggerInvoiceId,
      triggerInvoiceId,
    ],
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
  operationType = 'qualification_review',
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
       ?,
       'invoice',
       ?,
       ?,
       ?
     )`,
    [
      operatorId,
      operationType,
      invoiceId,
      JSON.stringify(beforeData),
      JSON.stringify(afterData),
    ],
  )
}

module.exports = {
  reviewItemCategory,
  findInvoiceForQualificationReview,
  findInvoiceForQualificationPreview,
  findItemsForQualificationReview,
  findItemsForQualificationPreview,
  findInvoiceForManualCompletion,
  findItemsForManualCompletion,
  updateInvoiceManualData,
  updateItemManualData,
  createManualItemData,
  updateManualCompletionState,
  getWeekStart,
  findApprovedInvoicesForWeek,
  findApprovedInvoicesForWeekPreview,
  findInvoicesForWeeklyVoucherRequirement,
  updateInvoiceQualificationReview,
  createQualificationReviewLog,
}
