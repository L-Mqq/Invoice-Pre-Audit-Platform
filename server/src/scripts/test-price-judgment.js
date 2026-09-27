const { classifyUnitPrice } = require('../services/priceJudgmentService')

const samples = [499.99, 500, 999.99, 1000]
for (const unitPrice of samples) {
  console.log({ unitPrice, result: classifyUnitPrice(unitPrice) })
}
