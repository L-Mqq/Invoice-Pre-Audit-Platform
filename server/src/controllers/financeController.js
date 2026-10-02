const financeService = require('../services/financeService')

// 获取按销售方与自然周聚合的财务组列表
async function listWeeks(req, res, next) {
  try {
    const result = await financeService.listFinanceWeeks({
      financeStatus: req.query.financeStatus,
      cumulativeWeekStart: req.query.weekStart,
      sellerKeyword: req.query.sellerKeyword,
    })

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    next(error)
  }
}

// 获取某个财务组内的发票明细
async function getWeekInvoices(req, res, next) {
  try {
    const result = await financeService.getFinanceWeekInvoices({
      sellerTaxId: req.query.sellerTaxId,
      cumulativeWeekStart: req.query.weekStart,
    })

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    next(error)
  }
}

//提交一个销售方、一个自然周的整组发票到财务
async function submitWeek(req, res, next) {
  try {
    const result = await financeService.submitFinanceWeek({
      sellerTaxId: req.body?.sellerTaxId,
      cumulativeWeekStart: req.body?.cumulativeWeekStart,
      operatorId: req.user.id,
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
  listWeeks,
  getWeekInvoices,
  submitWeek,
}
