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

function normalizeRuleKeyword(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s　]+/g, '')
}

function findKeywordConflict(keyword, rules) {
  const normalizedKeyword = normalizeRuleKeyword(keyword)

  return rules.find((rule) => {
    const existingKeyword = normalizeRuleKeyword(rule.keyword)

    return normalizedKeyword === existingKeyword
      || normalizedKeyword.includes(existingKeyword)
      || existingKeyword.includes(normalizedKeyword)
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

    if (isActive) {
      const activeRules = await categoryRuleRepository.findActiveRulesForUpdate({
        connection,
      })
      const conflictingRule = findKeywordConflict(keyword, activeRules)

      if (conflictingRule) {
        throw conflict(
          `关键词“${keyword}”与启用规则“${conflictingRule.ruleName}”（关键词：${conflictingRule.keyword}）存在匹配范围冲突`,
        )
      }
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
  listCategoryRules,
  getCategoryRuleSummary,
}
