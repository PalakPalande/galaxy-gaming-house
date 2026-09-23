import { Router } from 'express'
import crypto from 'crypto'
import { pool } from '../config/db.js'
import { requireAuth } from '../middleware/auth.js'
import { calculateSubtotal, applyOffer } from '../utils/billing.js'

const router = Router()

async function cleanExpired(client = pool) {
  await client.query(`DELETE FROM bookings WHERE booking_status='PENDING_PAYMENT' AND payment_expires_at < NOW()`)
}

function validDate(value) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

router.post('/', requireAuth, async (req,res,next) => {
  const client = await pool.connect()
  try {
    const { stationId, startTime, endTime, paymentMethod, offerCode } = req.body
    if (!stationId || !startTime || !endTime || !['CASH','RAZORPAY'].includes(paymentMethod)) {
      return res.status(400).json({ message: 'Station, time range and payment method are required.' })
    }

    const start = validDate(startTime)
    const end = validDate(endTime)
    if (!start || !end) return res.status(400).json({ message: 'Invalid booking date or time.' })
    if (start <= new Date()) return res.status(400).json({ message: 'Booking must be in the future.' })
    if (end <= start) return res.status(400).json({ message: 'Invalid booking time range.' })

    const minutes = Math.ceil((end - start) / 60000)
    if (minutes < 30 || minutes > 360 || minutes % 30 !== 0) {
      return res.status(400).json({ message: 'Booking duration must be between 30 minutes and 6 hours, in 30-minute steps.' })
    }

    await client.query('BEGIN')
    await cleanExpired(client)

    const stationResult = await client.query('SELECT * FROM stations WHERE id=$1 FOR UPDATE', [stationId])
    const station = stationResult.rows[0]
    if (!station) throw Object.assign(new Error('Station not found.'), { status:404 })
    if (station.status === 'MAINTENANCE') throw Object.assign(new Error('This station is under maintenance.'), { status:409 })

    const conflict = await client.query(`
      SELECT 1 FROM bookings
      WHERE station_id=$1
        AND booking_status IN ('CONFIRMED','PENDING_PAYMENT')
        AND (payment_expires_at IS NULL OR payment_expires_at > NOW())
        AND $2::timestamptz < end_time
        AND $3::timestamptz > start_time
      LIMIT 1
    `,[stationId,start.toISOString(),end.toISOString()])
    if (conflict.rowCount) throw Object.assign(new Error('That slot is already booked. Choose another time.'), { status:409 })

    const { subtotal } = calculateSubtotal(start,end,station.hourly_rate)
    let offer = null
    if (offerCode) {
      const offerResult = await client.query(
        `SELECT * FROM offers WHERE UPPER(code)=UPPER($1) AND active=TRUE AND NOW() BETWEEN start_at AND end_at`,
        [offerCode.trim()]
      )
      offer = offerResult.rows[0] || null
      if (!offer) throw Object.assign(new Error('Offer code is invalid or expired.'), { status:400 })
    }

    const { discount,total } = applyOffer(subtotal,offer)
    const code = `GGH-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
    const status = paymentMethod === 'CASH' ? 'CONFIRMED' : 'PENDING_PAYMENT'
    const expiresAt = paymentMethod === 'RAZORPAY' ? new Date(Date.now()+10*60*1000) : null

    const result = await client.query(`
      INSERT INTO bookings
      (booking_code,user_id,station_id,start_time,end_time,hourly_rate,subtotal,discount_amount,total_amount,offer_code,booking_status,payment_method,payment_status,payment_expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'PENDING',$13)
      RETURNING *
    `,[code,req.user.id,stationId,start,end,station.hourly_rate,subtotal,discount,total,offer?.code || null,status,paymentMethod,expiresAt])

    await client.query('COMMIT')
    req.app.get('io').emit('booking:created', { stationId, bookingId: result.rows[0].id })
    res.status(201).json(result.rows[0])
  } catch (err) {
    await client.query('ROLLBACK').catch(()=>{})
    next(err)
  } finally { client.release() }
})

router.get('/my', requireAuth, async (req,res,next) => {
  try {
    await cleanExpired()
    const { rows } = await pool.query(`
      SELECT b.*, s.name AS station_name, s.console_type
      FROM bookings b JOIN stations s ON s.id=b.station_id
      WHERE b.user_id=$1 AND b.booking_status <> 'PENDING_PAYMENT' ORDER BY b.start_time DESC
    `,[req.user.id])
    res.json(rows)
  } catch (err) { next(err) }
})

router.patch('/:id/cancel', requireAuth, async (req,res,next) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const lookup = await client.query(`
      SELECT * FROM bookings WHERE id=$1 AND user_id=$2 FOR UPDATE
    `,[req.params.id,req.user.id])
    const booking = lookup.rows[0]

    if (!booking || !['CONFIRMED','PENDING_PAYMENT'].includes(booking.booking_status) || new Date(booking.start_time) <= new Date()) {
      await client.query('ROLLBACK')
      return res.status(400).json({ message: 'Booking cannot be cancelled.' })
    }

    // Until automated refunds are implemented, never silently cancel a paid
    // Razorpay booking while leaving the customer's money captured.
    if (booking.payment_method === 'RAZORPAY' && booking.payment_status === 'PAID') {
      await client.query('ROLLBACK')
      return res.status(409).json({ message: 'Paid online bookings require a refund. Please contact the gaming house staff.' })
    }

    const result = await client.query(`
      UPDATE bookings SET booking_status='CANCELLED'
      WHERE id=$1 RETURNING *
    `,[booking.id])

    await client.query('COMMIT')
    req.app.get('io').emit('booking:cancelled', { stationId: result.rows[0].station_id, bookingId:req.params.id })
    res.json(result.rows[0])
  } catch (err) {
    await client.query('ROLLBACK').catch(()=>{})
    next(err)
  } finally { client.release() }
})

export default router
