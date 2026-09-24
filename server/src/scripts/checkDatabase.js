const { closePool, testConnection } = require('../config/database')

async function main() {
  try {
    await testConnection()
    console.log('Database connection pool is ready.')
  } finally {
    await closePool()
  }
}

main().catch((error) => {
  console.error('Database connection failed:', error.message)
  process.exitCode = 1
})
