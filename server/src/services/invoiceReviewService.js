const { pool } = require('../config/database')
const invoiceReviewRepository = require('../repositories/invoiceReviewRepository')

const ALLOWED_RESULTS = new Set(['可以', '存疑', '不可以'])

async function reviewItemCategory({ itemId, result, note, operatorId }) {
  if (!Number.isInteger(Number(itemId)) || Number(itemId) <= 0) {
    const error = new Error('itemId 无效')
    error.statusCode = 400
    error.expose = true
    throw error
  }
  if (!ALLOWED_RESULTS.has(result)) {
    const error = new Error('result 必须是可以、存疑或不可以')
    error.statusCode = 400
    error.expose = true
    throw error
  }
  if (note !== undefined && note !== null && (typeof note !== 'string' || note.length > 2000)) {
    const error = new Error('note 必须是不超过 2000 个字符的文本')
    error.statusCode = 400
    error.expose = true
    throw error
  }
  const connection = await pool.getConnection()
  try {
    return await invoiceReviewRepository.reviewItemCategory({ connection, itemId: Number(itemId), result, note, operatorId })
  } finally {
    connection.release()
  }
}

module.exports = { reviewItemCategory }
