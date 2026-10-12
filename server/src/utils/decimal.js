function normalizeDecimalText(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? value.toString()
      : null
  }

  if (typeof value !== 'string') {
    return null
  }

  const normalizedValue = value
    .replace(/[￥¥元,\s]/g, '')
    .trim()

  return normalizedValue || null
}

function parseDecimal(value) {
  const normalizedValue = normalizeDecimalText(value)

  if (!normalizedValue) {
    return null
  }

  const matched = normalizedValue.match(/^([+-]?)(\d*)(?:\.(\d*))?$/)

  if (!matched || (!matched[2] && !matched[3])) {
    return null
  }

  const integerPart = matched[2] || '0'
  const fractionPart = matched[3] || ''
  const digits = `${integerPart}${fractionPart}`.replace(/^0+(?=\d)/, '') || '0'

  const coefficient = BigInt(digits)

  return {
    coefficient,
    isNegative: matched[1] === '-' && coefficient !== 0n,
    scale: fractionPart.length,
  }
}

function powerOfTen(exponent) {
  return 10n ** BigInt(exponent)
}

function multiplyDecimals(left, right) {
  return {
    coefficient: left.coefficient * right.coefficient,
    isNegative: left.isNegative !== right.isNegative,
    scale: left.scale + right.scale,
  }
}

function compareDecimals(left, right) {
  if (left.isNegative !== right.isNegative) {
    return left.isNegative
      ? -1
      : 1
  }

  const targetScale = Math.max(left.scale, right.scale)
  const leftCoefficient = left.coefficient * powerOfTen(targetScale - left.scale)
  const rightCoefficient = right.coefficient * powerOfTen(targetScale - right.scale)
  const comparison = leftCoefficient === rightCoefficient
    ? 0
    : leftCoefficient > rightCoefficient
      ? 1
      : -1

  return left.isNegative
    ? -comparison
    : comparison
}

function roundHalfUpToScale(decimal, targetScale) {
  if (decimal.scale <= targetScale) {
    return decimal.coefficient * powerOfTen(targetScale - decimal.scale)
  }

  const divisor = powerOfTen(decimal.scale - targetScale)
  const quotient = decimal.coefficient / divisor
  const remainder = decimal.coefficient % divisor

  return remainder * 2n >= divisor
    ? quotient + 1n
    : quotient
}

function toScaledInteger(decimal, targetScale) {
  if (decimal.scale > targetScale) {
    return null
  }

  return decimal.coefficient * powerOfTen(targetScale - decimal.scale)
}

module.exports = {
  compareDecimals,
  multiplyDecimals,
  normalizeDecimalText,
  parseDecimal,
  roundHalfUpToScale,
  toScaledInteger,
}
