const { pool } = require('../config/database')

async function findByUsername(username) {
  const [rows] = await pool.execute(
    'SELECT id, username, password_hash, role, is_active, created_at, updated_at FROM users WHERE username = ? LIMIT 1',
    [username],
  )
  return rows[0] || null
}

async function findById(id) {
  const [rows] = await pool.execute(
    'SELECT id, username, role, is_active, created_at, updated_at FROM users WHERE id = ? LIMIT 1',
    [id],
  )
  return rows[0] || null
}

async function createUser({ username, passwordHash, role = 'admin' }) {
  const [result] = await pool.execute(
    'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
    [username, passwordHash, role],
  )

  return {
    id: result.insertId,
    username,
    role,
  }
}

module.exports = { findByUsername, findById, createUser }
