const path = require('node:path')
const dotenv = require('dotenv')

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

function getExtractionConfig() {
  const envValue = (name) => (process.env[name] || '').trim()
  return {
    tencent: {
      secretId: envValue('TENCENTCLOUD_SECRET_ID'),
      secretKey: envValue('TENCENTCLOUD_SECRET_KEY'),
      region: envValue('TENCENTCLOUD_OCR_REGION') || 'ap-guangzhou',
      enablePdf: envValue('TENCENTCLOUD_OCR_ENABLE_PDF') !== 'false',
      enableMultiplePage: envValue('TENCENTCLOUD_OCR_ENABLE_MULTIPLE_PAGE') !== 'false',
      enableOther: envValue('TENCENTCLOUD_OCR_ENABLE_OTHER') !== 'false',
      maxPages: Number(envValue('TENCENTCLOUD_OCR_MAX_PAGES') || 30),
      maxBase64Size: Number(envValue('TENCENTCLOUD_OCR_MAX_BASE64_SIZE') || 10 * 1024 * 1024),
      rateLimitPerSecond: Number(envValue('TENCENTCLOUD_OCR_RATE_LIMIT') || 5),
      maxRetries: Number(envValue('TENCENTCLOUD_OCR_MAX_RETRIES') || 3),
      retryBaseDelayMs: Number(envValue('TENCENTCLOUD_OCR_RETRY_BASE_DELAY_MS') || 500),
    },
    agnes: {
      apiKey: envValue('AGNES_API_KEY'),
      baseURL: envValue('AGNES_BASE_URL') || 'https://apihub.agnes-ai.com/v1',
      model: envValue('AGNES_MODEL') || 'agnes-2.5-flash',
      timeout: Number(process.env.AGNES_TIMEOUT_MS || 30000),
    },
  }
}

module.exports = { getExtractionConfig }
