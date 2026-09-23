import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { pool } from './config/db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const schemaPath = path.resolve(__dirname, '../../database/schema.sql')

try {
  const sql = await fs.readFile(schemaPath, 'utf8')
  await pool.query(sql)
  console.log('Database schema created successfully.')
} catch (err) {
  console.error('Database setup failed:', err.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
