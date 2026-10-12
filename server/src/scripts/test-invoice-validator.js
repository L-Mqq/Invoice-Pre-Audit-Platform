const { validateInvoiceExtraction } = require('../validators/invoiceExtractionValidator')

const validInvoice = {
  invoiceNumber: 'TEST-VALID-001',
  sellerName: '卡德克斯技术（深圳）有限公司',
  sellerTaxId: '91440300MA5ENKD95T',
  invoiceDate: '2026年09月02日',
  totalAmount: '200.00',
  items: [{
    itemName: '摄像头',
    quantity: '2',
    unitPrice: '100.00',
    amount: '200.00',
  }],
}

const highPrecisionUnitPriceInvoice = {
  invoiceNumber: 'TEST-HIGH-PRECISION-001',
  sellerName: '深圳市科比电子科技有限公司',
  sellerTaxId: '91440300576393935K',
  invoiceDate: '2026-09-02',
  totalAmount: '23.48',
  taxAmount: '2.70',
  amountWithoutTax: '20.78',
  items: [
    {
      itemName: '*电子元件*电子线',
      quantity: '1',
      unitPrice: '4.2654867256637',
      amount: '4.27',
    },
    {
      itemName: '*电子元件*电子线',
      quantity: '10',
      unitPrice: '0.9424778761062',
      amount: '9.42',
    },
    {
      itemName: '*电子元件*电子线',
      quantity: '1',
      unitPrice: '3.8230088495575',
      amount: '3.82',
    },
    {
      itemName: '*电子元件*电子线',
      quantity: '1',
      unitPrice: '3.2654867256637',
      amount: '3.27',
    },
  ],
}

const cases = [
  {
    name: '正常结构化结果',
    input: validInvoice,
    expectedValid: true,
  },
  {
    name: '高精度单价发票金额校验',
    input: highPrecisionUnitPriceInvoice,
    expectedValid: true,
  },
  {
    name: '高精度单价商品金额不一致',
    input: {
      ...highPrecisionUnitPriceInvoice,
      items: [
        {
          ...highPrecisionUnitPriceInvoice.items[1],
          amount: '9.43',
        },
      ],
    },
    expectedValid: false,
  },
  {
    name: '缺少销售方税号',
    input: { ...validInvoice, sellerTaxId: null },
    expectedValid: false,
  },
  {
    name: '商品明细为空',
    input: { ...validInvoice, items: [] },
    expectedValid: false,
  },
  {
    name: '金额格式错误',
    input: { ...validInvoice, totalAmount: '不是金额' },
    expectedValid: false,
  },
  {
    name: '商品金额不一致',
    input: {
      ...validInvoice,
      items: [{ ...validInvoice.items[0], amount: '300.00' }],
    },
    expectedValid: false,
  },
  {
    name: '非法输入类型',
    input: null,
    expectedValid: false,
  },
]

function main() {
  let failed = 0

  for (const testCase of cases) {
    const result = validateInvoiceExtraction(testCase.input)
    const passed = result.valid === testCase.expectedValid
    if (!passed) failed += 1

    console.log(`${passed ? '✅' : '❌'} ${testCase.name}`)
    console.log('  valid:', result.valid)
    if (result.errors.length > 0) console.log('  errors:', JSON.stringify(result.errors, null, 2))
  }

  console.log(`\n测试完成：${cases.length - failed}/${cases.length} 通过`)
  if (failed > 0) process.exitCode = 1
}

main()
