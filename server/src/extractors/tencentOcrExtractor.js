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

function normalizeFieldName(value) {
  return String(value || '').replace(/[\s:：]/g, '')
}

function firstField(fields, aliases) {
  const aliasSet = new Set(aliases.map(normalizeFieldName))
  return fields.find((field) => aliasSet.has(normalizeFieldName(field.name)))?.value || null
}

// 将腾讯混贴发票的通用字段名映射为项目统一字段，避免直接把供应商 JSON 当作 OCR 原文交给 Agnes。
function normalizeMixedInvoiceItems(items) {
  if (!Array.isArray(items)) return []

  return items.map((item) => {
    const fields = (Array.isArray(item.SingleInvoiceInfos) ? item.SingleInvoiceInfos : [])
      .filter((field) => field && field.Value != null)
      .map((field) => ({ name: field.Name || '', value: String(field.Value), row: field.Row ?? -1 }))

    return {
      page: item.Page ?? null,
      invoiceType: item.Type ?? null,
      invoiceNumber: firstField(fields, ['发票号码', '发票号', '数电号码']),
      invoiceDate: firstField(fields, ['开票日期', '日期']),
      sellerName: firstField(fields, ['销售方名称', '销售方']),
      sellerTaxId: firstField(fields, ['销售方纳税人识别号', '销售方税号']),
      buyerName: firstField(fields, ['购买方名称', '购买方']),
      buyerTaxId: firstField(fields, ['购买方纳税人识别号', '购买方税号']),
      totalAmount: firstField(fields, ['价税合计小写', '价税合计', '合计金额']),
      taxAmount: firstField(fields, ['合计税额', '税额']),
      amountWithoutTax: firstField(fields, ['不含税金额', '税前金额']),
      items: [],
      sourceFields: fields,
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
