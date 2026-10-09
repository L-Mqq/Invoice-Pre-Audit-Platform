const express = require('express')
const authMiddleware = require('../middlewares/auth')
const controller = require('../controllers/categoryRuleController')

const router = express.Router()

router.use(authMiddleware)
router.get('/summary', controller.getSummary)
router.get('/names', controller.listNameOptions)
router.get('/logs', controller.listLogs)
router.get('/', controller.list)
router.post('/test-match', controller.testMatch)
router.post('/', controller.create)
router.patch('/:ruleId/status', controller.updateStatus)
router.patch('/:ruleId/group/status', controller.updateGroupStatus)
router.patch('/:ruleId/group', controller.updateGroup)
router.patch('/:ruleId', controller.update)
router.delete('/:ruleId/group', controller.removeGroup)
router.delete('/:ruleId', controller.remove)

module.exports = router
