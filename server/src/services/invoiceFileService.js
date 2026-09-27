const fs = require('node:fs')
const fsPromises = require('node:fs/promises')
const path = require('node:path')
const invoiceFileRepository = require('../repositories/invoiceFileRepository')

function badRequest(message) {
  const error = new Error(message)
  error.statusCode = 400
  error.expose = true
  return error
}

function notFound(message) {
  const error = new Error(message)
  error.statusCode = 404
  error.expose = true
  return error
}

function parseFileId(fileId) {
  const id = Number(fileId)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('fileId invalid')
  return id
}

function getStoragePath(storageKey) {
  const storageRoot = path.resolve(__dirname, '../../../storage')
  const absolutePath = path.resolve(storageRoot, storageKey)
  const relativePath = path.relative(storageRoot, absolutePath)
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw badRequest('文件路径无效')
  }
  return absolutePath
}

async function getFileStream({ fileId, disposition }) {
  const id = parseFileId(fileId)
  const file = await invoiceFileRepository.findById(id)
  if (!file) throw notFound('文件不存在')

  const absolutePath = getStoragePath(file.storage_key)
  try {
    const stats = await fsPromises.stat(absolutePath)
    if (!stats.isFile()) throw notFound('文件不存在')
  } catch (error) {
    if (error.statusCode) throw error
    throw notFound('文件不存在')
  }

  return {
    file,
    absolutePath,
    stream: fs.createReadStream(absolutePath),
    disposition,
  }
}

module.exports = { getFileStream }
