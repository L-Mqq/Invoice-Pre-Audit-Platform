const uploadBatchService = require('../services/uploadBatchService')

// 上传文件
async function create(req, res, next) {
  try {
    const batch = await uploadBatchService.createUploadBatch({
      files: req.files,
      createdBy: req.user?.id || null,
    })
    res.status(201).json({ success: true, message: '上传批次创建成功', data: { batch } })
  } catch (error) {
    next(error)
  }
}

async function getById(req, res, next) {
  try {
    const batch = await uploadBatchService.getUploadBatch(req.params.batchId)
    res.json({ success: true, data: { batch } })
  } catch (error) {
    next(error)
  }
}

module.exports = { create, getById }
