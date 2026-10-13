const assert = require('node:assert/strict')
const {
  getCategoryDecision,
} = require('../services/invoiceReviewService')
const {
  hasActiveDuplicateClearDecision,
} = require('../repositories/invoiceReviewRepository')

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

async function testDuplicateClearSnapshotQuery() {
  let executedSql = ''
  let executedParameters = []
  const connection = {
    async execute(sql, parameters) {
      executedSql = sql
      executedParameters = parameters

      return [[
        {
          id: 1,
        },
      ]]
    },
  }
  const result = await hasActiveDuplicateClearDecision({
    connection,
    invoiceId: 395,
    duplicateInvoiceId: 394,
    sellerTaxId: '440300123456789',
    invoiceNumber: '269520000037399910034',
  })

  assert.equal(result, true)
  assert.match(executedSql, /\$\.sellerTaxId/)
  assert.match(executedSql, /\$\.invoiceNumber/)
  assert.doesNotMatch(executedSql, /created_at/)
  assert.deepEqual(executedParameters, [
    395,
    '394',
    '440300123456789',
    '269520000037399910034',
  ])

  console.log('✅ 非重复确认按业务字段快照校验')
}

async function main() {
  for (const testCase of cases) {
    const result = getCategoryDecision(testCase.items)

    assert.equal(result?.status || null, testCase.expectedStatus)
    assert.equal(result?.reason || null, testCase.expectedReason)

    console.log(`✅ ${testCase.name}`)
  }

  await testDuplicateClearSnapshotQuery()

  console.log(`测试完成：${cases.length + 1}/${cases.length + 1} 通过`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
