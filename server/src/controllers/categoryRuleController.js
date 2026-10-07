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

async function listLogs(req, res, next) {
  try {
    const result = await categoryRuleService.listCategoryRuleLogs(req.query)

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    next(error)
  }
}

async function create(req, res, next) {
  try {
    const result = await categoryRuleService.createCategoryRule({
      input: req.body,
      operatorId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    })

    res.status(201).json({
      success: true,
      data: result,
    })
  } catch (error) {
    next(error)
  }
}

async function testMatch(req, res, next) {
  try {
    const result = await categoryRuleService.testCategoryRuleMatch({
      itemName: req.body?.itemName,
    })

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    next(error)
  }
}

async function update(req, res, next) {
  try {
    const result = await categoryRuleService.updateCategoryRule({
      ruleId: req.params.ruleId,
      input: req.body,
      operatorId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    })

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    next(error)
  }
}

async function updateStatus(req, res, next) {
  try {
    const result = await categoryRuleService.updateCategoryRuleStatus({
      ruleId: req.params.ruleId,
      isActive: req.body?.isActive,
      operatorId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    })

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    next(error)
  }
}

async function remove(req, res, next) {
  try {
    const result = await categoryRuleService.deleteCategoryRule({
      ruleId: req.params.ruleId,
      operatorId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    })

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  create,
  testMatch,
  update,
  updateStatus,
  remove,
  list,
  listLogs,
  getSummary,
}
