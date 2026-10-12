const {
  createCategoryMessages,
} = require('../extractors/categoryClassifier')

function assertIncludes({
  content,
  expected,
}) {
  if (!content.includes(expected)) {
    throw new Error(`提示词缺少：${expected}`)
  }
}

function main() {
  const messages = createCategoryMessages({
    itemName: '智能模块',
    rules: [],
  })
  const systemContent = messages[0]?.content || ''
  const userContent = messages[1]?.content || ''

  for (const expected of [
    '“智能模块”单独出现时必须返回“存疑”',
    '不得仅因出现“智能”“模块”“控制”“通信”等词就返回“可以”',
    '不得用常识补全未出现的属性',
    'matchedRule 必须返回 null',
    '不得根据单价判断品类',
  ]) {
    assertIncludes({
      content: systemContent,
      expected,
    })
  }

  assertIncludes({
    content: userContent,
    expected: '智能模块',
  })
  assertIncludes({
    content: userContent,
    expected: 'categoryResult',
  })

  console.log('商品品类 AI 提示词测试通过')
}

main()
