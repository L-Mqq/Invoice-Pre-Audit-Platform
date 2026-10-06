const fs = require('node:fs/promises')
const path = require('node:path')
require('dotenv').config({
  path: path.resolve(__dirname, '../../.env'),
})

const {
  getExtractionConfig,
} = require('../config/extraction')
const {
  SOURCE_TYPES,
  structureInvoiceText,
} = require('../extractors/agnesInvoiceParser')
const {
  inspectPdf,
} = require('../extractors/pdfTextExtractor')
const {
  recognizeGeneralInvoice,
} = require('../extractors/tencentOcrExtractor')

const projectRoot = path.resolve(__dirname, '../../..')
const storageDirectory = path.join(projectRoot, 'storage')
const diagnosticStartedAt = Date.now()

function getErrorDetails(error) {
  const cause = error?.cause

  return {
    name: error?.name || null,
    message: error?.message || '未知错误',
    code: error?.code || null,
    status: error?.status || error?.statusCode || null,
    type: error?.type || null,
    causeCode: cause?.code || null,
    causeMessage: cause?.message || null,
  }
}

function isPathInsideStorage(filePath) {
  const relativePath = path.relative(storageDirectory, filePath)

  return relativePath !== ''
    && !relativePath.startsWith('..')
    && !path.isAbsolute(relativePath)
}

async function findLatestStoredPdf(directory) {
  const entries = await fs.readdir(
    directory,
    {
      withFileTypes: true,
    },
  )
  const candidates = []

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      const nestedFiles = await findLatestStoredPdf(entryPath)

      candidates.push(...nestedFiles)
      continue
    }

    if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.pdf') {
      const stats = await fs.stat(entryPath)

      candidates.push({
        path: entryPath,
        modifiedAt: stats.mtimeMs,
      })
    }
  }

  return candidates
}

async function getTestPdfPath() {
  const requestedPath = process.argv[2]

  if (requestedPath) {
    const absolutePath = path.isAbsolute(requestedPath)
      ? requestedPath
      : path.resolve(projectRoot, requestedPath)

    if (!isPathInsideStorage(absolutePath)) {
      throw new Error('测试文件必须位于项目根目录的 storage 目录内')
    }

    return absolutePath
  }

  const candidates = await findLatestStoredPdf(storageDirectory)

  if (candidates.length === 0) {
    throw new Error('storage 目录中没有可测试的 PDF 文件')
  }

  candidates.sort((first, second) => second.modifiedAt - first.modifiedAt)

  return candidates[0].path
}

async function getTestInput() {
  const pdfPath = await getTestPdfPath()
  const pdfBuffer = await fs.readFile(pdfPath)
  const pdfInspectionStartedAt = Date.now()

  console.log('开始提取 PDF 原始文本')

  const {
    text,
    pageCount,
  } = await inspectPdf(pdfBuffer)

  console.log('PDF 原始文本提取完成')
  console.log('PDF 文本提取耗时（毫秒）：', Date.now() - pdfInspectionStartedAt)
  console.log('PDF 页数：', pageCount)
  console.log('PDF 文本长度：', text.length)

  if (text) {
    return {
      sourceType: SOURCE_TYPES.PDF_TEXT,
      text,
      description: pdfPath,
      pageCount,
      usedOcrFallback: false,
    }
  }

  const ocrStartedAt = Date.now()

  console.log('PDF 未提取到文本，开始腾讯 OCR 兜底')

  const ocrResult = await recognizeGeneralInvoice(pdfBuffer)

  console.log('腾讯 OCR 完成')
  console.log('腾讯 OCR 耗时（毫秒）：', Date.now() - ocrStartedAt)
  console.log('腾讯 OCR 请求 ID：', ocrResult.requestId || '无')
  console.log('腾讯 OCR 输出长度：', ocrResult.text.length)

  if (!ocrResult.text.trim()) {
    throw new Error('腾讯 OCR 未返回可用于 AI 结构化的文本')
  }

  return {
    sourceType: SOURCE_TYPES.TENCENT_OCR,
    text: ocrResult.text,
    description: pdfPath,
    pageCount,
    usedOcrFallback: true,
  }
}

async function main() {
  const startedAt = diagnosticStartedAt
  const {
    agnes,
  } = getExtractionConfig()

  console.log('开始 Agnes 结构化诊断')
  console.log('模型：', agnes.model)
  console.log('接口地址：', agnes.baseURL)
  console.log('超时配置（毫秒）：', agnes.timeout)

  const input = await getTestInput()

  console.log('测试 PDF：', input.description)
  console.log('PDF 页数：', input.pageCount)
  console.log('是否使用 OCR 兜底：', input.usedOcrFallback ? '是' : '否')
  console.log('结构化来源类型：', input.sourceType)
  console.log('AI 输入长度：', input.text.length)
  console.log('开始调用 Agnes 结构化')

  const agnesStartedAt = Date.now()

  try {
    const result = await structureInvoiceText(
      input.text,
      {
        sourceType: input.sourceType,
      },
    )

    console.log('结构化成功')
    console.log('Agnes 结构化耗时（毫秒）：', Date.now() - agnesStartedAt)
    console.log('总耗时（毫秒）：', Date.now() - startedAt)
    console.log('结构化结果：', JSON.stringify(result.data, null, 2))
  } catch (error) {
    console.error('结构化失败')
    console.error('Agnes 结构化耗时（毫秒）：', Date.now() - agnesStartedAt)
    console.error('总耗时（毫秒）：', Date.now() - startedAt)
    console.error('错误详情：', JSON.stringify(getErrorDetails(error), null, 2))
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error('诊断脚本异常：', error.message)
  console.error('总耗时（毫秒）：', Date.now() - diagnosticStartedAt)
  console.error('错误详情：', JSON.stringify(getErrorDetails(error), null, 2))
  process.exitCode = 1
})
