const financeService = require('../services/financeService')

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

// 获取税号和起始周
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
  submitWeek,
}
