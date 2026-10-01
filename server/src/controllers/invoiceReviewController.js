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

// 提交审核
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

// 获取周累计金额
async function getInvoiceQualificationPreview(req, res, next) {
  try {
    const result = await invoiceReviewService.getInvoiceQualificationPreview({
      invoiceId: req.params.invoiceId,
    })

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    next(error)
  }
}

// 发票级审核
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
  getInvoiceQualificationPreview,
  reviewInvoiceQualification,
}
