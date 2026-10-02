const invoiceService = require('../services/invoiceService')
const financeService = require('../services/financeService')

async function list(req, res, next) {
  try {
    const result = await invoiceService.listInvoices(req.query)
    res.json({ success: true, data: result })
  } catch (error) {
    next(error)
  }
}

async function getDetail(req, res, next) {
  try {
    const result = await invoiceService.getInvoiceDetail(
      req.params.invoiceId,
    )

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    next(error)
  }
}

// 更新最终的状态
async function updateReimbursementStatus(req, res, next) {
  try {
    const result = await financeService.updateInvoiceReimbursementStatus({
      invoiceId: req.params.invoiceId,
      reimbursementStatus: req.body?.reimbursementStatus,
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
  list,
  getDetail,
  updateReimbursementStatus,
}
