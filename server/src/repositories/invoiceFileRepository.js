const { pool } = require('../config/database')

// 创建文件
async function createFile({ connection = pool, batchId, invoiceId, originalName, storageKey, mimeType, fileSize, sha256 }) {
  const [result] = await connection.execute(
    `INSERT INTO invoice_files
      (batch_id, invoice_id, original_name, storage_key, mime_type, file_size, sha256, extraction_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [batchId, invoiceId, originalName, storageKey, mimeType, fileSize, sha256],
  )
  return { id: result.insertId, batchId, invoiceId, originalName, storageKey, extractionStatus: 'pending' }
}

module.exports = { createFile }

// 按照批次查询文件
async function findByBatchId(batchId) {
  const [rows] = await pool.execute(
    'SELECT id, batch_id, invoice_id, original_name, storage_key, mime_type, file_size, sha256, extraction_status, extraction_error, created_at, updated_at FROM invoice_files WHERE batch_id = ? ORDER BY id',
    [batchId],
  )
  return rows
}

// 新增批次文件与发票关联查询；
async function findDetailsByBatchId(batchId) {
  const [rows] = await pool.execute(
    `SELECT f.id AS file_id, f.batch_id, f.invoice_id, f.original_name,
       f.storage_key, f.mime_type, f.file_size, f.sha256,
       f.extraction_status, f.extraction_error,
       f.created_at AS file_created_at, f.updated_at AS file_updated_at,
       i.invoice_number, i.invoice_date, i.seller_name, i.seller_tax_id,
       i.total_amount, i.submitted_at, i.qualification_status,
       i.qualification_reason, i.cumulative_amount, i.cumulative_week_start,
       i.finance_status, i.reimbursement_status, i.manual_note,
       i.created_at AS invoice_created_at, i.updated_at AS invoice_updated_at
     FROM invoice_files f
     INNER JOIN invoices i ON i.id = f.invoice_id
     WHERE f.batch_id = ?
     ORDER BY f.id`,
    [batchId],
  )
  return rows
}

async function findById(id) {
  const [rows] = await pool.execute(
    `SELECT id, batch_id, invoice_id, original_name, storage_key, mime_type, file_size
     FROM invoice_files
     WHERE id = ?`,
    [id],
  )
  return rows[0] || null
}

// 更新提取状态
async function updateExtractionStatus({ connection = pool, id, status, error = null }) {
  await connection.execute(
    'UPDATE invoice_files SET extraction_status = ?, extraction_error = ? WHERE id = ?',
    [status, error, id],
  )
}

module.exports = { createFile, findByBatchId, findDetailsByBatchId, findById, updateExtractionStatus }
