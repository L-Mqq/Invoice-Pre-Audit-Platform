const path = require('node:path')
const fs = require('node:fs/promises')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })

const { recognizeGeneralInvoice } = require('../extractors/tencentOcrExtractor')

const defaultFile = path.resolve(
  __dirname,
  '../../../storage/6654dfa6-02f8-4883-946c-b81a65305984/c92f1472-ecc6-4a82-b987-35530a257582-test1.pdf',
)

async function main() {
  const filePath = path.resolve(process.argv[2] || defaultFile)
  const buffer = await fs.readFile(filePath)

  console.log('开始测试腾讯 OCR...')
  console.log('文件:', filePath)
  console.log('文件大小:', buffer.length, 'bytes')

  const result = await recognizeGeneralInvoice(buffer)
  const rawItems = Array.isArray(result.rawResult?.MixedInvoiceItems)
    ? result.rawResult.MixedInvoiceItems
    : []

  console.log('✅ 腾讯 OCR 正常')
  console.log('RequestId:', result.requestId || '(无)')
  console.log('票据数量:', rawItems.length)
  console.log('JSON 转换前的原始 SingleInvoiceInfos:')
  console.dir(rawItems.map((item) => ({
    page: item.Page ?? null,
    type: item.Type ?? null,
    subType: item.SubType ?? null,
    singleInvoiceInfos: item.SingleInvoiceInfos ?? null,
  })), { depth: null, colors: false })
  console.log('按 SubType 提取的 SingleInvoiceInfos:')
  console.log(JSON.stringify(rawItems.map((item) => {
    const subType = item.SubType || null
    const singleInvoiceInfos = item.SingleInvoiceInfos
    const subtypeResult = subType && singleInvoiceInfos && !Array.isArray(singleInvoiceInfos)
      ? singleInvoiceInfos[subType] ?? null
      : null

    return {
      page: item.Page ?? null,
      invoiceType: item.Type ?? null,
      subType,
      subTypeDescription: item.SubTypeDescription ?? null,
      // 票种结构化结果，例如 VatElectronicInvoiceFull。
      subtypeResult,
      // 兼容 SDK 返回数组的情况，便于继续查看通用字段。
      fields: Array.isArray(singleInvoiceInfos)
        ? singleInvoiceInfos.map((field) => ({
          name: field.Name ?? '',
          value: field.Value ?? null,
          row: field.Row ?? -1,
        }))
        : [],
    }
  })), null, 2)
  console.log('交给 Agnes 的 JSON:')
  console.log(result.text)
}

main().catch((error) => {
  console.error('❌ 腾讯 OCR 报错')
  console.error('错误信息:', error.message)
  console.error('错误堆栈:', error.stack)
  process.exitCode = 1
})
