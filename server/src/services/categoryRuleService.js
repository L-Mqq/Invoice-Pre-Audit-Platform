const categoryRuleRepository = require('../repositories/categoryRuleRepository')
const { validateCategoryResult } = require('../validators/categoryJudgmentValidator')

function badRequest(message) {
  const error = new Error(message)
  error.statusCode = 400
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
    items: result.rows.map((row) => ({
      id: row.id,
      ruleName: row.rule_name,
      keyword: row.keyword,
      categoryResult: row.category_result,
      isActive: Boolean(row.is_active),
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    pagination: {
      page,
      pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / pageSize),
    },
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
  listCategoryRules,
  getCategoryRuleSummary,
}
