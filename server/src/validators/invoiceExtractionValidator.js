const REQUIRED_FIELDS = ['sellerName', 'sellerTaxId', 'invoiceDate', 'totalAmount', 'items']

const OUTPUT_FIELDS = [
  'invoiceNumber',
  'invoiceDate',
  'sellerName',
  'sellerTaxId',
  'buyerName',
  'buyerTaxId',
  'totalAmount',
  'taxAmount',
  'amountWithoutTax',
  'items',
]

// 判断是否为空值
function isBlank(value) {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
}

// 把值转成合法数字
function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string' || value.trim() === '') return null
  const normalized = value.replace(/[￥¥元,，\s]/g, '')
  const number = Number(normalized)
  return Number.isFinite(number) ? number : null
}

// 判断是否是合法日期
function isValidDate(value) {
  if (typeof value !== 'string' || !value.trim()) return false
  const normalized = value.trim().replace(/[年/.]/g, '-').replace(/月/g, '-').replace(/日/g, '')
  const date = new Date(normalized)
  return !Number.isNaN(date.getTime())
}

// 构造错误对象
function createError(field, code, message, index = null) {
  return { field, code, message, ...(index === null ? {} : { index }) }
}

// 主校验函数
function validateInvoiceExtraction(input) {
  const errors = []
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const data = Object.fromEntries(OUTPUT_FIELDS.map((field) => [field, source[field] ?? (field === 'items' ? [] : null)]))

  for (const field of REQUIRED_FIELDS) {
    if (field === 'items') {
      if (!Array.isArray(data.items) || data.items.length === 0) {
        errors.push(createError(field, 'REQUIRED', '商品明细不能为空'))
      }
    } else if (isBlank(data[field])) {
      errors.push(createError(field, 'REQUIRED', `${field}不能为空`))
    }
  }

  if (!isBlank(data.sellerName) && typeof data.sellerName !== 'string') {
    errors.push(createError('sellerName', 'TYPE', '销售方名称必须是字符串'))
  }
  if (!isBlank(data.sellerTaxId) && typeof data.sellerTaxId !== 'string') {
    errors.push(createError('sellerTaxId', 'TYPE', '销售方纳税人识别号必须是字符串'))
  }
  if (!isBlank(data.invoiceDate) && !isValidDate(data.invoiceDate)) {
    errors.push(createError('invoiceDate', 'FORMAT', '发票日期格式无效'))
  }

  for (const field of ['totalAmount', 'taxAmount', 'amountWithoutTax']) {
    if (!isBlank(data[field]) && toNumber(data[field]) === null) {
      errors.push(createError(field, 'FORMAT', `${field}必须是合法金额`))
    }
  }

  if (Array.isArray(data.items)) {
    data.items.forEach((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        errors.push(createError('items', 'TYPE', '商品明细必须是对象', index))
        return
      }
      for (const field of ['itemName', 'quantity', 'unitPrice', 'amount']) {
        if (isBlank(item[field])) errors.push(createError(`items.${field}`, 'REQUIRED', `商品${field}不能为空`, index))
      }
      for (const field of ['quantity', 'unitPrice', 'amount']) {
        const value = toNumber(item[field])
        if (value === null) errors.push(createError(`items.${field}`, 'FORMAT', `商品${field}必须是合法数字`, index))
        else if (value < 0) errors.push(createError(`items.${field}`, 'RANGE', `商品${field}不能为负数`, index))
      }
      const quantity = toNumber(item.quantity)
      const unitPrice = toNumber(item.unitPrice)
      const amount = toNumber(item.amount)
      if (quantity !== null && unitPrice !== null && amount !== null && Math.abs(quantity * unitPrice - amount) > 0.02) {
        errors.push(createError('items.amount', 'MISMATCH', '商品数量乘单价与金额不一致', index))
      }
    })
  }

  return { valid: errors.length === 0, data, errors }
}

module.exports = { validateInvoiceExtraction }
