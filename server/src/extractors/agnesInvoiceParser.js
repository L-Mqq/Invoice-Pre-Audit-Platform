const OpenAI = require('openai')
const { getExtractionConfig } = require('../config/extraction')

const invoiceSchema = {
  invoiceNumber: null,
  invoiceDate: null,
  sellerName: null,
  sellerTaxId: null,
  buyerName: null,
  buyerTaxId: null,
  totalAmount: null,
  taxAmount: null,
  amountWithoutTax: null,
  items: [],
}

function getClient() {
  const { agnes } = getExtractionConfig()
  if (!agnes.apiKey) throw new Error('AGNES_API_KEY is required')
  return new OpenAI({ apiKey: agnes.apiKey, baseURL: agnes.baseURL, timeout: agnes.timeout })
}

async function structureInvoiceText(text) {
  if (!text || !text.trim()) throw new Error('OCR text is empty')
  const { agnes } = getExtractionConfig()
  const client = getClient()
  const response = await client.chat.completions.create({
    model: agnes.model,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: '你是发票信息结构化助手。只能根据输入文本提取信息，不要猜测。缺失字段返回 null，商品明细没有则返回空数组。只返回 JSON。' },
      { role: 'user', content: `请严格按照以下 JSON 结构输出：\n${JSON.stringify(invoiceSchema)}\n\nOCR 原文：\n${text}` },
    ],
  })
  const content = response.choices?.[0]?.message?.content
  if (!content) throw new Error('Agnes returned empty structured result')
  let result
  try { result = JSON.parse(content) } catch { throw new Error('Agnes returned invalid JSON') }
  return { data: { ...invoiceSchema, ...result, items: Array.isArray(result.items) ? result.items : [] }, rawResult: response, provider: 'agnes-2.5-flash' }
}

module.exports = { structureInvoiceText }
