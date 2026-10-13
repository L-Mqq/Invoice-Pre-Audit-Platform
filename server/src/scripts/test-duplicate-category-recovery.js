const assert = require('node:assert/strict')
const {
  findFirstUnclearedDuplicate,
  getCategoryDecision,
} = require('../services/invoiceReviewService')
const invoiceReviewRepository = require('../repositories/invoiceReviewRepository')
const invoiceRepository = require('../repositories/invoiceRepository')

const {
  hasActiveDuplicateClearDecision,
} = invoiceReviewRepository
const {
  findDuplicateInvoices,
} = invoiceRepository

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
    394,
    '395',
    '440300123456789',
    '269520000037399910034',
  ])
  assert.match(executedSql, /\sOR\s/)

  console.log('✅ 非重复确认按双向关系和业务字段快照校验')
}

async function testFindAllDuplicateCandidates() {
  let executedSql = ''
  const connection = {
    async execute(sql) {
      executedSql = sql

      return [[
        {
          id: 394,
        },
        {
          id: 395,
        },
        {
          id: 396,
        },
      ]]
    },
  }
  const results = await findDuplicateInvoices({
    connection,
    invoiceId: 397,
    sellerTaxId: '440300123456789',
    invoiceNumber: '269520000037399910034',
  })

  assert.deepEqual(
    results.map((item) => item.id),
    [
      394,
      395,
      396,
    ],
  )
  assert.doesNotMatch(executedSql, /LIMIT\s+1/i)
  assert.match(executedSql, /ORDER BY id ASC/)

  console.log('✅ 重复检测返回全部候选发票')
}

async function testFindNextUnclearedDuplicate() {
  const originalFindDuplicateInvoices = invoiceRepository.findDuplicateInvoices
  const originalHasActiveDuplicateClearDecision = invoiceReviewRepository.hasActiveDuplicateClearDecision

  invoiceRepository.findDuplicateInvoices = async () => {
    return [
      {
        id: 394,
      },
      {
        id: 395,
      },
      {
        id: 396,
      },
    ]
  }
  invoiceReviewRepository.hasActiveDuplicateClearDecision = async ({
    duplicateInvoiceId,
  }) => {
    return duplicateInvoiceId === 394
  }

  try {
    const result = await findFirstUnclearedDuplicate({
      connection: {},
      invoice: {
        id: 397,
        seller_tax_id: '440300123456789',
        invoice_number: '269520000037399910034',
      },
      ignoredDuplicateInvoiceId: 395,
    })

    assert.equal(result?.id, 396)

    console.log('✅ 确认一组非重复后自动推进到下一张候选发票')
  } finally {
    invoiceRepository.findDuplicateInvoices = originalFindDuplicateInvoices
    invoiceReviewRepository.hasActiveDuplicateClearDecision = originalHasActiveDuplicateClearDecision
  }
}

async function main() {
  for (const testCase of cases) {
    const result = getCategoryDecision(testCase.items)

    assert.equal(result?.status || null, testCase.expectedStatus)
    assert.equal(result?.reason || null, testCase.expectedReason)

    console.log(`✅ ${testCase.name}`)
  }

  await testDuplicateClearSnapshotQuery()
  await testFindAllDuplicateCandidates()
  await testFindNextUnclearedDuplicate()

  console.log(`测试完成：${cases.length + 3}/${cases.length + 3} 通过`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
