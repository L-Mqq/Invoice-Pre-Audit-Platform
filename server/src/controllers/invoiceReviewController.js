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

async function submitInvoiceForReview(req, res, next) {
  try {
    const result = await invoiceReviewService.submitInvoiceForReview({
      invoiceId: req.params.invoiceId,
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

async function reviewInvoiceQualification(req, res, next) {
  try {
    const result = await invoiceReviewService.reviewInvoiceQualification({
      invoiceId: req.params.invoiceId,
      action: req.body?.action,
      note: req.body?.note,
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
  reviewItemCategory,
  submitInvoiceForReview,
  reviewInvoiceQualification,
}
