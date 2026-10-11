const overviewService = require('../services/overviewService')

async function getCurrentWeek(req, res, next) {
  try {
    const result = await overviewService.getCurrentWeekOverview()

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  getCurrentWeek,
}
