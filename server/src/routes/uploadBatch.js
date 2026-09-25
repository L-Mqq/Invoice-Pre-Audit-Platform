const express = require('express')
const multer = require('multer')
const uploadBatchController = require('../controllers/uploadBatchController')

const router = express.Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 50, fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const isPdf = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')
    const isZip = file.mimetype === 'application/zip' || file.originalname.toLowerCase().endsWith('.zip')
    callback(null, isPdf || isZip)
  },
})

router.post('/', upload.array('files', 50), uploadBatchController.create)
router.get('/:batchId', uploadBatchController.getById)

module.exports = router
