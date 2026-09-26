const path = require('node:path')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })

const { structureInvoiceText } = require('../extractors/agnesInvoiceParser')

// 模拟腾讯 OCR 的 MixedInvoiceItems -> SingleInvoiceInfos 提取结果。
const ocrFields = {
  invoices: [{
    page: 1,
    invoiceType: 3,
    fields: [
      { name: '开票日期', value: '2026年09月02日', row: -1 },
      { name: '销售方名称', value: '卡德克斯技术（深圳）有限公司', row: -1 },
      { name: '销售方纳税人识别号', value: '91440300MA5ENKD95T', row: -1 },
      { name: '价税合计', value: '4364.00', row: -1 },
      { name: '项目名称', value: '*公共安全设备*摄像头', row: 0 },
      { name: '数量', value: '2', row: 0 },
      { name: '单价', value: '789.785', row: 0 },
      { name: '金额', value: '1579.57', row: 0 },
      { name: '项目名称', value: '*公共安全设备*数字图像接收模块', row: 1 },
      { name: '数量', value: '2', row: 1 },
      { name: '单价', value: '1141.19', row: 1 },
      { name: '金额', value: '2282.38', row: 1 },
    ],
  }],
}

async function main() {
  const input = JSON.stringify(ocrFields)
  console.log('开始测试 Agnes 结构化...')
  console.log('SingleInvoiceInfos JSON 长度:', input.length)

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
