const express = require('express')
const authMiddleware = require('../middlewares/auth')
const controller = require('../controllers/invoiceFileController')

const router = express.Router()
router.use(authMiddleware)
router.get('/:fileId/preview', controller.preview)
router.get('/:fileId/download', controller.download)

module.exports = router
