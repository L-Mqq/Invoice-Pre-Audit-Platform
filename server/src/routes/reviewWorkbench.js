const express = require('express')
const authMiddleware = require('../middlewares/auth')
const controller = require('../controllers/reviewWorkbenchController')

const router = express.Router()

router.use(authMiddleware)
router.get('/', controller.getWorkbench)

module.exports = router
