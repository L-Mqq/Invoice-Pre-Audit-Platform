const assert = require('node:assert/strict')
const {
  PRICE_TYPES,
  classifyUnitPrice,
} = require('../services/priceJudgmentService')

const cases = [
  {
    name: '高精度材料单价',
    unitPrice: '0.9424778761062',
    expectedPriceType: PRICE_TYPES.MATERIAL,
  },
  {
    name: '接近 500 元的材料',
    unitPrice: '499.9999999999999',
    expectedPriceType: PRICE_TYPES.MATERIAL,
  },
  {
    name: '500 元低值品边界',
    unitPrice: '500.0000000000000',
    expectedPriceType: PRICE_TYPES.LOW_VALUE,
  },
  {
    name: '接近 1000 元的低值品',
    unitPrice: '999.9999999999999',
    expectedPriceType: PRICE_TYPES.LOW_VALUE,
  },
  {
    name: '1000 元资产边界',
    unitPrice: '1000.0000000000000',
    expectedPriceType: PRICE_TYPES.ASSET,
  },
  {
    name: '无效单价',
    unitPrice: 'invalid',
    expectedPriceType: null,
  },
]

function main() {
  for (const testCase of cases) {
    const result = classifyUnitPrice(testCase.unitPrice)

    assert.equal(result.priceType, testCase.expectedPriceType)
    assert.equal(result.valid, testCase.expectedPriceType !== null)

    if (result.valid) {
      assert.match(result.reason, new RegExp(testCase.unitPrice))
    }

    console.log(`✅ ${testCase.name}`)
  }

  console.log(`测试完成：${cases.length}/${cases.length} 通过`)
}

main()
