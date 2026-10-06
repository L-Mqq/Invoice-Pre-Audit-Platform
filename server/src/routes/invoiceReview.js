const express = require('express')
const authMiddleware = require('../middlewares/auth')
const controller = require('../controllers/invoiceReviewController')

const router = express.Router()
router.use(authMiddleware)
// 更新商品品类的审核结果
router.patch('/items/:itemId/category', controller.reviewItemCategory)
// 人工补全识别缺失或异常的发票、商品资料。
router.patch(
  '/invoices/:invoiceId/manual-data',
  controller.updateInvoiceManualData,
)
// 提交审核的更新submitted_at的时间
router.patch(
  '/invoices/:invoiceId/submit',
  controller.submitInvoiceForReview,
)
// 只读预览：计算加入当前发票前后的自然周累计，不写入数据库。
router.get(
  '/invoices/:invoiceId/qualification-preview',
  controller.getInvoiceQualificationPreview,
)
// 执行规则审核或放弃当前发票。
router.patch(
  '/invoices/:invoiceId/qualification',
  controller.reviewInvoiceQualification,
)
// 管理员确认疑似重复发票。
router.patch(
  '/invoices/:invoiceId/duplicate-review',
  controller.reviewInvoiceDuplicate,
)

module.exports = router
