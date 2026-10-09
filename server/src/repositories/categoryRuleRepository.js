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

function createLogFilter({
  ruleId,
  operatorId,
  operationType,
  startAt,
  endAt,
}) {
  const whereClauses = ["l.resource_type = 'category_rule'"]
  const parameters = []

  if (ruleId !== undefined) {
    whereClauses.push('l.resource_id = ?')
    parameters.push(ruleId)
  }

  if (operatorId !== undefined) {
    whereClauses.push('l.operator_id = ?')
    parameters.push(operatorId)
  }

  if (operationType) {
    whereClauses.push('l.operation_type = ?')
    parameters.push(operationType)
  }

  if (startAt) {
    whereClauses.push('l.created_at >= ?')
    parameters.push(startAt)
  }

  if (endAt) {
    whereClauses.push('l.created_at <= ?')
    parameters.push(endAt)
  }

  return {
    whereSql: `WHERE ${whereClauses.join(' AND ')}`,
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

  const [ruleNameResult, totalResult] = await Promise.all([
    pool.execute(
      `SELECT rule_name,
              MIN(priority) AS first_priority,
              MIN(id) AS first_id
         FROM category_rules
         ${whereSql}
        GROUP BY rule_name
        ORDER BY first_priority ASC, first_id ASC
        LIMIT ? OFFSET ?`,
      [
        ...parameters,
        pageSize,
        offset,
      ],
    ),
    pool.execute(
      `SELECT COUNT(DISTINCT rule_name) AS total
         FROM category_rules
         ${whereSql}`,
      parameters,
    ),
  ])

  const ruleNames = ruleNameResult[0].map((row) => row.rule_name)

  if (ruleNames.length === 0) {
    return {
      rows: [],
      total: Number(totalResult[0][0].total || 0),
    }
  }

  const ruleNamePlaceholders = ruleNames.map(() => '?').join(', ')
  const selectedWhereSql = whereSql
    ? `${whereSql} AND rule_name IN (${ruleNamePlaceholders})`
    : `WHERE rule_name IN (${ruleNamePlaceholders})`
  const [rows] = await pool.execute(
    `SELECT id,
            rule_name,
            keyword,
            category_result,
            is_active,
            created_by,
            created_at,
            updated_at
       FROM category_rules
       ${selectedWhereSql}
      ORDER BY priority ASC, id ASC`,
    [
      ...parameters,
      ...ruleNames,
    ],
  )

  return {
    rows,
    total: Number(totalResult[0][0].total || 0),
  }
}

async function findLogPage({
  page,
  pageSize,
  ruleId,
  operatorId,
  operationType,
  startAt,
  endAt,
}) {
  const {
    whereSql,
    parameters,
  } = createLogFilter({
    ruleId,
    operatorId,
    operationType,
    startAt,
    endAt,
  })
  const offset = (page - 1) * pageSize

  const [rowsResult, totalResult] = await Promise.all([
    pool.execute(
      `SELECT l.id,
              l.operation_type,
              l.resource_id AS rule_id,
              l.operator_id,
              u.username AS operator_name,
              l.before_data,
              l.after_data,
              l.ip_address,
              l.user_agent,
              l.created_at
         FROM operation_logs l
         LEFT JOIN users u
           ON u.id = l.operator_id
         ${whereSql}
        ORDER BY l.created_at DESC, l.id DESC
        LIMIT ? OFFSET ?`,
      [
        ...parameters,
        pageSize,
        offset,
      ],
    ),
    pool.execute(
      `SELECT COUNT(*) AS total
         FROM operation_logs l
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
    `SELECT (
              SELECT COUNT(*)
                FROM category_rules
            ) AS keyword_total,
            COUNT(*) AS rule_total,
            SUM(category_result = '可以') AS reimbursable_rule_count,
            SUM(category_result = '存疑') AS uncertain_rule_count,
            SUM(category_result = '不可以') AS non_reimbursable_rule_count
       FROM (
         SELECT rule_name,
                MIN(category_result) AS category_result
           FROM category_rules
          GROUP BY rule_name
       ) grouped_rules`,
  )

  return rows[0]
}

async function findRuleNameOptions({
  keyword,
}) {
  const whereSql = keyword
    ? 'WHERE rule_name LIKE ?'
    : ''
  const parameters = keyword
    ? [`%${keyword}%`]
    : []
  const [rows] = await pool.execute(
    `SELECT rule_name,
            MIN(category_result) AS category_result
       FROM category_rules
       ${whereSql}
      GROUP BY rule_name
      ORDER BY rule_name ASC
      LIMIT 100`,
    parameters,
  )

  return rows
}

async function findRulesForUpdate({
  connection = pool,
}) {
  const [rows] = await connection.execute(
    `SELECT id,
            rule_name AS ruleName,
            keyword,
            category_result AS categoryResult,
            priority,
            is_active AS isActive
       FROM category_rules
      ORDER BY id ASC
      FOR UPDATE`,
  )

  return rows
}

async function createCategoryRule({
  connection = pool,
  ruleName,
  keyword,
  categoryResult,
  isActive,
  createdBy,
}) {
  const [result] = await connection.execute(
    `INSERT INTO category_rules
      (
        rule_name,
        keyword,
        category_result,
        is_active,
        created_by
      )
     VALUES (?, ?, ?, ?, ?)`,
    [
      ruleName,
      keyword,
      categoryResult,
      isActive,
      createdBy,
    ],
  )

  return result.insertId
}

async function findById({
  connection = pool,
  ruleId,
}) {
  const [rows] = await connection.execute(
    `SELECT id,
            rule_name,
            keyword,
            category_result,
            is_active,
            created_by,
            created_at,
            updated_at
       FROM category_rules
      WHERE id = ?`,
    [ruleId],
  )

  return rows[0] || null
}

async function findByIdForUpdate({
  connection = pool,
  ruleId,
}) {
  const [rows] = await connection.execute(
    `SELECT id,
            rule_name,
            keyword,
            category_result,
            is_active,
            created_by,
            created_at,
            updated_at
       FROM category_rules
      WHERE id = ?
      FOR UPDATE`,
    [ruleId],
  )

  return rows[0] || null
}

async function findByRuleName({
  connection = pool,
  ruleName,
}) {
  const [rows] = await connection.execute(
    `SELECT id,
            rule_name,
            keyword,
            category_result,
            is_active,
            created_by,
            created_at,
            updated_at
       FROM category_rules
      WHERE rule_name = ?
      ORDER BY priority ASC, id ASC`,
    [ruleName],
  )

  return rows
}

async function findByRuleNameForUpdate({
  connection = pool,
  ruleName,
}) {
  const [rows] = await connection.execute(
    `SELECT id,
            rule_name,
            keyword,
            category_result,
            is_active,
            created_by,
            created_at,
            updated_at
       FROM category_rules
      WHERE rule_name = ?
      ORDER BY priority ASC, id ASC
      FOR UPDATE`,
    [ruleName],
  )

  return rows
}

async function findOtherRulesForUpdate({
  connection = pool,
  ruleId,
}) {
  const [rows] = await connection.execute(
    `SELECT id,
            rule_name AS ruleName,
            keyword,
            category_result AS categoryResult,
            is_active AS isActive
       FROM category_rules
      WHERE id <> ?
      ORDER BY id ASC
      FOR UPDATE`,
    [ruleId],
  )

  return rows
}

async function findOtherActiveRulesForUpdate({
  connection = pool,
  ruleId,
}) {
  const [rows] = await connection.execute(
    `SELECT id,
            rule_name AS ruleName,
            keyword,
            category_result AS categoryResult,
            is_active AS isActive
       FROM category_rules
      WHERE id <> ?
        AND is_active = TRUE
      ORDER BY id ASC
      FOR UPDATE`,
    [ruleId],
  )

  return rows
}

async function findActiveRulesOutsideGroupForUpdate({
  connection = pool,
  ruleName,
}) {
  const [rows] = await connection.execute(
    `SELECT id,
            rule_name AS ruleName,
            keyword,
            category_result AS categoryResult,
            is_active AS isActive
       FROM category_rules
      WHERE rule_name <> ?
        AND is_active = TRUE
      ORDER BY id ASC
      FOR UPDATE`,
    [ruleName],
  )

  return rows
}

async function updateCategoryRule({
  connection = pool,
  ruleId,
  ruleName,
  keyword,
  categoryResult,
}) {
  await connection.execute(
    `UPDATE category_rules
        SET rule_name = ?,
            keyword = ?,
            category_result = ?
      WHERE id = ?`,
    [
      ruleName,
      keyword,
      categoryResult,
      ruleId,
    ],
  )
}

async function updateCategoryRuleGroup({
  connection = pool,
  currentRuleName,
  ruleName,
  categoryResult,
}) {
  await connection.execute(
    `UPDATE category_rules
        SET rule_name = ?,
            category_result = ?
      WHERE rule_name = ?`,
    [
      ruleName,
      categoryResult,
      currentRuleName,
    ],
  )
}

async function updateCategoryRuleKeyword({
  connection = pool,
  ruleId,
  keyword,
}) {
  await connection.execute(
    `UPDATE category_rules
        SET keyword = ?
      WHERE id = ?`,
    [
      keyword,
      ruleId,
    ],
  )
}

async function updateCategoryRuleGroupStatus({
  connection = pool,
  ruleName,
  isActive,
}) {
  await connection.execute(
    `UPDATE category_rules
        SET is_active = ?
      WHERE rule_name = ?`,
    [
      isActive,
      ruleName,
    ],
  )
}

async function deleteCategoryRule({
  connection = pool,
  ruleId,
}) {
  await connection.execute(
    `DELETE FROM category_rules
      WHERE id = ?`,
    [ruleId],
  )
}

async function deleteCategoryRules({
  connection = pool,
  ruleIds,
}) {
  if (ruleIds.length === 0) {
    return
  }

  const placeholders = ruleIds.map(() => '?').join(', ')

  await connection.execute(
    `DELETE FROM category_rules
      WHERE id IN (${placeholders})`,
    ruleIds,
  )
}

async function deleteCategoryRuleGroup({
  connection = pool,
  ruleName,
}) {
  await connection.execute(
    `DELETE FROM category_rules
      WHERE rule_name = ?`,
    [ruleName],
  )
}

async function createOperationLog({
  connection = pool,
  operatorId,
  ruleId,
  operationType,
  beforeData = null,
  afterData,
  ipAddress = null,
  userAgent = null,
}) {
  await connection.execute(
    `INSERT INTO operation_logs
      (
        operator_id,
        operation_type,
        resource_type,
        resource_id,
        before_data,
        after_data,
        ip_address,
        user_agent
      )
     VALUES (?, ?, 'category_rule', ?, ?, ?, ?, ?)`,
    [
      operatorId,
      operationType,
      ruleId,
      beforeData ? JSON.stringify(beforeData) : null,
      JSON.stringify(afterData),
      ipAddress,
      userAgent,
    ],
  )
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
  findRulesForUpdate,
  findPage,
  findLogPage,
  findById,
  findByIdForUpdate,
  findByRuleName,
  findByRuleNameForUpdate,
  findOtherRulesForUpdate,
  findOtherActiveRulesForUpdate,
  findActiveRulesOutsideGroupForUpdate,
  findRuleNameOptions,
  getSummary,
  createCategoryRule,
  updateCategoryRule,
  updateCategoryRuleGroup,
  updateCategoryRuleKeyword,
  updateCategoryRuleGroupStatus,
  deleteCategoryRule,
  deleteCategoryRules,
  deleteCategoryRuleGroup,
  createOperationLog,
  updateItemCategory,
}
