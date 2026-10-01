const express = require('express')
const multer = require('multer')
const authMiddleware = require('../middlewares/auth')
const voucherController = require('../controllers/voucherController')
const normalizeUploadFileNames = require('../middlewares/normalizeUploadFileNames')

const MAX_VOUCHER_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
])

const router = express.Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: MAX_VOUCHER_FILE_SIZE,
  },
  fileFilter(req, file, callback) {
    const extension = file.originalname.split('.').pop()?.toLowerCase()
    const isAllowedExtension = [
      'jpeg',
      'jpg',
      'pdf',
      'png',
      'webp',
    ].includes(extension)

    if (!ALLOWED_MIME_TYPES.has(file.mimetype) && !isAllowedExtension) {
      callback(new Error('仅支持 PDF、JPG、PNG 或 WEBP 格式的凭证文件'))
      return
    }

    callback(null, true)
  },
})

router.use(authMiddleware)

// 获取凭证组信息
router.get(
  '/invoices/:invoiceId/voucher-groups',
  voucherController.listVoucherGroups,
)
// 获取周累计凭证任务及关联发票进度。
router.get(
  '/invoices/:invoiceId/weekly-voucher-requirements',
  voucherController.getWeeklyVoucherRequirements,
)
// 上传凭证组
router.post(
  '/invoices/:invoiceId/voucher-groups',
  voucherController.createVoucherGroup,
)
// 上传凭证组详细信息
router.post(
  '/voucher-groups/:groupId/files/:voucherType',
  upload.single('file'),
  normalizeUploadFileNames,
  voucherController.uploadVoucherFile,
)
// 更新凭证组审核信息
router.patch(
  '/voucher-groups/:groupId/review',
  voucherController.reviewVoucherGroup,
)

module.exports = router
