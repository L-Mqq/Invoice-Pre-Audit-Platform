const { pool } = require('../config/database')

function createFilter({
  keyword,
  categoryResult,
  isActive,
}) {
  const whereClauses = []
  const parameters = []

  if (keyword) {
    whereClauses.push('(rule_name LIKE ? OR keyword LIKE ?)')
    const searchValue = `%${keyword}%`
    parameters.push(searchValue, searchValue)
  }

  if (categoryResult) {
    whereClauses.push('category_result = ?')
    parameters.push(categoryResult)
  }

  if (isActive !== undefined) {
    whereClauses.push('is_active = ?')
    parameters.push(isActive)
  }

  return {
    whereSql: whereClauses.length > 0
      ? `WHERE ${whereClauses.join(' AND ')}`
      : '',
    parameters,
  }
}

async function findPage({
  page,
  pageSize,
  keyword,
  categoryResult,
  isActive,
}) {
  const {
    whereSql,
    parameters,
  } = createFilter({
    keyword,
    categoryResult,
    isActive,
  })
  const offset = (page - 1) * pageSize

  const [rowsResult, totalResult] = await Promise.all([
    pool.execute(
      `SELECT id,
              rule_name,
              keyword,
              category_result,
              is_active,
              created_by,
              created_at,
              updated_at
         FROM category_rules
         ${whereSql}
        ORDER BY priority ASC, id ASC
        LIMIT ? OFFSET ?`,
      [
        ...parameters,
        pageSize,
        offset,
      ],
    ),
    pool.execute(
      `SELECT COUNT(*) AS total
         FROM category_rules
         ${whereSql}`,
      parameters,
    ),
  ])

  return {
    rows: rowsResult[0],
    total: Number(totalResult[0][0].total || 0),
  }
}

async function getSummary() {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS total,
            SUM(category_result = '可以') AS reimbursable_count,
            SUM(category_result = '存疑') AS uncertain_count,
            SUM(category_result = '不可以') AS non_reimbursable_count
       FROM category_rules`,
  )

  return rows[0]
}

// 查询启用规则；
async function findActiveRules({ connection = pool } = {}) {
  const [rows] = await connection.execute(
    `SELECT id, rule_name AS ruleName, keyword, category_result AS categoryResult,
            priority, is_active AS isActive
       FROM category_rules
      WHERE is_active = TRUE
      ORDER BY priority ASC, id ASC`,
  )
  return rows
}

// 更新商品品类结果。
async function updateItemCategory({
  connection = pool,
  itemId,
  aiResult = null,
  finalResult,
  aiCategoryReason,
}) {
  await connection.execute(
    `UPDATE invoice_items
        SET ai_category_result = ?,
            ai_category_reason = ?,
            final_category_result = ?
      WHERE id = ?`,
    [
      aiResult,
      aiCategoryReason || null,
      finalResult,
      itemId,
    ],
  )
}

module.exports = {
  findActiveRules,
  findPage,
  getSummary,
  updateItemCategory,
}
