import { Router } from 'express'
import { pool } from '../config/db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

router.get('/', async (req,res,next) => {
  try {
    const { rows } = await pool.query(`
      SELECT g.*, COUNT(sg.station_id)::int AS station_count
      FROM games g LEFT JOIN station_games sg ON sg.game_id=g.id
      WHERE g.active=TRUE
      GROUP BY g.id ORDER BY g.name
    `)
    res.json(rows)
  } catch (err) { next(err) }
})

router.post('/', requireAuth, requireRole('ADMIN'), async (req,res,next) => {
  try {
    const { name, slug, coverUrl, genre, multiplayer=false, maxPlayers=1, description='' } = req.body
    const { rows } = await pool.query(`
      INSERT INTO games (name,slug,cover_url,genre,multiplayer,max_players,description)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `,[name,slug,coverUrl,genre,multiplayer,maxPlayers,description])
    res.status(201).json(rows[0])
  } catch (err) { next(err) }
})

export default router
