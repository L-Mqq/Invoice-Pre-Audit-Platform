const assert = require('node:assert/strict')
const {
  getCategoryDecision,
} = require('../services/invoiceReviewService')

const cases = [
  {
    name: '存在存疑商品时恢复为待人工处理',
    items: [
      {
        item_name: '*电子元件*智能模块',
        final_category_result: '存疑',
      },
    ],
    expectedStatus: 'pending_manual',
    expectedReason: '商品“*电子元件*智能模块”品类仍需人工确认',
  },
  {
    name: '全部商品可以时恢复为待审核',
    items: [
      {
        item_name: '*电子元件*电阻',
        final_category_result: '可以',
      },
    ],
    expectedStatus: null,
    expectedReason: null,
  },
  {
    name: '存在不可以商品时恢复为审核不通过',
    items: [
      {
        item_name: '*办公用品*显示器',
        final_category_result: '不可以',
      },
    ],
    expectedStatus: 'rejected',
    expectedReason: '商品“*办公用品*显示器”品类判定为不可以',
  },
]

function main() {
  for (const testCase of cases) {
    const result = getCategoryDecision(testCase.items)

    assert.equal(result?.status || null, testCase.expectedStatus)
    assert.equal(result?.reason || null, testCase.expectedReason)

    console.log(`✅ ${testCase.name}`)
  }

  console.log(`测试完成：${cases.length}/${cases.length} 通过`)
}

main()
