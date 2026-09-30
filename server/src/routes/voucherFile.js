const express = require('express')
const authMiddleware = require('../middlewares/auth')
const voucherFileController = require('../controllers/voucherFileController')

const router = express.Router()

router.use(authMiddleware)
router.get('/:voucherId/preview', voucherFileController.preview)
router.get('/:voucherId/download', voucherFileController.download)

module.exports = router
