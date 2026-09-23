import { Router } from 'express'
import { pool } from '../config/db.js'

const router = Router()

router.get('/', async (req,res,next) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.*,
        CASE
          WHEN s.status='MAINTENANCE' THEN 'MAINTENANCE'
          WHEN s.status='OCCUPIED' THEN 'OCCUPIED'
          WHEN EXISTS (
            SELECT 1 FROM bookings rb
            WHERE rb.station_id=s.id
              AND rb.booking_status='CONFIRMED'
              AND rb.start_time <= NOW()
              AND rb.end_time > NOW()
          ) THEN 'RESERVED'
          ELSE 'AVAILABLE'
        END AS display_status,
        COALESCE(json_agg(json_build_object('id',g.id,'name',g.name,'cover_url',g.cover_url)) FILTER (WHERE g.id IS NOT NULL), '[]') AS games,
        (SELECT MIN(b.end_time) FROM bookings b
          WHERE b.station_id=s.id AND b.booking_status='CONFIRMED' AND b.start_time <= NOW() AND b.end_time > NOW()) AS expected_available_at
      FROM stations s
      LEFT JOIN station_games sg ON sg.station_id=s.id
      LEFT JOIN games g ON g.id=sg.game_id AND g.active=TRUE
      GROUP BY s.id ORDER BY s.name
    `)
    res.json(rows)
  } catch (err) { next(err) }
})

router.get('/:id/availability', async (req,res,next) => {
  try {
    const date = req.query.date
    const params = [req.params.id]
    let condition = ''
    if (date) {
      params.push(date)
      condition = `AND b.start_time::date = $2::date`
    }
    const { rows } = await pool.query(`
      SELECT b.start_time,b.end_time,b.booking_status
      FROM bookings b
      WHERE b.station_id=$1 AND b.booking_status IN ('CONFIRMED','PENDING_PAYMENT')
      AND (b.payment_expires_at IS NULL OR b.payment_expires_at > NOW())
      ${condition}
      ORDER BY b.start_time
    `, params)
    res.json(rows)
  } catch (err) { next(err) }
})

export default router
