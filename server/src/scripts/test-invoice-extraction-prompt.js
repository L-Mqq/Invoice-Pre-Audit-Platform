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
    '必须以十进制字符串输出',
    'unitPrice 只能取“单价”列',
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
    ? '相同 row 关联'
    : '表格列可能被拆散或错序'

  assertIncludes({
    content,
    expected: sourceExpected,
    description: sourceType,
  })
}

function main() {
  verifyPrompt(SOURCE_TYPES.PDF_TEXT)
  verifyPrompt(SOURCE_TYPES.TENCENT_OCR)
  console.log('发票结构化提示词测试通过')
}

main()
