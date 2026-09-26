const CATEGORY_RESULTS = ['可以', '存疑', '不可以']

function validateCategoryResult(value) {
  return CATEGORY_RESULTS.includes(value)
}

function validateCategoryJudgment(input) {
  const source = input && typeof input === 'object' ? input : {}
  const result = source.categoryResult
  const errors = []
  if (!validateCategoryResult(result)) errors.push('categoryResult 必须是可以、存疑或不可以')
  if (source.confidence !== undefined && (typeof source.confidence !== 'number' || source.confidence < 0 || source.confidence > 1)) {
    errors.push('confidence 必须是 0 到 1 之间的数字')
  }
  return { valid: errors.length === 0, data: { categoryResult: result, matchedRule: source.matchedRule || null, reason: source.reason || null, confidence: source.confidence ?? null }, errors }
}

module.exports = { CATEGORY_RESULTS, validateCategoryResult, validateCategoryJudgment }
