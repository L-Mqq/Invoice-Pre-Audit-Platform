const express = require('express')
const authMiddleware = require('../middlewares/auth')
const controller = require('../controllers/overviewController')

const router = express.Router()

router.use(authMiddleware)
router.get('/current-week', controller.getCurrentWeek)

module.exports = router
