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

async function updateQualificationByCategory({ connection = pool, id, categoryResult, reason }) {
  if (categoryResult === '可以') return
  await connection.execute(
    `UPDATE invoices
        SET qualification_status = 'pending_manual', qualification_reason = ?
      WHERE id = ?`,
    [reason, id],
  )
}

// 校验失败转人工
async function markExtractionFailure({ connection = pool, id, error }) {
  await connection.execute(
    `UPDATE invoices SET qualification_status = 'pending_manual', qualification_reason = ? WHERE id = ?`,
    [error, id],
  )
}

module.exports = { createDraft, updateExtractionResult, createItems, updateQualificationByCategory, markExtractionFailure }
