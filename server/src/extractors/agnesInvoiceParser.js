const OpenAI = require('openai')
const { getExtractionConfig } = require('../config/extraction')

const invoiceSchema = {
  invoiceNumber: null,  //发票号码
  invoiceDate: null,   //开票日期
  sellerName: null,    //销售方名字
  sellerTaxId: null,   //销售方税号
  buyerName: null,    //买方
  buyerTaxId: null,   //买方税号
  totalAmount: null,   //总计
  taxAmount: null,    //税额总计
  amountWithoutTax: null,  //不包括税额的价格总计
  items: [],           //包含的商品
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

console.log('AI 输入长度:', text.length)
console.log('AI 输入前 500 字:', text.slice(0, 500))

  const response = await client.chat.completions.create({
    model: agnes.model,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: '你是发票信息结构化助手。输入是腾讯 OCR 按 SubType 返回的票种结构化 JSON，data 中包含该票种的字段和商品明细。只能根据输入中已有内容提取，不要猜测、计算或补造缺失值。缺失字段必须返回 null；商品明细只能从输入中已有的商品明细数组或明确的 fields 行号组装，否则返回空数组。只返回 JSON。' },
      { role: 'user', content: `请严格按照以下 JSON 结构输出：\n${JSON.stringify(invoiceSchema)}\n\n腾讯 OCR 结构化 JSON：\n${text}` },
    ],
  })
  const content = response.choices?.[0]?.message?.content
  if (!content) throw new Error('Agnes returned empty structured result')

  console.log('AI 原始返回:', content)


  let result
  try { 
    result = JSON.parse(content) 
    console.log(result)
    
  } catch { 
    throw new Error('Agnes returned invalid JSON') 
  }
  return { data: { ...invoiceSchema, ...result, items: Array.isArray(result.items) ? result.items : [] }, rawResult: response, provider: 'agnes-2.5-flash' }
}

module.exports = { structureInvoiceText }
