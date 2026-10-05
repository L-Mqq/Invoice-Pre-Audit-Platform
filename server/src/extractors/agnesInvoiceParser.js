const OpenAI = require('openai')
const { getExtractionConfig } = require('../config/extraction')

const SOURCE_TYPES = {
  PDF_TEXT: 'pdf_text',
  TENCENT_OCR: 'tencent_ocr',
}

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
    if (
      source?.[name] !== undefined
      && source[name] !== null
      && source[name] !== ''
    ) {
      return source[name]
    }
  }

  return null
}

function normalizeItem(item) {
  const source = item && typeof item === 'object'
    ? item
    : {}

  return {
    itemName: firstValue(source, [
      'itemName',
      'name',
      'Name',
      '商品名称',
      '项目名称',
    ]),
    quantity: firstValue(source, [
      'quantity',
      'Quantity',
      '数量',
    ]),
    unitPrice: firstValue(source, [
      'unitPrice',
      'UnitPrice',
      'Price',
      '单价',
    ]),
    amount: firstValue(source, [
      'amount',
      'Amount',
      'AmountWithoutTax',
      'Total',
      '金额',
      '不含税金额',
    ]),
  }
}

function normalizeStructuredResult(result) {
  const source = result && typeof result === 'object'
    ? result
    : {}
  const items = Array.isArray(source.items)
    ? source.items.map(normalizeItem)
    : Array.isArray(source.VatElectronicItems)
      ? source.VatElectronicItems.map(normalizeItem)
      : Array.isArray(source.VatInvoiceItems)
        ? source.VatInvoiceItems.map(normalizeItem)
        : []

  return {
    invoiceNumber: firstValue(source, [
      'invoiceNumber',
      'InvoiceNumber',
      'Number',
      '发票号码',
      '数电号码',
    ]),
    invoiceDate: firstValue(source, [
      'invoiceDate',
      'InvoiceDate',
      'Date',
      '开票日期',
    ]),
    sellerName: firstValue(source, [
      'sellerName',
      'SellerName',
      'Seller',
      '销售方名称',
    ]),
    sellerTaxId: firstValue(source, [
      'sellerTaxId',
      'SellerTaxId',
      'SellerTaxID',
      '销售方纳税人识别号',
    ]),
    buyerName: firstValue(source, [
      'buyerName',
      'BuyerName',
      'Buyer',
      '购买方名称',
    ]),
    buyerTaxId: firstValue(source, [
      'buyerTaxId',
      'BuyerTaxId',
      'BuyerTaxID',
      '购买方纳税人识别号',
    ]),
    totalAmount: firstValue(source, [
      'totalAmount',
      'TotalAmount',
      'Total',
      '价税合计',
    ]),
    taxAmount: firstValue(source, [
      'taxAmount',
      'TaxAmount',
      'Tax',
      '税额',
    ]),
    amountWithoutTax: firstValue(source, [
      'amountWithoutTax',
      'AmountWithoutTax',
      'PretaxAmount',
      '不含税金额',
    ]),
    items,
  }
}

function isBlank(value) {
  return value === null
    || value === undefined
    || (typeof value === 'string' && value.trim() === '')
}

// 模型若直接照抄 Schema，会得到没有任何有效信息的空模板。
function isEmptyInvoiceTemplate(data) {
  const source = data && typeof data === 'object'
    ? data
    : {}
  const hasInvoiceValue = [
    'sellerName',
    'sellerTaxId',
    'invoiceDate',
    'totalAmount',
  ].some((field) => {
    return !isBlank(source[field])
  })
  const items = Array.isArray(source.items)
    ? source.items
    : []
  const hasItemValue = items.some((item) => {
    if (!item || typeof item !== 'object') {
      return false
    }

    return [
      'itemName',
      'quantity',
      'unitPrice',
      'amount',
    ].some((field) => {
      return !isBlank(item[field])
    })
  })

  return !hasInvoiceValue && !hasItemValue
}

function createMessages({
  sourceType,
  text,
}) {
  const isOcrSource = sourceType === SOURCE_TYPES.TENCENT_OCR
  const systemContent = isOcrSource
    ? '你是发票信息结构化助手。输入是腾讯 OCR 返回的 JSON。请从其中已识别字段提取发票信息和商品明细。只返回 JSON，不得编造。'
    : '你是发票信息结构化助手。输入是从 PDF 提取的原始发票文本，不是腾讯 OCR JSON。请依据文本提取发票信息和商品明细。只返回 JSON，不得编造。'
  const sourceDescription = isOcrSource
    ? '腾讯 OCR 结构化 JSON'
    : 'PDF 原始文本'

  return [
    {
      role: 'system',
      content: systemContent,
    },
    {
      role: 'user',
      content: `请严格按照以下 JSON 结构输出：\n${JSON.stringify(invoiceSchema)}\n\n规则：输入中能够明确识别的字段必须填写；仅在输入中确实不存在或无法可靠识别时才填写 null；不得直接照抄示例中的 null。\n\n${sourceDescription}：\n${text}`,
    },
  ]
}

function getClient() {
  const { agnes } = getExtractionConfig()

  if (!agnes.apiKey) {
    throw new Error('AGNES_API_KEY is required')
  }

  return new OpenAI({
    apiKey: agnes.apiKey,
    baseURL: agnes.baseURL,
    timeout: agnes.timeout,
  })
}

async function structureInvoiceText(
  text,
  {
    sourceType = SOURCE_TYPES.TENCENT_OCR,
  } = {},
) {
  if (!text || !text.trim()) {
    throw new Error('Invoice source text is empty')
  }

  if (!Object.values(SOURCE_TYPES).includes(sourceType)) {
    throw new Error('Unsupported invoice source type')
  }

  const { agnes } = getExtractionConfig()
  const client = getClient()

  console.log('Invoice structuring source type:', sourceType)
  console.log('AI input length:', text.length)

  const response = await client.chat.completions.create({
    model: agnes.model,
    temperature: 0,
    response_format: {
      type: 'json_object',
    },
    messages: createMessages({
      sourceType,
      text,
    }),
  })
  const content = response.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('Agnes returned empty structured result')
  }

  let result

  try {
    result = JSON.parse(content)
  } catch {
    throw new Error('Agnes returned invalid JSON')
  }

  return {
    data: normalizeStructuredResult(result),
    rawResult: response,
    provider: agnes.model,
    sourceType,
  }
}

module.exports = {
  SOURCE_TYPES,
  isEmptyInvoiceTemplate,
  normalizeStructuredResult,
  structureInvoiceText,
}
