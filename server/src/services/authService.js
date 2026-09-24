const bcrypt = require('bcryptjs')
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

module.exports = { register }
