const path = require('node:path')
const dotenv = require('dotenv')
const mysql = require('mysql2/promise')

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const requiredConfig = ['DB_NAME', 'DB_USER']
const missingConfig = requiredConfig.filter((key) => !process.env[key])

if (missingConfig.length > 0) {
  throw new Error(`Missing database configuration: ${missingConfig.join(', ')}`)
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
  charset: 'utf8mb4',
  timezone: process.env.DB_TIMEZONE || '+08:00',
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
})

async function testConnection() {
  const connection = await pool.getConnection()

  try {
    await connection.ping()
  } finally {
    connection.release()
  }
}

async function closePool() {
  await pool.end()
}

module.exports = {
  pool,
  testConnection,
  closePool,
}
