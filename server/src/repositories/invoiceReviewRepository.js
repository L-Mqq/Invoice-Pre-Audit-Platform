const { pool } = require('../config/database')

// 管理员结果
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

module.exports = { reviewItemCategory }
