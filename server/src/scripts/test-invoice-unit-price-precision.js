const assert = require('node:assert/strict')
const {
  normalizeStructuredResult,
} = require('../extractors/agnesInvoiceParser')
const { pool } = require('../config/database')
const invoiceRepository = require('../repositories/invoiceRepository')

const unitPrice = '0.9424778761062'

async function main() {
  const normalizedData = normalizeStructuredResult({
    items: [
      {
        itemName: '*电子元件*电子线',
        quantity: '10',
        unitPrice,
        amount: '9.42',
      },
    ],
  })

  assert.equal(normalizedData.items[0].unitPrice, unitPrice)

  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const [invoiceRows] = await connection.execute(
      `SELECT id
       FROM invoices
       ORDER BY id ASC
       LIMIT 1`,
    )

    assert.ok(invoiceRows[0], '缺少可用于精度测试的发票记录')

    const invoiceId = invoiceRows[0].id
    const createdItems = await invoiceRepository.createItems({
      connection,
      invoiceId,
      items: normalizedData.items,
    })
    const [storedRows] = await connection.execute(
      `SELECT unit_price
       FROM invoice_items
       WHERE id = ?`,
      [createdItems[0].id],
    )

    assert.equal(String(storedRows[0].unit_price), unitPrice)

    console.log('高精度单价提取与入库测试通过')
    console.log(`保存并读回单价：${storedRows[0].unit_price}`)
  } finally {
    await connection.rollback()
    connection.release()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
}).finally(async () => {
  await pool.end()
})
