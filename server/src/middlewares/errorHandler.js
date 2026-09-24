/**
 * Express 统一错误处理中间件。
 *
 * 注意：四个参数必须全部保留，Express 才会把它识别为错误处理中间件。
 */
function errorHandler(error, req, res, next) {
  console.error('[server error]', error)

  if (res.headersSent) {
    return next(error)
  }

  res.status(error.statusCode || error.status || 500).json({
    success: false,
    message: error.expose ? error.message : 'Internal server error',
  })
}

module.exports = errorHandler
