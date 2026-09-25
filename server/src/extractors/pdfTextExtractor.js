let unpdfModulePromise

function loadUnpdf() {
  // Load the ESM package lazily without converting this CommonJS backend to ESM.
  unpdfModulePromise ||= import('unpdf')
  return unpdfModulePromise
}

// 读取 PDF 的文本和页数。
async function inspectPdf(buffer) {
  if (!buffer || typeof buffer.length !== 'number' || buffer.length === 0) {
    throw new Error('PDF input file is empty')
  }

  const { extractText: extractPdfText, getDocumentProxy } = await loadUnpdf()
  const data = Buffer.isBuffer(buffer) ? new Uint8Array(buffer) : buffer
  const document = await getDocumentProxy(data)

   
    const result = await extractPdfText(document, { mergePages: true })
    return {
      text: (typeof result.text === 'string' ? result.text : '').trim(),
      pageCount: Number(result.totalPages) || 0,
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
