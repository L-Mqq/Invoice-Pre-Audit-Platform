const express = require('express')
const authMiddleware = require('../middlewares/auth')
const controller = require('../controllers/financeController')

const router = express.Router()

router.use(authMiddleware)

router.get('/weeks', controller.listWeeks)
router.get('/weeks/invoices', controller.getWeekInvoices)

// 提交财务数据
router.post('/weeks/submit', controller.submitWeek)

module.exports = router
