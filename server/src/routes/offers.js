import { Router } from 'express'
import { pool } from '../config/db.js'
const router = Router()

router.get('/', async (req,res,next) => {
  try {
    const { rows } = await pool.query(`SELECT code,title,description,discount_type,discount_value,start_at,end_at FROM offers WHERE active=TRUE AND NOW() BETWEEN start_at AND end_at ORDER BY created_at DESC`)
    res.json(rows)
  } catch (err) { next(err) }
})
export default router
