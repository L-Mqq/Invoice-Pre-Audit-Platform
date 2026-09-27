const fs = require('node:fs/promises')
const path = require('node:path')
const { inspectPdf } = require('../extractors/pdfTextExtractor')
const { recognizeGeneralInvoice } = require('../extractors/tencentOcrExtractor')
const { structureInvoiceText } = require('../extractors/agnesInvoiceParser')

const storageRoot = path.resolve(__dirname, '../../../storage/eb2dc576-59be-4457-83e8-64a5c7b3238a/bed69e0c-98ea-48a8-82d7-5c2543dfa188-pass.pdf')

async function listFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await listFiles(target))
    else if (/\.(pdf|png|jpe?g|webp|bmp)$/i.test(entry.name)) files.push(target)
  }
  return files
}

async function main() {
  const files = await listFiles(storageRoot)
  if (!files.length) throw new Error('storage 下没有可测试的 PDF 或图片文件')
  const latest = (await Promise.all(files.map(async (filePath) => ({ filePath, stat: await fs.stat(filePath) }))))
    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)[0].filePath
  const buffer = await fs.readFile(latest)

  console.log('测试文件:', latest)
  console.log('文件大小:', buffer.length)

  let text = ''
  let ocrResult = null
  if (path.extname(latest).toLowerCase() === '.pdf') {
    const extracted = await inspectPdf(buffer)
    text = extracted.text || ''
    console.log('PDF 文本提取长度:', text.length)
    if (!text.trim()) {
      ocrResult = await recognizeGeneralInvoice(buffer)
      text = ocrResult.text || ''
    }
  } else {
    ocrResult = await recognizeGeneralInvoice(buffer)
    text = ocrResult.text || ''
  }

  if (!text.trim()) throw new Error('OCR 或 PDF 文本提取结果为空')
  console.log('OCR/文本内容：\n', text)
  if (ocrResult) console.log('OCR 原始结果：\n', JSON.stringify(ocrResult.rawResult || ocrResult, null, 2))

  const structured = await structureInvoiceText(text)
  console.log('AI 标准化结果：\n', JSON.stringify(structured.data, null, 2))
  console.log('AI 原始响应：\n', JSON.stringify(structured.rawResult, null, 2))
}

main().catch((error) => {
  console.error('AI 结构化测试失败:', error.message)
  process.exitCode = 1
})
