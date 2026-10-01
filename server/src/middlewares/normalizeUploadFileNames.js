const { normalizeUploadFileName } = require('../utils/fileName')

function normalizeFileName(file) {
  if (!file) {
    return
  }

  file.originalname = normalizeUploadFileName(file.originalname)
}
// 在 Multer 解析文件后，统一修复 req.file 或 req.files 的 originalname
function normalizeUploadFileNames(req, res, next) {
  if (req.file) {
    normalizeFileName(req.file)
  }

  if (Array.isArray(req.files)) {
    for (const file of req.files) {
      normalizeFileName(file)
    }
  }

  next()
}

module.exports = normalizeUploadFileNames
