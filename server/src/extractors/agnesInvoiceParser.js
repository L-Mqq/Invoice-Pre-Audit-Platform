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
  items: [
    {
      itemName: null,
      quantity: null,
      unitPrice: null,
      amount: null,
    },
  ],
}

function firstValue(source, names) {
  for (const name of names) {
    if (source?.[name] !== undefined && source[name] !== null && source[name] !== '') return source[name]
  }
  return null
}

function normalizeItem(item) {
  const source = item && typeof item === 'object' ? item : {}
  return {
    itemName: firstValue(source, ['itemName', 'name', 'Name', '商品名称', '项目名称']),
    quantity: firstValue(source, ['quantity', 'Quantity', '数量']),
    unitPrice: firstValue(source, ['unitPrice', 'UnitPrice','Price', '单价']),
    amount: firstValue(source, ['amount', 'Amount', 'AmountWithoutTax','Total', '金额', '不含税金额']),
  }
}

function normalizeStructuredResult(result) {
  const source = result && typeof result === 'object' ? result : {}
  const items = Array.isArray(source.items)
    ? source.items.map(normalizeItem)
    : Array.isArray(source.VatElectronicItems)
      ? source.VatElectronicItems.map(normalizeItem)
      : Array.isArray(source.VatInvoiceItems)
        ? source.VatInvoiceItems.map(normalizeItem)
        : []

  return {
    invoiceNumber: firstValue(source, ['invoiceNumber', 'InvoiceNumber', 'Number', '发票号码', '数电号码']),
    invoiceDate: firstValue(source, ['invoiceDate', 'InvoiceDate', 'Date', '开票日期']),
    sellerName: firstValue(source, ['sellerName', 'SellerName', 'Seller', '销售方名称']),
    sellerTaxId: firstValue(source, ['sellerTaxId', 'SellerTaxId', 'SellerTaxID', '销售方纳税人识别号']),
    buyerName: firstValue(source, ['buyerName', 'BuyerName', 'Buyer', '购买方名称']),
    buyerTaxId: firstValue(source, ['buyerTaxId', 'BuyerTaxId', 'BuyerTaxID', '购买方纳税人识别号']),
    totalAmount: firstValue(source, ['totalAmount', 'TotalAmount', 'Total', '价税合计']),
    taxAmount: firstValue(source, ['taxAmount', 'TaxAmount', 'Tax', '税额']),
    amountWithoutTax: firstValue(source, ['amountWithoutTax', 'AmountWithoutTax', 'PretaxAmount', '不含税金额']),
    items,
  }
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
  return { data: normalizeStructuredResult(result), rawResult: response, provider: 'agnes-2.5-flash' }
}

module.exports = { structureInvoiceText, normalizeStructuredResult }
