const financeService = require('../services/financeService')

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
  submitWeek,
}
