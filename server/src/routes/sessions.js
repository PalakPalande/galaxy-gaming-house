import { Router } from 'express'
import { pool } from '../config/db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { calculateSessionAmount } from '../utils/billing.js'

const router = Router()
router.use(requireAuth, requireRole('STAFF','ADMIN'))

router.get('/active', async (req,res,next) => {
  try {
    const { rows } = await pool.query(`
      SELECT se.*, b.booking_code,b.hourly_rate,u.name AS customer_name,s.name AS station_name
      FROM sessions se JOIN bookings b ON b.id=se.booking_id JOIN users u ON u.id=se.user_id JOIN stations s ON s.id=se.station_id
      WHERE se.status='ACTIVE' ORDER BY se.start_time
    `)
    res.json(rows)
  } catch (err) { next(err) }
})

router.post('/start', async (req,res,next) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const bookingResult = await client.query(`SELECT * FROM bookings WHERE id=$1 FOR UPDATE`,[req.body.bookingId])
    const booking = bookingResult.rows[0]
    if (!booking || booking.booking_status !== 'CONFIRMED') throw Object.assign(new Error('Confirmed booking not found.'),{status:404})
    if (new Date(booking.end_time) <= new Date()) throw Object.assign(new Error('This booking time has already ended.'),{status:409})
    const existing = await client.query(`SELECT 1 FROM sessions WHERE booking_id=$1`,[booking.id])
    if (existing.rowCount) throw Object.assign(new Error('A session already exists for this booking.'),{status:409})
    const station = await client.query(`SELECT * FROM stations WHERE id=$1 FOR UPDATE`,[booking.station_id])
    if (station.rows[0].status !== 'AVAILABLE') throw Object.assign(new Error('Station is not currently available.'),{status:409})
    const result = await client.query(`
      INSERT INTO sessions (booking_id,station_id,user_id,start_time,status)
      VALUES ($1,$2,$3,NOW(),'ACTIVE') RETURNING *
    `,[booking.id,booking.station_id,booking.user_id])
    await client.query(`UPDATE stations SET status='OCCUPIED' WHERE id=$1`,[booking.station_id])
    await client.query('COMMIT')
    req.app.get('io').emit('session:started',{stationId:booking.station_id,sessionId:result.rows[0].id})
    res.status(201).json(result.rows[0])
  } catch (err) { await client.query('ROLLBACK').catch(()=>{}); next(err) } finally { client.release() }
})

router.post('/:id/end', async (req,res,next) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await client.query(`
      SELECT se.*,b.hourly_rate,b.payment_method,b.total_amount FROM sessions se JOIN bookings b ON b.id=se.booking_id
      WHERE se.id=$1 AND se.status='ACTIVE' FOR UPDATE
    `,[req.params.id])
    const session = result.rows[0]
    if (!session) throw Object.assign(new Error('Active session not found.'),{status:404})
    const end = new Date()
    const bill = calculateSessionAmount(session.start_time,end,session.hourly_rate)
    const updated = await client.query(`
      UPDATE sessions SET end_time=$1,billed_minutes=$2,final_amount=$3,status='COMPLETED' WHERE id=$4 RETURNING *
    `,[end,bill.billedMinutes,bill.amount,session.id])
    await client.query(`UPDATE bookings SET booking_status='COMPLETED' WHERE id=$1`,[session.booking_id])
    await client.query(`UPDATE stations SET status='AVAILABLE' WHERE id=$1`,[session.station_id])
    await client.query('COMMIT')
    req.app.get('io').emit('session:ended',{stationId:session.station_id,sessionId:session.id})
    res.json({ ...updated.rows[0], extra_due: Math.max(0, Number((bill.amount-Number(session.total_amount)).toFixed(2))) })
  } catch (err) { await client.query('ROLLBACK').catch(()=>{}); next(err) } finally { client.release() }
})

export default router
