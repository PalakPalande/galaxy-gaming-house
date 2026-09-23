import { Router } from 'express'
import { pool } from '../config/db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth, requireRole('STAFF','ADMIN'))

router.get('/overview', async (req,res,next) => {
  try {
    const [revenue,bookings,stations,sessions,popular] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(CASE WHEN payment_status='PAID' THEN total_amount ELSE 0 END),0)::numeric AS revenue_today FROM bookings WHERE created_at::date=CURRENT_DATE`),
      pool.query(`SELECT COUNT(*)::int AS bookings_today FROM bookings WHERE created_at::date=CURRENT_DATE AND booking_status IN ('CONFIRMED','COMPLETED','NO_SHOW')`),
      pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='AVAILABLE')::int AS available, COUNT(*) FILTER (WHERE status='OCCUPIED')::int AS occupied FROM stations`),
      pool.query(`SELECT COUNT(*)::int AS active FROM sessions WHERE status='ACTIVE'`),
      pool.query(`SELECT g.name,COUNT(*)::int AS count FROM games g JOIN station_games sg ON sg.game_id=g.id GROUP BY g.id ORDER BY count DESC,g.name LIMIT 1`)
    ])
    res.json({ revenueToday:revenue.rows[0].revenue_today, bookingsToday:bookings.rows[0].bookings_today, stations:stations.rows[0], activeSessions:sessions.rows[0].active, popularGame:popular.rows[0]?.name || '—' })
  } catch (err) { next(err) }
})

router.get('/bookings', async (req,res,next) => {
  try {
    const { rows } = await pool.query(`
      SELECT b.*,u.name AS customer_name,u.phone,s.name AS station_name
      FROM bookings b JOIN users u ON u.id=b.user_id JOIN stations s ON s.id=b.station_id
      WHERE b.booking_status <> 'PENDING_PAYMENT'
      ORDER BY b.start_time DESC LIMIT 100
    `)
    res.json(rows)
  } catch (err) { next(err) }
})

router.patch('/bookings/:id/mark-cash-paid', async (req,res,next) => {
  try {
    const { rows } = await pool.query(`UPDATE bookings SET payment_status='PAID' WHERE id=$1 AND payment_method='CASH' AND booking_status IN ('CONFIRMED','COMPLETED') RETURNING *`,[req.params.id])
    if (!rows[0]) return res.status(404).json({message:'Cash booking not found.'})
    res.json(rows[0])
  } catch (err) { next(err) }
})

router.patch('/stations/:id/status', requireRole('ADMIN'), async (req,res,next) => {
  try {
    if (!['AVAILABLE','MAINTENANCE'].includes(req.body.status)) return res.status(400).json({message:'Only AVAILABLE or MAINTENANCE can be set manually.'})
    const { rows } = await pool.query(`UPDATE stations SET status=$1 WHERE id=$2 AND status<>'OCCUPIED' RETURNING *`,[req.body.status,req.params.id])
    if (!rows[0]) return res.status(409).json({message:'Occupied stations cannot be changed manually.'})
    req.app.get('io').emit('station:updated',{stationId:req.params.id,status:req.body.status})
    res.json(rows[0])
  } catch (err) { next(err) }
})

export default router
