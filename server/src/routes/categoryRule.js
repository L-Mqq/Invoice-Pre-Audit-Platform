const express = require('express')
const authMiddleware = require('../middlewares/auth')
const controller = require('../controllers/categoryRuleController')

const router = express.Router()

router.use(authMiddleware)
router.get('/summary', controller.getSummary)
router.get('/', controller.list)
router.post('/', controller.create)

module.exports = router
