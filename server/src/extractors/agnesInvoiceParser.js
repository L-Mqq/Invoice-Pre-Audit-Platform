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

function normalizeDecimalValue(value) {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? value.toString()
      : null
  }

  if (typeof value !== 'string') {
    return value
  }

  const normalizedValue = value
    .replace(/[￥¥元,\s]/g, '')
    .trim()

  return normalizedValue || null
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
    unitPrice: normalizeDecimalValue(firstValue(source, [
      'unitPrice',
      'UnitPrice',
      'Price',
      '单价',
    ])),
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
    ? '你是发票结构化助手。输入是腾讯 OCR JSON，只返回符合指定 Schema 的 JSON。'
    : '你是发票结构化助手。输入是 PDF 原始文本，只返回符合指定 Schema 的 JSON。'
  const sourceDescription = isOcrSource
    ? '腾讯 OCR 结构化 JSON'
    : 'PDF 原始文本'
  const sourceRules = isOcrSource
    ? `OCR 的 data 是已结构化字段，优先级高于 fields；fields 仅可按字段名称和相同 row 补充，不能跨行组合。当 subType 为 VatElectronicInvoiceFull 时，必须直接映射：invoiceNumber=data.Number，invoiceDate=data.Date，sellerName=data.Seller，sellerTaxId=data.SellerTaxID，totalAmount=data.Total，taxAmount=data.Tax，amountWithoutTax=data.PretaxAmount；items 必须逐项映射 data.VatElectronicItems，itemName=Name，quantity=Quantity，unitPrice=Price，amount=Total。`
    : `PDF 文本中的表格列可能被拆散或错序。必须依据表头和同一商品行确认列归属，不能仅根据相邻数字猜测字段。`
  const extractionRules = [
    '仅提取输入中明确存在的值；无法可靠确认时返回 null，不得编造、计算、修正或补全。',
    '金额和数量必须是十进制字符串；unitPrice 必须保留原始精度，例如 "0.9424778761062"。',
    '每个 items 元素只能对应同一商品行，itemName、quantity、unitPrice、amount 不得跨行组合。',
    'quantity 只能取数量字段；unitPrice 只能取单价字段；amount 只能取该商品行金额或不含税金额。',
    '税额、税率、商品金额和价税合计均不得填入 unitPrice；不得通过数量、金额、税率或税额反推单价。',
    'amountWithoutTax 只能取发票合计的不含税金额；totalAmount 只能取价税合计。',
  ].join('\n- ')

  return [
    {
      role: 'system',
      content: systemContent,
    },
    {
      role: 'user',
      content: `请严格按照以下 JSON 结构输出：\n${JSON.stringify(invoiceSchema)}\n\n提取规则：\n- ${extractionRules}\n- ${sourceRules}\n\n${sourceDescription}：\n${text}`,
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
  createMessages,
  isEmptyInvoiceTemplate,
  normalizeDecimalValue,
  normalizeStructuredResult,
  structureInvoiceText,
}
