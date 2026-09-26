const path = require('node:path')
const fs = require('node:fs/promises')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })

const { recognizeGeneralInvoice } = require('../extractors/tencentOcrExtractor')
const { structureInvoiceText } = require('../extractors/agnesInvoiceParser')
const { validateInvoiceExtraction } = require('../validators/invoiceExtractionValidator')

const defaultFile = path.resolve(
  __dirname,
  '../../../storage/d6a5e2a8-a4a0-483b-b252-14dca2833514/088ec1cc-ad37-477b-a7fa-fcc8e9b979a0-test1.pdf',
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

  console.log('开始测试 Agnes 结构化...')
  const structured = await structureInvoiceText(result.text)
  console.log('Agnes 原始结构化结果:')
  console.log(JSON.stringify(structured.data, null, 2))
  console.log('Agnes 商品明细数量:', Array.isArray(structured.data.items) ? structured.data.items.length : 0)

  const validation = validateInvoiceExtraction(structured.data)
  console.log('结构化校验结果:')
  console.log(JSON.stringify(validation, null, 2))
}

main().catch((error) => {
  console.error('❌ 腾讯 OCR 报错')
  console.error('错误信息:', error.message)
  console.error('错误堆栈:', error.stack)
  process.exitCode = 1
})
