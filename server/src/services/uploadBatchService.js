const AdmZip = require('adm-zip')
const { randomUUID, createHash } = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')
const { pool } = require('../config/database')
const uploadBatchRepository = require('../repositories/uploadBatchRepository')
const invoiceFileRepository = require('../repositories/invoiceFileRepository')

function badRequest(message) {
  const error = new Error(message)
  error.statusCode = 400
  error.expose = true
  return error
}

// 判断上传的文件类型
function classify(files) {
  const extensions = files.map((file) => path.extname(file.originalname).toLowerCase())
  const hasZip = extensions.includes('.zip')
  const hasPdf = extensions.includes('.pdf')
  if (hasZip && hasPdf) throw badRequest('暂不支持 PDF 和 ZIP 混合上传')
  if (hasZip && files.length !== 1) throw badRequest('暂时只支持单个 ZIP 文件上传')
  if (!hasZip && !extensions.every((extension) => extension === '.pdf')) throw badRequest('只支持 PDF 文件或 ZIP 文件')
  if (hasZip) return 'zip'
  return files.length === 1 ? 'pdf' : 'multiple_pdf'
}

// 生成pdf文件列表
function createPdfItem(buffer, originalName, mimeType = 'application/pdf') {
  return { buffer, originalName, mimeType, fileSize: buffer.length }
}

// 解压zip
function extractZip(file, batchId) {
  const zip = new AdmZip(file.buffer)
  const entries = zip.getEntries()
  const pdfEntries = entries.filter((entry) => !entry.isDirectory && path.extname(entry.entryName).toLowerCase() === '.pdf')
  if (pdfEntries.length === 0) throw badRequest('ZIP 中未找到 PDF 文件')
  return pdfEntries.map((entry) => createPdfItem(entry.getData(), path.basename(entry.entryName)))
}

// 创建上传批次
async function createUploadBatch({ files, createdBy = null }) {
  if (!Array.isArray(files) || files.length === 0) throw badRequest('请至少上传一个 PDF 或 ZIP 文件')
  const fileType = classify(files)
  const batchId = randomUUID()
  const pdfFiles = fileType === 'zip' ? extractZip(files[0], batchId) : files.map((file) => createPdfItem(file.buffer, file.originalname, file.mimetype))
  const storageDirectory = path.resolve(__dirname, '../../../storage', batchId)
  const savedPaths = []
  const connection = await pool.getConnection()

  try {
    await fs.mkdir(storageDirectory, { recursive: true })
    await connection.beginTransaction()
    const batch = await uploadBatchRepository.createBatch({ connection, id: batchId, originalName: files.length === 1 ? files[0].originalname : `${files.length} 个 PDF 文件`, fileType, totalCount: pdfFiles.length, createdBy })
    const storedFiles = []

    for (const file of pdfFiles) {
      const sha256 = createHash('sha256').update(file.buffer).digest('hex')
      const safeName = `${randomUUID()}-${path.basename(file.originalName)}`
      const absolutePath = path.join(storageDirectory, safeName)
      await fs.writeFile(absolutePath, file.buffer)
      savedPaths.push(absolutePath)
      storedFiles.push(await invoiceFileRepository.createFile({ connection, batchId, originalName: file.originalName, storageKey: path.posix.join(batchId, safeName), mimeType: file.mimeType, fileSize: file.fileSize, sha256 }))
    }

    await uploadBatchRepository.updateStatus({ connection, id: batchId, status: 'processing' })
    await connection.commit()
    return { ...batch, status: 'processing', totalCount: pdfFiles.length, files: storedFiles }
  } catch (error) {
    await connection.rollback()
    await Promise.allSettled(savedPaths.map((filePath) => fs.unlink(filePath)))
    throw error
  } finally {
    connection.release()
  }
}

async function getUploadBatch(batchId) {
  const batch = await uploadBatchRepository.findById(batchId)
  if (!batch) { const error = new Error('上传批次不存在'); error.statusCode = 404; error.expose = true; throw error }
  const files = await invoiceFileRepository.findByBatchId(batchId)
  return { ...batch, files }
}

module.exports = { createUploadBatch, getUploadBatch }
