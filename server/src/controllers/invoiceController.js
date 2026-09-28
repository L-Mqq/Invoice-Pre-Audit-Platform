const invoiceService = require('../services/invoiceService')

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

module.exports = {
  list,
  getDetail,
}
