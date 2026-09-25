const { pool } = require('../config/database')

async function createBatch({ connection = pool, id, originalName, fileType, totalCount, createdBy = null }) {
  await connection.execute(
    `INSERT INTO upload_batches
      (id, original_name, file_type, status, total_count, success_count, failed_count, created_by)
     VALUES (?, ?, ?, 'pending', ?, 0, 0, ?)`,
    [id, originalName, fileType, totalCount, createdBy],
  )

  return { id, originalName, fileType, status: 'pending', totalCount, successCount: 0, failedCount: 0, createdBy }
}

async function updateStatus({ connection = pool, id, status, errorMessage = null }) {
  await connection.execute('UPDATE upload_batches SET status = ?, error_message = ? WHERE id = ?', [status, errorMessage, id])
}

// 更新成功数量和失败数量
async function incrementResult({ connection = pool, id, success }) {
  const field = success ? 'success_count' : 'failed_count'
  await connection.execute(`UPDATE upload_batches SET ${field} = ${field} + 1 WHERE id = ?`, [id])
}

async function findById(id) {
  const [rows] = await pool.execute('SELECT id, original_name, file_type, status, total_count, success_count, failed_count, error_message, created_by, created_at, updated_at FROM upload_batches WHERE id = ?', [id])
  return rows[0] || null
}

module.exports = { createBatch, updateStatus, incrementResult, findById }
