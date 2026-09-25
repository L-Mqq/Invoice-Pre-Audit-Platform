const tencentcloud = require('tencentcloud-sdk-nodejs-ocr')
const { getExtractionConfig } = require('../config/extraction')

const OcrClient = tencentcloud.ocr.v20181119.Client

function getClient() {
  const { tencent } = getExtractionConfig()
  if (!tencent.secretId || !tencent.secretKey) {
    throw new Error('TENCENTCLOUD_SECRET_ID and TENCENTCLOUD_SECRET_KEY are required')
  }
  return new OcrClient({
    credential: { secretId: tencent.secretId, secretKey: tencent.secretKey },
    region: tencent.region,
    profile: { httpProfile: { endpoint: 'ocr.tencentcloudapi.com' } },
  })
}

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
  const response = await client.RecognizeGeneralInvoice({
    ImageBase64: imageBase64,
    EnablePdf: tencent.enablePdf,
    EnableMultiplePage: tencent.enableMultiplePage,
    EnableOther: tencent.enableOther,
  })
  // 高级票据接口返回的是结构化票据信息，转成文本供 Agnes 进一步统一结构化。
  const text = JSON.stringify(response.MixedInvoiceItems || response)
  return { text, rawResult: response, provider: 'tencent-ocr' }
}

module.exports = { recognizeGeneralInvoice }
