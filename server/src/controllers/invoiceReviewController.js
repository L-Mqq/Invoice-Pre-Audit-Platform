const invoiceReviewService = require('../services/invoiceReviewService')

async function reviewItemCategory(req, res, next) {
  try {
    const result = await invoiceReviewService.reviewItemCategory({
      itemId: req.params.itemId,
      result: req.body?.result,
      note: req.body?.note,
      operatorId: req.user.id,
    })
    res.json({ success: true, data: result })
  } catch (error) {
    next(error)
  }
}

module.exports = { reviewItemCategory }
