const categoryRuleRepository = require('../repositories/categoryRuleRepository')
const { validateCategoryResult } = require('../validators/categoryJudgmentValidator')
const { pool } = require('../config/database')

function badRequest(message) {
  const error = new Error(message)
  error.statusCode = 400
  error.expose = true
  return error
}

function conflict(message) {
  const error = new Error(message)
  error.statusCode = 409
  error.expose = true
  return error
}

function parsePositiveInteger(value, fallback) {
  if (value === undefined) {
    return fallback
  }

  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw badRequest('分页参数无效')
  }

  return parsed
}

function parseRuleId(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw badRequest('规则 ID 无效')
  }

  const ruleId = Number(value)

  if (!Number.isSafeInteger(ruleId) || ruleId <= 0) {
    throw badRequest('规则 ID 无效')
  }

  return ruleId
}

function parseIsActive(value) {
  if (value === undefined || value === '') {
    return undefined
  }

  if (value === 'true' || value === '1') {
    return true
  }

  if (value === 'false' || value === '0') {
    return false
  }

  throw badRequest('启用状态参数无效')
}

function normalizeKeyword(value) {
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== 'string') {
    throw badRequest('关键词参数无效')
  }

  return value.trim() || undefined
}

function normalizeCategoryResult(value) {
  if (value === undefined || value === '') {
    return undefined
  }

  if (typeof value !== 'string' || !validateCategoryResult(value)) {
    throw badRequest('品类结论参数无效')
  }

  return value
}

function normalizeRequiredText(value, fieldName) {
  if (typeof value !== 'string') {
    throw badRequest(`${fieldName}不能为空`)
  }

  const normalizedValue = value.trim()

  if (!normalizedValue) {
    throw badRequest(`${fieldName}不能为空`)
  }

  if (normalizedValue.length > 128) {
    throw badRequest(`${fieldName}不能超过 128 个字符`)
  }

  return normalizedValue
}

function normalizeRequiredCategoryResult(value) {
  if (typeof value !== 'string' || !validateCategoryResult(value)) {
    throw badRequest('品类结论必须是可以、存疑或不可以')
  }

  return value
}

function normalizeCreateIsActive(value) {
  if (value === undefined) {
    return true
  }

  if (typeof value !== 'boolean') {
    throw badRequest('启用状态必须为布尔值')
  }

  return value
}

function assertStatusIsNotUpdated(input) {
  if (Object.prototype.hasOwnProperty.call(input, 'isActive')) {
    throw badRequest('启用状态请通过状态切换接口修改')
  }
}

function normalizeRuleKeyword(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s　]+/g, '')
}

function findDuplicateKeyword(keyword, rules) {
  const normalizedKeyword = normalizeRuleKeyword(keyword)

  return rules.find((rule) => {
    const existingKeyword = normalizeRuleKeyword(rule.keyword)

    return normalizedKeyword === existingKeyword
  }) || null
}

function mapRule(row) {
  return {
    id: row.id,
    ruleName: row.rule_name,
    keyword: row.keyword,
    categoryResult: row.category_result,
    isActive: Boolean(row.is_active),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function listCategoryRules(query = {}) {
  const page = parsePositiveInteger(query.page, 1)
  const pageSize = Math.min(parsePositiveInteger(query.pageSize, 20), 100)
  const keyword = normalizeKeyword(query.keyword)
  const categoryResult = normalizeCategoryResult(query.categoryResult)
  const isActive = parseIsActive(query.isActive)

  const result = await categoryRuleRepository.findPage({
    page,
    pageSize,
    keyword,
    categoryResult,
    isActive,
  })

  return {
    items: result.rows.map(mapRule),
    pagination: {
      page,
      pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / pageSize),
    },
  }
}

async function createCategoryRule({
  input,
  operatorId,
  ipAddress,
  userAgent,
}) {
  const source = input && typeof input === 'object' ? input : {}
  const ruleName = normalizeRequiredText(source.ruleName, '规则名称')
  const keyword = normalizeRequiredText(source.keyword, '关键词')
  const categoryResult = normalizeRequiredCategoryResult(source.categoryResult)
  const isActive = normalizeCreateIsActive(source.isActive)
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const rules = await categoryRuleRepository.findRulesForUpdate({
      connection,
    })
    const duplicateRule = findDuplicateKeyword(keyword, rules)

    if (duplicateRule) {
      throw conflict(
        `关键词“${keyword}”与规则“${duplicateRule.ruleName}”（关键词：${duplicateRule.keyword}）重复`,
      )
    }

    const ruleId = await categoryRuleRepository.createCategoryRule({
      connection,
      ruleName,
      keyword,
      categoryResult,
      isActive,
      createdBy: operatorId,
    })
    const createdRule = await categoryRuleRepository.findById({
      connection,
      ruleId,
    })

    await categoryRuleRepository.createOperationLog({
      connection,
      operatorId,
      ruleId,
      operationType: 'create_category_rule',
      afterData: mapRule(createdRule),
      ipAddress,
      userAgent,
    })
    await connection.commit()

    return mapRule(createdRule)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

async function updateCategoryRule({
  ruleId: rawRuleId,
  input,
  operatorId,
  ipAddress,
  userAgent,
}) {
  const ruleId = parseRuleId(rawRuleId)
  const source = input && typeof input === 'object' ? input : {}

  assertStatusIsNotUpdated(source)

  const ruleName = normalizeRequiredText(source.ruleName, '规则名称')
  const keyword = normalizeRequiredText(source.keyword, '关键词')
  const categoryResult = normalizeRequiredCategoryResult(source.categoryResult)
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const currentRule = await categoryRuleRepository.findByIdForUpdate({
      connection,
      ruleId,
    })

    if (!currentRule) {
      const error = new Error('规则不存在')
      error.statusCode = 404
      error.expose = true
      throw error
    }

    const otherRules = await categoryRuleRepository.findOtherRulesForUpdate({
      connection,
      ruleId,
    })
    const duplicateRule = findDuplicateKeyword(keyword, otherRules)

    if (duplicateRule) {
      throw conflict(
        `关键词“${keyword}”与规则“${duplicateRule.ruleName}”（关键词：${duplicateRule.keyword}）重复`,
      )
    }

    await categoryRuleRepository.updateCategoryRule({
      connection,
      ruleId,
      ruleName,
      keyword,
      categoryResult,
    })
    const updatedRule = await categoryRuleRepository.findById({
      connection,
      ruleId,
    })

    await categoryRuleRepository.createOperationLog({
      connection,
      operatorId,
      ruleId,
      operationType: 'update_category_rule',
      beforeData: mapRule(currentRule),
      afterData: mapRule(updatedRule),
      ipAddress,
      userAgent,
    })
    await connection.commit()

    return mapRule(updatedRule)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

async function getCategoryRuleSummary() {
  const summary = await categoryRuleRepository.getSummary()

  return {
    total: Number(summary.total || 0),
    reimbursableCount: Number(summary.reimbursable_count || 0),
    uncertainCount: Number(summary.uncertain_count || 0),
    nonReimbursableCount: Number(summary.non_reimbursable_count || 0),
  }
}

module.exports = {
  createCategoryRule,
  updateCategoryRule,
  listCategoryRules,
  getCategoryRuleSummary,
}
