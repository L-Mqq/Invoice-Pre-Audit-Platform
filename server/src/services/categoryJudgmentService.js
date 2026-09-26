const categoryRuleRepository = require('../repositories/categoryRuleRepository')
const { classifyItem } = require('../extractors/categoryClassifier')
const { validateCategoryResult } = require('../validators/categoryJudgmentValidator')

// 标准化文本，方便比较。
function normalizeText(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s　]+/g, '')
}

// 在规则列表里，找一条匹配的规则
function findRule(itemName, rules) {
  const normalizedName = normalizeText(itemName)
  return rules.find((rule) => normalizedName.includes(normalizeText(rule.keyword))) || null
}

// 判断单个商品的品类
async function judgeItem({ item, rules }) {
  const matchedRule = findRule(item.itemName, rules)
  if (matchedRule) {
    return { itemId: item.id, categoryResult: matchedRule.categoryResult, aiResult: null, matchedRule, reason: `命中品类规则：${matchedRule.ruleName}（关键词：${matchedRule.keyword}）`, source: 'rule' }
  }
  const ai = await classifyItem({ itemName: item.itemName, rules })
  const categoryResult = validateCategoryResult(ai.categoryResult) ? ai.categoryResult : '存疑'
  return { itemId: item.id, categoryResult, aiResult: categoryResult, matchedRule: null, reason: ai.reason || 'AI 判断', source: 'ai', rawResult: ai.rawResult }
}

// 判断整张发票所有商品的品类，并汇总结论。
async function judgeItems({ items, connection, persist = false }) {
  const rules = await categoryRuleRepository.findActiveRules({ connection })
  const results = []
  for (const item of items || []) {
    const result = await judgeItem({ item, rules })
    if (persist && item.id) await categoryRuleRepository.updateItemCategory({ connection, itemId: item.id, aiResult: result.aiResult, finalResult: result.categoryResult, reason: result.reason })
    results.push(result)
  }
  const hasRejected = results.some((item) => item.categoryResult === '不可以')
  const hasUncertain = results.some((item) => item.categoryResult === '存疑')
  return { results, invoiceCategoryResult: hasRejected ? '不可以' : hasUncertain ? '存疑' : '可以', requiresManualReview: hasRejected || hasUncertain }
}

module.exports = { normalizeText, findRule, judgeItem, judgeItems }
