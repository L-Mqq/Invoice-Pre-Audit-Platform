const authService = require('../services/authService')

// 注册功能
async function register(req, res, next) {
  try {
    const user = await authService.register({
      username: req.body?.username,
      password: req.body?.password,
    })

    res.status(201).json({
      success: true,
      message: '注册成功',
      data: { user },
    })
  } catch (error) {
    next(error)
  }
}

async function login(req, res, next) {
  try {
    const result = await authService.login({ username: req.body?.username, password: req.body?.password })
    res.json({ success: true, message: '登录成功', data: result })
  } catch (error) {
    next(error)
  }
}

module.exports = { register, login }
