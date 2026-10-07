const categoryRuleService = require('../services/categoryRuleService')

async function list(req, res, next) {
  try {
    const result = await categoryRuleService.listCategoryRules(req.query)

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    next(error)
  }
}

async function getSummary(req, res, next) {
  try {
    const result = await categoryRuleService.getCategoryRuleSummary()

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  list,
  getSummary,
}
