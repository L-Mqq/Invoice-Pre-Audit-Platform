const OVERRIDE_ALLOWED_ENVIRONMENTS = new Set([
  'development',
  'test',
])

function getBusinessNow() {
  const environment = String(process.env.NODE_ENV || '').trim()
  const configuredTime = String(process.env.BUSINESS_NOW || '').trim()

  if (!configuredTime || !OVERRIDE_ALLOWED_ENVIRONMENTS.has(environment)) {
    return new Date()
  }

  const businessNow = new Date(configuredTime)

  if (Number.isNaN(businessNow.getTime())) {
    throw new Error('BUSINESS_NOW 必须是有效的 ISO 8601 时间')
  }

  return businessNow
}

module.exports = {
  getBusinessNow,
}
