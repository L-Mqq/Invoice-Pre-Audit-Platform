const fs = require('node:fs')
const fsPromises = require('node:fs/promises')
const path = require('node:path')
const voucherRepository = require('../repositories/voucherRepository')

function createHttpError(statusCode, message) {
  const error = new Error(message)

  error.statusCode = statusCode
  error.expose = true

  return error
}

// voucherId 合法性校验
function parsePositiveInteger(value, fieldName) {
  const parsed = Number(value)

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw createHttpError(400, `${fieldName} 无效`)
  }

  return parsed
}

// storage_key 安全路径解析
// 防止 ../ 路径穿越
function getStoragePath(storageKey) {
  const storageRoot = path.resolve(__dirname, '../../../storage')
  const absolutePath = path.resolve(storageRoot, storageKey)
  const relativePath = path.relative(storageRoot, absolutePath)

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw createHttpError(400, '凭证文件路径无效')
  }

  return absolutePath
}

// 创建文件读取流 读取文件
async function getVoucherFileStream({
  voucherId,
  disposition,
}) {
  const normalizedVoucherId = parsePositiveInteger(voucherId, 'voucherId')
  const voucher = await voucherRepository.findVoucherFileById({
    voucherId: normalizedVoucherId,
  })

  if (!voucher) {
    throw createHttpError(404, '凭证文件不存在')
  }

  const absolutePath = getStoragePath(voucher.storage_key)

  try {
    const stats = await fsPromises.stat(absolutePath)

    if (!stats.isFile()) {
      throw createHttpError(404, '凭证文件不存在')
    }
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    throw createHttpError(404, '凭证文件不存在')
  }

  return {
    absolutePath,
    disposition,
    // 流式返回给前端
    stream: fs.createReadStream(absolutePath),
    voucher,
  }
}

module.exports = {
  getVoucherFileStream,
}
