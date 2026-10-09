const categoryRuleRepository = require('../repositories/categoryRuleRepository')
const { validateCategoryResult } = require('../validators/categoryJudgmentValidator')
const { pool } = require('../config/database')
const {
  findRule,
  normalizeText,
} = require('./categoryJudgmentService')

const CATEGORY_RULE_LOG_OPERATIONS = new Set([
  'create_category_rule',
  'update_category_rule',
  'update_category_rule_group',
  'update_category_rule_status',
  'update_category_rule_group_status',
  'delete_category_rule',
  'delete_category_rule_group',
])

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

function parseOptionalPositiveInteger(value, parameterName) {
  if (value === undefined || value === '') {
    return undefined
  }

  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw badRequest(`${parameterName}无效`)
  }

  const parsed = Number(value)

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw badRequest(`${parameterName}无效`)
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

function normalizeLogOperation(value) {
  if (value === undefined || value === '') {
    return undefined
  }

  if (typeof value !== 'string' || !CATEGORY_RULE_LOG_OPERATIONS.has(value)) {
    throw badRequest('操作类型参数无效')
  }

  return value
}

function normalizeLogTime(value, parameterName, endOfDay) {
  if (value === undefined || value === '') {
    return undefined
  }

  if (typeof value !== 'string') {
    throw badRequest(`${parameterName}无效`)
  }

  const normalizedValue = value.trim()
  const match = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}:\d{2}))?$/.exec(normalizedValue)

  if (!match) {
    throw badRequest(`${parameterName}格式无效`)
  }

  const time = match[2] || (endOfDay ? '23:59:59' : '00:00:00')
  const parsed = new Date(`${match[1]}T${time}+08:00`)

  if (Number.isNaN(parsed.getTime())) {
    throw badRequest(`${parameterName}格式无效`)
  }

  return `${match[1]} ${time}`
}

function parseLogData(value) {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'object') {
    return value
  }

  try {
    return JSON.parse(value)
  } catch {
    return null
  }
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

