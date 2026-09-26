const express = require('express')
const authMiddleware = require('../middlewares/auth')
const controller = require('../controllers/invoiceReviewController')

const router = express.Router()
router.use(authMiddleware)
router.patch('/items/:itemId/category', controller.reviewItemCategory)

module.exports = router
