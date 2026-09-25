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

  // 测试
  console.log('SecretId 长度:', tencent.secretId?.length)
  console.log('SecretId 前6位:', tencent.secretId?.slice(0, 6))
  console.log('SecretKey 长度:', tencent.secretKey?.length)
  console.log('SecretKey 前6位:', tencent.secretKey?.slice(0, 6))

  if (!tencent.secretId || !tencent.secretKey) {
    throw new Error('TENCENTCLOUD_SECRET_ID and TENCENTCLOUD_SECRET_KEY are required')
  }
  return new OcrClient({
    credential: { secretId: tencent.secretId, secretKey: tencent.secretKey },
    region: tencent.region,
    profile: { httpProfile: { endpoint: 'ocr.tencentcloudapi.com' } },
  })
}

// orc识别文本
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
      break
    } catch (error) {
      if (!isRetryable(error) || attempt === tencent.maxRetries) throw error
      await wait(tencent.retryBaseDelayMs * (2 ** attempt))
    }
  }
  // 高级票据接口返回的是结构化票据信息，转成文本供 Agnes 进一步统一结构化。
  const text = JSON.stringify(response.MixedInvoiceItems || response)
  return { text, rawResult: response, requestId: response.RequestId, provider: 'tencent-ocr' }
}

module.exports = { recognizeGeneralInvoice }
