const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })

const { structureInvoiceText } = require('../extractors/agnesInvoiceParser')

// 模拟腾讯 OCR 映射后的统一 JSON，而不是直接传供应商原始响应。
const normalizedOcrResult = {
  invoices: [{
    page: 1,
    invoiceType: 3,
    invoiceNumber: '26952000003739885981',
    invoiceDate: '2026年09月02日',
    buyerName: '广东工业大学',
    buyerTaxId: '12440000455860226X',
    sellerName: '卡德克斯技术（深圳）有限公司',
    sellerTaxId: '91440300MA5ENKD95T',
    totalAmount: '4364.00',
    taxAmount: '502.05',
    amountWithoutTax: '3861.95',
    items: [],
    sourceFields: [
      { name: '项目名称', value: '*公共安全设备*摄像头', row: 0 },
      { name: '规格型号', value: 'WN12-2W14B', row: 0 },
      { name: '单位', value: '套', row: 0 },
      { name: '数量', value: '2', row: 0 },
      { name: '单价', value: '789.785', row: 0 },
      { name: '金额', value: '1579.57', row: 0 },
      { name: '税率', value: '13%', row: 0 },
      { name: '项目名称', value: '*公共安全设备*数字图像接收模块', row: 1 },
      { name: '规格型号', value: 'WN02-FP001', row: 1 },
      { name: '单位', value: '个', row: 1 },
      { name: '数量', value: '2', row: 1 },
      { name: '单价', value: '1141.19', row: 1 },
      { name: '金额', value: '2282.38', row: 1 },
      { name: '税率', value: '13%', row: 1 },
    ],
  }],
}

async function main() {
  console.log('开始测试 Agnes 结构化...')
  const input = JSON.stringify(normalizedOcrResult)
  console.log('统一 OCR JSON 长度:', input.length)

  try {
    const result = await structureInvoiceText(input)
    console.log('✅ Agnes 正常')
    console.log('返回结果:', JSON.stringify(result.data, null, 2))
  } catch (error) {
    console.error('❌ Agnes 报错')
    console.error('错误信息:', error.message)
    console.error('错误堆栈:', error.stack)
    process.exitCode = 1
  }
}

main()
