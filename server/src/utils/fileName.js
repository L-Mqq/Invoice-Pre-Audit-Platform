const path = require('node:path')

// 从完整路径里，提取文件名
function getBaseName(fileName) {
  return path.posix.basename(
    fileName.replace(/\\/g, '/'),
  )
}

// 判断文件名能不能用 latin1 解码
function canBeDecodedFromLatin1(fileName) {
  return Array.from(fileName).every((character) => {
    return character.codePointAt(0) <= 0xff
  })
}

// 把乱码文件名恢复正常
function normalizeUploadFileName(fileName) {
  if (typeof fileName !== 'string' || !fileName.trim()) {
    return 'unnamed-file'
  }

  const baseName = getBaseName(fileName.trim())

  if (!canBeDecodedFromLatin1(baseName)) {
    return baseName
  }

  const decodedName = Buffer.from(baseName, 'latin1').toString('utf8')

  if (decodedName.includes('\ufffd')) {
    return baseName
  }

  return getBaseName(decodedName)
}

module.exports = {
  normalizeUploadFileName,
}
