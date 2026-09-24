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

module.exports = { register }
