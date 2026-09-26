const tencentcloud = require('tencentcloud-sdk-nodejs-ocr')
const { getExtractionConfig } = require('../config/extraction')

const OcrClient = tencentcloud.ocr.v20181119.Client
let lastRequestAt = 0
let requestQueue = Promise.resolve()

function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)) }

// 判断是否可重试
function isRetryable(error) {
  const code = String(error?.code || error?.Code || '')
  const status = Number(error?.statusCode || error?.status || error?.response?.status)
  return status === 429 || status >= 500 || /Limit|RequestLimit|Internal|Timeout|Network|Unavailable/i.test(code)
}

// 限流队列
function enqueue(request) {
  const task = requestQueue.then(async () => {
    const { tencent } = getExtractionConfig()
    const interval = Math.ceil(1000 / Math.max(1, tencent.rateLimitPerSecond))
    const waitTime = Math.max(0, interval - (Date.now() - lastRequestAt))
    if (waitTime > 0) await wait(waitTime)
    lastRequestAt = Date.now()
    return request()
  })
  requestQueue = task.catch(() => {})
  return task
}

// 建客户端
function getClient() {
  const { tencent } = getExtractionConfig()

   console.log('Region:', JSON.stringify(tencent.region))

  if (!tencent.secretId || !tencent.secretKey) {
    throw new Error('TENCENTCLOUD_SECRET_ID and TENCENTCLOUD_SECRET_KEY are required')
  }
  return new OcrClient({
    credential: { secretId: tencent.secretId, secretKey: tencent.secretKey },
    region: tencent.region,
    profile: { httpProfile: { endpoint: 'ocr.tencentcloudapi.com' } },
  })
}

// 按 SubType 提取腾讯 OCR 的票种结构化对象，交给 Agnes 统一输出项目 Schema。
function normalizeMixedInvoiceItems(items) {
  if (!Array.isArray(items)) return []

  return items.map((item) => {
    const singleInvoiceInfos = item.SingleInvoiceInfos
    const subType = item.SubType || null
    const subtypeResult = subType && singleInvoiceInfos && !Array.isArray(singleInvoiceInfos)
      ? singleInvoiceInfos[subType] ?? null
      : null
    const fields = (Array.isArray(singleInvoiceInfos) ? singleInvoiceInfos : [])
      .filter((field) => field && field.Value != null)
      .map((field) => ({ name: field.Name || '', value: String(field.Value), row: field.Row ?? -1 }))

    return {
      page: item.Page ?? null,
      invoiceType: item.Type ?? null,
      subType,
      subTypeDescription: item.SubTypeDescription ?? null,
      data: subtypeResult,
      fields,
    }
  })
}

// OCR 识别并转换成统一结构文本，供 Agnes 继续做字段补全和标准化。
async function recognizeGeneralInvoice(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new Error('OCR input file is empty')
  const { tencent } = getExtractionConfig()
  const imageBase64 = buffer.toString('base64')
  const encodedSize = Buffer.byteLength(imageBase64, 'utf8')
  if (encodedSize > tencent.maxBase64Size) {
    const error = new Error(`OCR Base64 内容超过限制：${tencent.maxBase64Size} bytes`)
    error.code = 'OCR_BASE64_TOO_LARGE'
    throw error
  }

  const client = getClient()
  const request = () => client.RecognizeGeneralInvoice({
    ImageBase64: imageBase64,
    EnablePdf: tencent.enablePdf,
    EnableMultiplePage: tencent.enableMultiplePage,
    EnableOther: tencent.enableOther,
  })
  let response
  for (let attempt = 0; attempt <= tencent.maxRetries; attempt += 1) {
    try {
      response = await enqueue(request)
      console.log(response);
      
      break
    } catch (error) {
    

      if (!isRetryable(error) || attempt === tencent.maxRetries) throw error
      await wait(tencent.retryBaseDelayMs * (2 ** attempt))
    }
  }
  const normalizedItems = normalizeMixedInvoiceItems(response.MixedInvoiceItems)
  const text = JSON.stringify({ invoices: normalizedItems })
  return { text, rawResult: response, requestId: response.RequestId, provider: 'tencent-ocr' }
}

module.exports = { recognizeGeneralInvoice }
