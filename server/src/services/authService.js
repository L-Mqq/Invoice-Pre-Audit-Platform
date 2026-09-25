const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const userRepository = require('../repositories/userRepository')

// 错误状态码
function createHttpError(statusCode, message) {
  const error = new Error(message)
  error.statusCode = statusCode
  error.expose = true
  return error
}

// 注册的校验
function validateRegistrationInput({ username, password }) {
  if (typeof username !== 'string' || username.trim().length < 3 || username.trim().length > 64) {
    throw createHttpError(400, '用户名长度必须为 3-64 个字符')
  }

  if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
    throw createHttpError(400, '密码长度必须为 6-128 个字符')
  }
}

// 注册
async function register({ username, password }) {
  validateRegistrationInput({ username, password })
  const normalizedUsername = username.trim()
  const existingUser = await userRepository.findByUsername(normalizedUsername)

  if (existingUser) {
    throw createHttpError(409, '用户名已存在')
  }

  const passwordHash = await bcrypt.hash(password, 12)

  try {
    // 当前阶段按项目约定默认注册为 admin；角色不接受客户端传入。
    return await userRepository.createUser({
      username: normalizedUsername,
      passwordHash,
      role: 'admin',
    })
  } catch (error) {
    // 即使并发请求同时通过了查询，也由唯一索引兜底处理重复用户名。
    if (error.code === 'ER_DUP_ENTRY') {
      throw createHttpError(409, '用户名已存在')
    }
    throw error
  }
}
// 登录
async function login({ username, password }) {
  if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || !password) {
    throw createHttpError(400, '请输入用户名和密码')
  }
  const user = await userRepository.findByUsername(username.trim())
  const validPassword = user ? await bcrypt.compare(password, user.password_hash) : false
  if (!user || !validPassword) throw createHttpError(401, '用户名或密码错误')
  if (!user.is_active) throw createHttpError(403, '账号已被禁用')

  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) throw new Error('JWT_SECRET is not configured')
  const token = jwt.sign(
    { sub: String(user.id), username: user.username, role: user.role },
    jwtSecret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '2h' },
  )
  return { token, user: { id: user.id, username: user.username, role: user.role } }
}

async function getCurrentUser(userId) {
  const user = await userRepository.findById(userId)
  if (!user || !user.is_active) throw createHttpError(401, '用户不存在或账号已禁用')
  return { id: user.id, username: user.username, role: user.role }
}

module.exports = { register, login, getCurrentUser }
