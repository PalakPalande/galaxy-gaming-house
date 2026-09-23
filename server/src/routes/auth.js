import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from '../config/db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

function signUser(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  )
}

function normalizePhone(phone) {
  return String(phone || '').replace(/[^\d+]/g, '').trim()
}

router.post('/register', async (req,res,next) => {
  try {
    const { name, email, phone, password } = req.body
    const normalizedEmail = String(email || '').trim().toLowerCase()
    const normalizedPhone = normalizePhone(phone)

    if (!name?.trim() || !normalizedEmail || !password || password.length < 8) {
      return res.status(400).json({ message: 'Name, email and a password of at least 8 characters are required.' })
    }
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Enter a valid email address.' })
    }
    if (!/^\+?\d{10,15}$/.test(normalizedPhone)) {
      return res.status(400).json({ message: 'Enter a valid phone number with 10 to 15 digits.' })
    }

    const exists = await pool.query('SELECT 1 FROM users WHERE email=$1', [normalizedEmail])
    if (exists.rowCount) return res.status(409).json({ message: 'An account with this email already exists.' })

    const passwordHash = await bcrypt.hash(password, 12)
    const result = await pool.query(`
      INSERT INTO users (name,email,phone,password_hash,role)
      VALUES ($1,$2,$3,$4,'CUSTOMER')
      RETURNING id,name,email,phone,role,created_at
    `,[name.trim(), normalizedEmail, normalizedPhone, passwordHash])

    const user = result.rows[0]
    res.status(201).json({ user, token: signUser(user) })
  } catch (err) { next(err) }
})

router.post('/login', async (req,res,next) => {
  try {
    const { email, password } = req.body
    const result = await pool.query('SELECT * FROM users WHERE email=$1', [String(email || '').trim().toLowerCase()])
    const user = result.rows[0]
    if (!user || !(await bcrypt.compare(password || '', user.password_hash))) {
      return res.status(401).json({ message: 'Incorrect email or password.' })
    }
    const safeUser = { id:user.id, name:user.name, email:user.email, phone:user.phone, role:user.role }
    res.json({ user: safeUser, token: signUser(safeUser) })
  } catch (err) { next(err) }
})

router.get('/me', requireAuth, async (req,res,next) => {
  try {
    const result = await pool.query('SELECT id,name,email,phone,role,created_at FROM users WHERE id=$1', [req.user.id])
    if (!result.rows[0]) return res.status(404).json({ message: 'User account not found.' })
    res.json(result.rows[0])
  } catch (err) { next(err) }
})

export default router
