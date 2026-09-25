const { pool } = require('../config/database')

// 创建文件
async function createFile({ connection = pool, batchId, originalName, storageKey, mimeType, fileSize, sha256 }) {
  const [result] = await connection.execute(
    `INSERT INTO invoice_files
      (batch_id, invoice_id, original_name, storage_key, mime_type, file_size, sha256, extraction_status)
     VALUES (?, NULL, ?, ?, ?, ?, ?, 'pending')`,
    [batchId, originalName, storageKey, mimeType, fileSize, sha256],
  )
  return { id: result.insertId, batchId, originalName, storageKey, extractionStatus: 'pending' }
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

// 更新提取状态
async function updateExtractionStatus({ connection = pool, id, status, error = null }) {
  await connection.execute(
    'UPDATE invoice_files SET extraction_status = ?, extraction_error = ? WHERE id = ?',
    [status, error, id],
  )
}

module.exports = { createFile, findByBatchId, updateExtractionStatus }
