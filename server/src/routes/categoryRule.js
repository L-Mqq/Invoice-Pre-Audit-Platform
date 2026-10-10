const express = require('express')
const authMiddleware = require('../middlewares/auth')
const controller = require('../controllers/categoryRuleController')

const router = express.Router()

router.use(authMiddleware)
router.get('/summary', controller.getSummary)
router.get('/names/check', controller.checkName)
router.get('/logs', controller.listLogs)
router.get('/', controller.list)
router.post('/test-match', controller.testMatch)
router.post('/group', controller.createGroup)
router.patch('/:ruleId/group/status', controller.updateGroupStatus)
router.patch('/:ruleId/group', controller.updateGroup)
router.delete('/:ruleId/group', controller.removeGroup)

module.exports = router
