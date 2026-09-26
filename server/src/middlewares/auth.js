const jwt = require('jsonwebtoken')
const userRepository = require('../repositories/userRepository')

function authError(message) {
  const error = new Error(message)
  error.statusCode = 401
  error.expose = true
  return error
}

async function authMiddleware(req, res, next) {
  const header = (req.get('Authorization') || '').trim()
  const match = /^Bearer\s+(\S+)$/i.exec(header)
  if (!match) {
    return res.status(401).json({ success: false, message: '未登录或缺少 Token' })
  }
  const token = match[1]

  const secret = (process.env.JWT_SECRET || '').trim()
  if (!secret) {
    const error = new Error('JWT_SECRET is not configured')
    error.statusCode = 500
    error.expose = false
    return next(error)
  }

  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] })
    if (
      !payload ||
      typeof payload !== 'object' ||
      typeof payload.sub !== 'string' ||
      !/^\d+$/.test(payload.sub)
    ) {
      throw authError('Token 无效')
    }

    const user = await userRepository.findById(payload.sub)
    if (!user || !user.is_active) throw authError('用户不存在或账号已禁用')
    if (user.role !== 'admin') {
      const error = new Error('没有管理员权限')
      error.statusCode = 403
      error.expose = true
      throw error
    }

    req.auth = payload
    // Keep `sub` for existing controllers while exposing canonical DB fields.
    req.user = { sub: String(user.id), id: user.id, username: user.username, role: user.role }
    next()
  } catch (error) {
    if (error.statusCode === 403) return next(error)
    if (error.statusCode === 401) return next(error)
    if (!['TokenExpiredError', 'JsonWebTokenError', 'NotBeforeError'].includes(error.name)) {
      return next(error)
    }
    const authError = new Error(error.name === 'TokenExpiredError' ? 'Token 已过期' : 'Token 无效')
    authError.statusCode = 401
    authError.expose = true
    next(authError)
  }
}

module.exports = authMiddleware
