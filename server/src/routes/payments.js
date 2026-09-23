import { Router } from 'express'
import crypto from 'crypto'
import Razorpay from 'razorpay'
import { pool } from '../config/db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

function getRazorpay() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return null
  return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })
}

async function deletePendingBooking(bookingId, userId) {
  const result = await pool.query(`
    DELETE FROM bookings
    WHERE id=$1
      AND user_id=$2
      AND payment_method='RAZORPAY'
      AND booking_status='PENDING_PAYMENT'
      AND payment_status IN ('PENDING','FAILED')
    RETURNING id, station_id
  `, [bookingId, userId])
  return result.rows[0] || null
}

router.post('/create-order', requireAuth, async (req,res,next) => {
  try {
    const razorpay = getRazorpay()
    if (!razorpay) return res.status(503).json({ message: 'Razorpay keys are not configured on the server.' })

    const bookingResult = await pool.query(`
      SELECT * FROM bookings
      WHERE id=$1
        AND user_id=$2
        AND payment_method='RAZORPAY'
        AND booking_status='PENDING_PAYMENT'
        AND payment_status='PENDING'
        AND payment_expires_at > NOW()
    `,[req.body.bookingId, req.user.id])

    const booking = bookingResult.rows[0]
    if (!booking) return res.status(404).json({ message: 'Pending online booking not found or expired.' })

    const order = await razorpay.orders.create({
      amount: Math.round(Number(booking.total_amount) * 100),
      currency: 'INR',
      receipt: booking.booking_code,
      notes: { bookingId: booking.id }
    })

    await pool.query('UPDATE bookings SET razorpay_order_id=$1 WHERE id=$2',[order.id, booking.id])
    res.json({ orderId: order.id, amount: order.amount, currency: order.currency, bookingCode: booking.booking_code })
  } catch (err) { next(err) }
})

router.post('/verify', requireAuth, async (req,res,next) => {
  const client = await pool.connect()
  try {
    const razorpay = getRazorpay()
    if (!razorpay) return res.status(503).json({ message: 'Razorpay keys are not configured on the server.' })

    const { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body
    if (!bookingId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: 'Incomplete payment verification data.' })
    }

    await client.query('BEGIN')
    const bookingResult = await client.query(`
      SELECT * FROM bookings
      WHERE id=$1 AND user_id=$2
      FOR UPDATE
    `,[bookingId, req.user.id])

    const booking = bookingResult.rows[0]
    if (!booking || booking.booking_status !== 'PENDING_PAYMENT' || booking.payment_method !== 'RAZORPAY') {
      await client.query('ROLLBACK')
      return res.status(400).json({ message: 'This payment attempt is no longer active.' })
    }

    if (booking.razorpay_order_id !== razorpay_order_id) {
      await client.query('ROLLBACK')
      return res.status(400).json({ message: 'Payment does not match this booking.' })
    }

    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')

    const signatureBuffer = Buffer.from(String(razorpay_signature))
    const expectedBuffer = Buffer.from(expected)
    const signatureMatches = signatureBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(signatureBuffer, expectedBuffer)

    if (!signatureMatches) {
      await client.query(`DELETE FROM bookings WHERE id=$1`, [bookingId])
      await client.query('COMMIT')
      req.app.get('io').emit('booking:cancelled', { stationId: booking.station_id, bookingId })
      return res.status(400).json({ message: 'Payment verification failed. The temporary booking was removed.' })
    }

    // Do not trust the browser callback alone. Fetch the payment from Razorpay
    // and verify the captured status, order and amount on the backend.
    const payment = await razorpay.payments.fetch(razorpay_payment_id)
    const expectedAmount = Math.round(Number(booking.total_amount) * 100)

    if (payment.order_id !== razorpay_order_id || Number(payment.amount) !== expectedAmount || payment.currency !== 'INR') {
      await client.query('ROLLBACK')
      return res.status(400).json({ message: 'Razorpay payment details do not match this booking.' })
    }

    if (payment.status !== 'captured') {
      await client.query('ROLLBACK')
      return res.status(409).json({ message: `Payment is currently ${payment.status}. Confirmation will be available after Razorpay captures it.` })
    }

    const result = await client.query(`
      UPDATE bookings
      SET payment_status='PAID',
          booking_status='CONFIRMED',
          razorpay_payment_id=$1,
          payment_expires_at=NULL
      WHERE id=$2
      RETURNING *
    `,[razorpay_payment_id, bookingId])

    await client.query('COMMIT')
    req.app.get('io').emit('booking:created', { stationId: result.rows[0].station_id, bookingId })
    res.json(result.rows[0])
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    next(err)
  } finally {
    client.release()
  }
})

router.post('/cancel', requireAuth, async (req,res,next) => {
  try {
    const booking = await deletePendingBooking(req.body.bookingId, req.user.id)
    if (booking) {
      req.app.get('io').emit('booking:cancelled', { stationId: booking.station_id, bookingId: booking.id })
    }
    // Idempotent on purpose: dismiss/failure/navigation handlers can overlap.
    res.json({ cancelled: Boolean(booking) })
  } catch (err) { next(err) }
})

export default router
