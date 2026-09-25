const { PDFParse } = require('pdf-parse')

// 解析
async function inspectPdf(buffer) {
  const parser = new PDFParse({ data: buffer })
  try {
    const [textResult, infoResult] = await Promise.all([
      parser.getText(),
      parser.getInfo({ parsePageInfo: true }),
    ])
    return {
      text: (textResult.text || '').trim(),
      pageCount: Number(infoResult.total) || 0,
    }
  } finally {
    await parser.destroy()
  }
}
// 获取文本
async function extractText(buffer) {
  const result = await inspectPdf(buffer)
  return result.text
}
// 获取页数
async function getPageCount(buffer) {
  const result = await inspectPdf(buffer)
  return result.pageCount
}

module.exports = { extractText, getPageCount, inspectPdf }