function normalizeItemName(value) {
  if (typeof value !== 'string') {
    throw badRequest('商品名称不能为空')
  }

  const itemName = value.trim()

  if (!itemName) {
    throw badRequest('商品名称不能为空')
  }

  if (itemName.length > 255) {
    throw badRequest('商品名称不能超过 255 个字符')
  }

  return itemName
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

function normalizeRequiredIsActive(value) {
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

function findRuleByName(ruleName, rules) {
  return rules.find((rule) => rule.ruleName === ruleName) || null
}

function normalizeKeywords(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw badRequest('关键词至少保留一个')
  }

  const keywords = value.map((keyword) => normalizeRequiredText(keyword, '关键词'))
  const keywordKeys = new Set()

  keywords.forEach((keyword) => {
    const keywordKey = normalizeRuleKeyword(keyword)

    if (keywordKeys.has(keywordKey)) {
      throw badRequest(`关键词“${keyword}”重复`)
    }

    keywordKeys.add(keywordKey)
  })

  return keywords
}

function createRuleGroupSnapshot(rules) {
  const firstRule = rules[0]

  return {
    ruleName: firstRule.ruleName,
    categoryResult: firstRule.categoryResult,
    isActive: Boolean(firstRule.isActive),
    keywords: rules.map((rule) => rule.keyword),
  }
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

async function listCategoryRuleNameOptions(query = {}) {
  const keyword = normalizeKeyword(query.keyword)
  const rows = await categoryRuleRepository.findRuleNameOptions({
    keyword,
  })

  return rows.map((row) => ({
    ruleName: row.rule_name,
    categoryResult: row.category_result,
  }))
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

    const ruleWithSameName = findRuleByName(ruleName, rules)

    if (ruleWithSameName && ruleWithSameName.categoryResult !== categoryResult) {
      throw conflict(
        `规则名称“${ruleName}”已配置为“${ruleWithSameName.categoryResult}”，不能设置为“${categoryResult}”`,
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

    const ruleWithSameName = findRuleByName(ruleName, otherRules)

    if (ruleWithSameName && ruleWithSameName.categoryResult !== categoryResult) {
      throw conflict(
        `规则名称“${ruleName}”已配置为“${ruleWithSameName.categoryResult}”，不能设置为“${categoryResult}”`,
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

async function updateCategoryRuleGroup({
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
  const categoryResult = normalizeRequiredCategoryResult(source.categoryResult)
  const keywords = normalizeKeywords(source.keywords)
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const rules = await categoryRuleRepository.findRulesForUpdate({
      connection,
    })
    const currentRule = rules.find((rule) => rule.id === ruleId)

    if (!currentRule) {
      const error = new Error('规则不存在')
      error.statusCode = 404
      error.expose = true
      throw error
    }

    const currentGroupRules = rules.filter((rule) => {
      return rule.ruleName === currentRule.ruleName
    })
    const otherRules = rules.filter((rule) => {
      return rule.ruleName !== currentRule.ruleName
    })
    const ruleWithSameName = findRuleByName(ruleName, otherRules)

    if (ruleWithSameName) {
      throw conflict(`规则名称“${ruleName}”已存在，不能直接合并规则组`)
    }

    keywords.forEach((keyword) => {
      const duplicateRule = findDuplicateKeyword(keyword, otherRules)

      if (duplicateRule) {
        throw conflict(
          `关键词“${keyword}”与规则“${duplicateRule.ruleName}”（关键词：${duplicateRule.keyword}）重复`,
        )
      }
    })

    const beforeData = createRuleGroupSnapshot(currentGroupRules)
    const existingRulesByKeyword = new Map(
      currentGroupRules.map((rule) => [
        normalizeRuleKeyword(rule.keyword),
        rule,
      ]),
    )
    const requestedKeywordKeys = new Set(
      keywords.map((keyword) => normalizeRuleKeyword(keyword)),
    )

    await categoryRuleRepository.updateCategoryRuleGroup({
      connection,
      currentRuleName: currentRule.ruleName,
      ruleName,
      categoryResult,
    })

    for (const keyword of keywords) {
      const existingRule = existingRulesByKeyword.get(normalizeRuleKeyword(keyword))

      if (existingRule) {
        if (existingRule.keyword !== keyword) {
          await categoryRuleRepository.updateCategoryRuleKeyword({
            connection,
            ruleId: existingRule.id,
            keyword,
          })
        }

        continue
      }

      await categoryRuleRepository.createCategoryRule({
        connection,
        ruleName,
        keyword,
        categoryResult,
        isActive: Boolean(currentRule.isActive),
        createdBy: operatorId,
      })
    }

    const removedRuleIds = currentGroupRules
      .filter((rule) => !requestedKeywordKeys.has(normalizeRuleKeyword(rule.keyword)))
      .map((rule) => rule.id)

    await categoryRuleRepository.deleteCategoryRules({
      connection,
      ruleIds: removedRuleIds,
    })

    const updatedRules = await categoryRuleRepository.findByRuleName({
      connection,
      ruleName,
    })
    const afterData = {
      ruleName,
      categoryResult,
      isActive: Boolean(currentRule.isActive),
      keywords: updatedRules.map((rule) => rule.keyword),
    }

    await categoryRuleRepository.createOperationLog({
      connection,
      operatorId,
      ruleId: updatedRules[0].id,
      operationType: 'update_category_rule_group',
      beforeData,
      afterData,
      ipAddress,
      userAgent,
    })
    await connection.commit()

    return {
      id: updatedRules[0].id,
      ...afterData,
    }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

// 修改规则组状态
async function updateCategoryRuleGroupStatus({
  ruleId: rawRuleId,
  isActive: rawIsActive,
  operatorId,
  ipAddress,
  userAgent,
}) {
  const ruleId = parseRuleId(rawRuleId)
  const isActive = normalizeRequiredIsActive(rawIsActive)
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

    const groupRules = await categoryRuleRepository.findByRuleNameForUpdate({
      connection,
      ruleName: currentRule.rule_name,
    })
    const rulesToUpdate = groupRules.filter((rule) => {
      return Boolean(rule.is_active) !== isActive
    })

    if (rulesToUpdate.length === 0) {
      await connection.commit()

      return {
        id: currentRule.id,
        ruleName: currentRule.rule_name,
        isActive,
        updatedKeywordCount: 0,
      }
    }

    if (isActive) {
      const activeRules = await categoryRuleRepository.findActiveRulesOutsideGroupForUpdate({
        connection,
        ruleName: currentRule.rule_name,
      })

      rulesToUpdate.forEach((rule) => {
        const duplicateRule = findDuplicateKeyword(rule.keyword, activeRules)

        if (duplicateRule) {
          throw conflict(
            `关键词“${rule.keyword}”与启用规则“${duplicateRule.ruleName}”（关键词：${duplicateRule.keyword}）重复，无法启用`,
          )
        }
      })
    }

    const beforeData = createRuleGroupSnapshot(groupRules)
    const updatedRuleIds = rulesToUpdate.map((rule) => rule.id)

    await categoryRuleRepository.updateCategoryRuleGroupStatus({
      connection,
      ruleName: currentRule.rule_name,
      isActive,
    })

    await categoryRuleRepository.createOperationLog({
      connection,
      operatorId,
      ruleId,
      operationType: 'update_category_rule_group_status',
      beforeData,
      afterData: {
        ...beforeData,
        isActive,
        updatedRuleIds,
        updatedKeywordCount: updatedRuleIds.length,
      },
      ipAddress,
      userAgent,
    })
    await connection.commit()

    return {
      id: currentRule.id,
      ruleName: currentRule.rule_name,
      isActive,
      updatedKeywordCount: updatedRuleIds.length,
    }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

async function deleteCategoryRule({
  ruleId: rawRuleId,
  operatorId,
  ipAddress,
  userAgent,
}) {
  const ruleId = parseRuleId(rawRuleId)
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

    const deletedAt = new Date().toISOString()

    await categoryRuleRepository.createOperationLog({
      connection,
      operatorId,
      ruleId,
      operationType: 'delete_category_rule',
      beforeData: mapRule(currentRule),
      afterData: {
        ...mapRule(currentRule),
        deleted: true,
        deletedAt,
        deletedBy: operatorId,
      },
      ipAddress,
      userAgent,
    })
    await categoryRuleRepository.deleteCategoryRule({
      connection,
      ruleId,
    })
    await connection.commit()

    return {
      id: ruleId,
    }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

async function deleteCategoryRuleGroup({
  ruleId: rawRuleId,
  operatorId,
  ipAddress,
  userAgent,
}) {
  const ruleId = parseRuleId(rawRuleId)
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

    const groupRules = await categoryRuleRepository.findByRuleNameForUpdate({
      connection,
      ruleName: currentRule.rule_name,
    })
    const deletedRuleIds = groupRules.map((rule) => rule.id)
    const deletedKeywords = groupRules.map((rule) => rule.keyword)
    const deletedAt = new Date().toISOString()
    const beforeData = createRuleGroupSnapshot(groupRules)

    await categoryRuleRepository.createOperationLog({
      connection,
      operatorId,
      ruleId,
      operationType: 'delete_category_rule_group',
      beforeData,
      afterData: {
        ...beforeData,
        deleted: true,
        deletedAt,
        deletedBy: operatorId,
        deletedRuleIds,
        deletedKeywords,
      },
      ipAddress,
      userAgent,
    })
    await categoryRuleRepository.deleteCategoryRuleGroup({
      connection,
      ruleName: currentRule.rule_name,
    })
    await connection.commit()

    return {
      ruleName: currentRule.rule_name,
      deletedRuleIds,
      deletedKeywords,
    }
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
    ruleTotal: Number(summary.rule_total || 0),
    keywordTotal: Number(summary.keyword_total || 0),
    reimbursableRuleCount: Number(summary.reimbursable_rule_count || 0),
    uncertainRuleCount: Number(summary.uncertain_rule_count || 0),
    nonReimbursableRuleCount: Number(summary.non_reimbursable_rule_count || 0),
  }
}

async function listCategoryRuleLogs(query = {}) {
  const page = parsePositiveInteger(query.page, 1)
  const pageSize = Math.min(parsePositiveInteger(query.pageSize, 20), 100)
  const ruleId = parseOptionalPositiveInteger(query.ruleId, '规则 ID')
  const operatorId = parseOptionalPositiveInteger(query.operatorId, '操作人 ID')
  const operationType = normalizeLogOperation(query.operationType)
  const startAt = normalizeLogTime(query.startAt, '开始时间', false)
  const endAt = normalizeLogTime(query.endAt, '结束时间', true)

  if (startAt && endAt && startAt > endAt) {
    throw badRequest('开始时间不能晚于结束时间')
  }

  const result = await categoryRuleRepository.findLogPage({
    page,
    pageSize,
    ruleId,
    operatorId,
    operationType,
    startAt,
    endAt,
  })

  return {
    items: result.rows.map((row) => ({
      id: row.id,
      ruleId: row.rule_id,
      operationType: row.operation_type,
      operatorId: row.operator_id,
      operatorName: row.operator_name,
      beforeData: parseLogData(row.before_data),
      afterData: parseLogData(row.after_data),
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at,
    })),
    pagination: {
      page,
      pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / pageSize),
    },
  }
}

async function testCategoryRuleMatch({
  itemName,
}) {
  const normalizedItemName = normalizeItemName(itemName)
  const activeRules = await categoryRuleRepository.findActiveRules()
  const matchedRule = findRule(normalizedItemName, activeRules)

  if (!matchedRule) {
    return {
      itemName: normalizedItemName,
      normalizedItemName: normalizeText(normalizedItemName),
      matchedRule: null,
      categoryResult: null,
      source: 'ai_fallback_required',
      message: '未命中启用规则；实际审核时将进入 AI 辅助判断，当前测试不会调用 AI',
    }
  }

  return {
    itemName: normalizedItemName,
    normalizedItemName: normalizeText(normalizedItemName),
    matchedRule: {
      id: matchedRule.id,
      ruleName: matchedRule.ruleName,
      keyword: matchedRule.keyword,
      categoryResult: matchedRule.categoryResult,
    },
    categoryResult: matchedRule.categoryResult,
    source: 'rule',
    message: `命中规则“${matchedRule.ruleName}”（关键词：${matchedRule.keyword}）`,
  }
}

module.exports = {
  createCategoryRule,
  updateCategoryRule,
  updateCategoryRuleGroup,
  updateCategoryRuleGroupStatus,
  testCategoryRuleMatch,
  deleteCategoryRule,
  deleteCategoryRuleGroup,
  listCategoryRules,
  listCategoryRuleNameOptions,
  listCategoryRuleLogs,
  getCategoryRuleSummary,
}
