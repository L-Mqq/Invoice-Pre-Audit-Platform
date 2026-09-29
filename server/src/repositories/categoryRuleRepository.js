const { pool } = require('../config/database')

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

module.exports = { findActiveRules, updateItemCategory }
