const express = require('express')
const authMiddleware = require('../middlewares/auth')
const controller = require('../controllers/invoiceReviewController')

const router = express.Router()
router.use(authMiddleware)
// 更新商品品类的审核结果
router.patch('/items/:itemId/category', controller.reviewItemCategory)
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
// 进入审核更改资质审核的最终结果qualification_status
router.patch(
  '/invoices/:invoiceId/qualification',
  controller.reviewInvoiceQualification,
)

module.exports = router
