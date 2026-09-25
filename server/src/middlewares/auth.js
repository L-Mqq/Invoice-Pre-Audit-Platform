const jwt = require('jsonwebtoken')

function authMiddleware(req, res, next) {
  const header = req.get('Authorization') || ''
  const [scheme, token] = header.split(' ')
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ success: false, message: '未登录或缺少 Token' })
  }

  const secret = process.env.JWT_SECRET
  if (!secret) return next(new Error('JWT_SECRET is not configured'))

  try {
    req.user = jwt.verify(token, secret)
    next()
  } catch (error) {
    const authError = new Error(error.name === 'TokenExpiredError' ? 'Token 已过期' : 'Token 无效')
    authError.statusCode = 401
    authError.expose = true
    next(authError)
  }
}

module.exports = authMiddleware
