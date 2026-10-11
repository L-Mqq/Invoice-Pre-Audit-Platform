const reviewWorkbenchService = require('../services/reviewWorkbenchService')

async function getWorkbench(req, res, next) {
  try {
    const result = await reviewWorkbenchService.getReviewWorkbench(req.query)

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  getWorkbench,
}
