const path = require('node:path')
const dotenv = require('dotenv')
const express = require('express')
const cors = require('cors')

// 无论从项目根目录还是 server 目录启动，都优先加载 server/.env。
dotenv.config({ path: path.resolve(__dirname, '.env') })

const { testConnection, closePool } = require('./src/config/database')
const errorHandler = require('./src/middlewares/errorHandler')
const authRouter = require('./src/routes/auth')

const app = express()
const apiRouter = express.Router()
const port = Number(process.env.PORT || process.env.SERVER_PORT || 3000)

// 全局中间件：跨域、JSON 请求体和表单请求体。
app.use(cors())
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))

// 基础健康检查，同时验证当前 Node.js 进程可以访问数据库。
apiRouter.get('/health', async (req, res, next) => {
  try {
    await testConnection()
    res.json({
      success: true,
      service: 'invoice-pre-audit-server',
      database: 'connected',
    })
  } catch (error) {
    next(error)
  }
})

apiRouter.use('/auth', authRouter)

// 业务路由统一挂载在 /api 下，后续可继续拆分到 src/routes。
app.use('/api', apiRouter)

// 未匹配路由。
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  })
})

// 统一错误处理中间件必须放在所有路由之后。
app.use(errorHandler)

async function start() {
  // 启动监听前先确认数据库可用，避免服务启动后才暴露连接错误。
  await testConnection()

  // 保存server对象
  const server = app.listen(port, () => {
    console.log(`Invoice pre-audit server is running at http://localhost:${port}`)
  })

 
  const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down server...`)
    // 关闭server
    server.close(async () => {
      // 关闭 MySQL 连接池
      await closePool()
      process.exit(0)
    })
  }

  process.once('SIGINT', () => shutdown('SIGINT'))
  process.once('SIGTERM', () => shutdown('SIGTERM'))

  return server
}

if (require.main === module) {
  start().catch(async (error) => {
    console.error('Failed to start server:', error.message)
    await closePool()
    process.exitCode = 1
  })
}

module.exports = { app, start }
