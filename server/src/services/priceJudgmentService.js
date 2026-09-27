const PRICE_TYPES = {
  MATERIAL: 'material',
  LOW_VALUE: 'low_value',
  ASSET: 'asset',
}

function classifyUnitPrice(value) {
  const unitPrice = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    return { priceType: null, valid: false, reason: '商品单价无效' }
  }
  if (unitPrice < 500) return { priceType: PRICE_TYPES.MATERIAL, valid: true, reason: `单价 ${unitPrice.toFixed(2)} 元，小于 500 元，判定为材料` }
  if (unitPrice < 1000) return { priceType: PRICE_TYPES.LOW_VALUE, valid: true, reason: `单价 ${unitPrice.toFixed(2)} 元，处于 500 至 1000 元区间，判定为低值品` }
  return { priceType: PRICE_TYPES.ASSET, valid: true, reason: `单价 ${unitPrice.toFixed(2)} 元，大于等于 1000 元，判定为资产` }
}

async function judgePriceItems({ items, connection, persist = false, updateItem }) {
  const results = []
  for (const item of items || []) {
    const result = classifyUnitPrice(item.unitPrice)
    const itemResult = { itemId: item.id, itemName: item.itemName, unitPrice: Number(item.unitPrice), ...result }
    if (persist && item.id && updateItem) {
      await updateItem({ connection, itemId: item.id, priceType: result.priceType, reason: result.reason })
    }
    results.push(itemResult)
  }
  const hasAsset = results.some((item) => item.priceType === PRICE_TYPES.ASSET)
  const hasLowValue = results.some((item) => item.priceType === PRICE_TYPES.LOW_VALUE)
  const hasInvalid = results.some((item) => !item.valid)
  return {
    results,
    invoicePriceResult: hasAsset ? 'asset' : hasInvalid ? 'invalid' : hasLowValue ? 'low_value' : 'continue',
    requiresRejection: hasAsset,
    requiresManualReview: hasInvalid,
    requiresVoucher: !hasAsset && !hasInvalid && hasLowValue,
    reason: hasAsset
      ? results.filter((item) => item.priceType === PRICE_TYPES.ASSET).map((item) => `${item.itemName || item.itemId}：${item.reason}`).join('；')
      : hasInvalid
        ? results.filter((item) => !item.valid).map((item) => `${item.itemName || item.itemId}：${item.reason}`).join('；')
        : hasLowValue ? '包含低值品，需要审核完整支付凭证' : '商品单价判断通过',
  }
}

module.exports = { PRICE_TYPES, classifyUnitPrice, judgePriceItems }
