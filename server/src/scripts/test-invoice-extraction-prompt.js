const {
  createMessages,
  SOURCE_TYPES,
} = require('../extractors/agnesInvoiceParser')

function assertIncludes({
  content,
  expected,
  description,
}) {
  if (!content.includes(expected)) {
    throw new Error(`${description}缺少提示词：${expected}`)
  }
}

function verifyPrompt(sourceType) {
  const messages = createMessages({
    sourceType,
    text: '测试发票内容',
  })
  const content = messages[1]?.content || ''

  for (const expected of [
    '金额和数量必须是十进制字符串',
    'unitPrice 只能取单价字段',
    '不得通过数量、金额、税率或税额反推单价',
    '不得跨行组合',
  ]) {
    assertIncludes({
      content,
      expected,
      description: sourceType,
    })
  }

  const sourceExpected = sourceType === SOURCE_TYPES.TENCENT_OCR
    ? 'VatElectronicInvoiceFull'
    : '表格列可能被拆散或错序'

  assertIncludes({
    content,
    expected: sourceExpected,
    description: sourceType,
  })

  if (sourceType === SOURCE_TYPES.TENCENT_OCR) {
    for (const expected of [
      'unitPrice=Price',
      'amount=Total',
      'data.VatElectronicItems',
    ]) {
      assertIncludes({
        content,
        expected,
        description: sourceType,
      })
    }
  }
}

function main() {
  verifyPrompt(SOURCE_TYPES.PDF_TEXT)
  verifyPrompt(SOURCE_TYPES.TENCENT_OCR)
  console.log('发票结构化提示词测试通过')
}

main()
