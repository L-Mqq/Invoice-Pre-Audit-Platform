const express = require('express')
const authMiddleware = require('../middlewares/auth')
const controller = require('../controllers/invoiceController')

const router = express.Router()
router.use(authMiddleware)
router.get('/', controller.list)

module.exports = router
