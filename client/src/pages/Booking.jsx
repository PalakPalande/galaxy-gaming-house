import { CalendarClock, CreditCard, IndianRupee, Smartphone, WalletCards } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../context/AuthContext'

function loadRazorpay() {
  return new Promise(resolve => {
    if (window.Razorpay) return resolve(true)

    const existing = document.querySelector('script[data-galaxy-razorpay="true"]')
    if (existing) {
      if (existing.dataset.loaded === 'true') return resolve(Boolean(window.Razorpay))
      existing.addEventListener('load', () => resolve(true), { once: true })
      existing.addEventListener('error', () => resolve(false), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.dataset.galaxyRazorpay = 'true'
    script.onload = () => { script.dataset.loaded = 'true'; resolve(true) }
    script.onerror = () => { script.remove(); resolve(false) }
    document.body.appendChild(script)
  })
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

export default function Booking() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [stations, setStations] = useState([])
  const [offers, setOffers] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const checkoutRef = useRef(null)
  const pendingBookingRef = useRef(null)
  const checkoutReportedSuccessRef = useRef(false)

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  tomorrow.setMinutes(tomorrow.getMinutes() - tomorrow.getTimezoneOffset())
  const nowLocal = new Date()
  nowLocal.setMinutes(nowLocal.getMinutes() - nowLocal.getTimezoneOffset())
  const minStart = nowLocal.toISOString().slice(0, 16)

  const [form, setForm] = useState({
    stationId: params.get('station') || '',
    start: tomorrow.toISOString().slice(0, 16),
    duration: 60,
    paymentChoice: 'CASH',
    offerCode: ''
  })

  useEffect(() => {
    const controller = new AbortController()

    async function loadPage() {
      try {
        const [stationResponse, offerResponse] = await Promise.all([
          api.get('/stations', { signal: controller.signal }),
          api.get('/offers', { signal: controller.signal })
        ])

        setStations(stationResponse.data)
        setOffers(offerResponse.data)
        setForm(current => ({
          ...current,
          stationId: current.stationId || stationResponse.data[0]?.id || ''
        }))
      } catch (err) {
        if (err?.code !== 'ERR_CANCELED' && err?.name !== 'CanceledError') {
          setError(err?.message || 'Could not load booking information.')
        }
      }
    }

    loadPage()

    return () => {
      controller.abort()
      const pendingId = pendingBookingRef.current
      const checkoutSucceeded = checkoutReportedSuccessRef.current
      try { checkoutRef.current?.close?.() } catch {}
      checkoutRef.current = null

      // Navigating away while checkout is still unpaid should release the hold.
      // If Razorpay has already reported success, never delete it here; the
      // backend must finish/retry verification instead.
      if (pendingId && !checkoutSucceeded) {
        api.post('/payments/cancel', { bookingId: pendingId }).catch(() => {})
      }
    }
  }, [])

  const station = stations.find(s => s.id === form.stationId)
  const estimate = useMemo(
    () => station ? Number(station.hourly_rate) * (Number(form.duration) / 60) : 0,
    [station, form.duration]
  )

  async function cancelPendingPayment(bookingId) {
    if (!bookingId) return
    try {
      await api.post('/payments/cancel', { bookingId })
    } catch {
      // Idempotent endpoint + server expiry handle duplicate cleanup attempts.
    } finally {
      if (pendingBookingRef.current === bookingId) pendingBookingRef.current = null
    }
  }

  async function verifyWithRetry(payload) {
    let lastError
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await api.post('/payments/verify', payload)
      } catch (err) {
        lastError = err
        if (attempt < 2) await sleep(900 * (attempt + 1))
      }
    }
    throw lastError
  }

  async function submit(e) {
    e.preventDefault()

    if (!user) {
      nav('/login', { state: { from: '/book' } })
      return
    }
    if (busy) return

    setBusy(true)
    setError('')
    setSuccess('')
    checkoutReportedSuccessRef.current = false
    let pendingBookingId = null

    try {
      const start = new Date(form.start)
      const end = new Date(start.getTime() + Number(form.duration) * 60000)
      const backendPaymentMethod = form.paymentChoice === 'CASH' ? 'CASH' : 'RAZORPAY'

      const { data: booking } = await api.post('/bookings', {
        stationId: form.stationId,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        paymentMethod: backendPaymentMethod,
        offerCode: form.offerCode || undefined
      })

      if (form.paymentChoice === 'CASH') {
        setSuccess(`Booking ${booking.booking_code} confirmed. Pay ₹${booking.total_amount} in cash at the counter.`)
        setBusy(false)
        return
      }

      pendingBookingId = booking.id
      pendingBookingRef.current = booking.id

      const loaded = await loadRazorpay()
      if (!loaded) {
        await cancelPendingPayment(booking.id)
        throw new Error('Could not load Razorpay checkout. No booking was created.')
      }

      const { data: order } = await api.post('/payments/create-order', { bookingId: booking.id })

      await new Promise(resolve => {
        let resolved = false
        let verificationStarted = false

        const finish = () => {
          if (resolved) return
          resolved = true
          checkoutRef.current = null
          setBusy(false)
          resolve()
        }

        const options = {
          key: import.meta.env.VITE_RAZORPAY_KEY_ID,
          amount: order.amount,
          currency: 'INR',
          name: 'Galaxy Gaming House',
          description: `Booking ${booking.booking_code}`,
          order_id: order.orderId,
          prefill: {
            name: user.name,
            email: user.email,
            contact: user.phone || ''
          },
          theme: { color: '#6d5dfc' },
          modal: {
            ondismiss: async () => {
              if (verificationStarted || resolved) return
              await cancelPendingPayment(booking.id)
              setError('Payment was cancelled. Your slot was not booked.')
              finish()
            }
          },
          handler: async response => {
            if (resolved) return
            verificationStarted = true
            checkoutReportedSuccessRef.current = true

            try {
              await verifyWithRetry({ bookingId: booking.id, ...response })
              pendingBookingId = null
              pendingBookingRef.current = null
              setSuccess(`Payment verified. Booking ${booking.booking_code} is confirmed.`)
            } catch (err) {
              // Never auto-delete after Razorpay reports success. A transient
              // network/server error must not turn a paid customer into a
              // deleted booking. The user should not submit a second payment.
              setError(err?.message || 'Payment was received but confirmation could not be verified. Do not pay again; contact the gaming house staff.')
            } finally {
              finish()
            }
          }
        }

        if (form.paymentChoice === 'UPI') options.method = 'upi'

        const razorpay = new window.Razorpay(options)
        checkoutRef.current = razorpay

        razorpay.on('payment.failed', response => {
          if (verificationStarted || resolved) return
          const description = response?.error?.description || 'Payment failed.'
          setError(`${description} You can retry in Razorpay. If you close checkout, the temporary slot hold will be removed.`)
        })

        razorpay.open()
      })
    } catch (err) {
      if (pendingBookingId && !checkoutReportedSuccessRef.current) await cancelPendingPayment(pendingBookingId)
      setError(err?.message || 'Booking failed.')
      setBusy(false)
    }
  }

  return (
    <main className="page container">
      <div className="page-head">
        <span className="eyebrow">RESERVE YOUR SLOT</span>
        <h1>Book a PS5 station</h1>
        <p>Choose cash, UPI, or other online methods. Online bookings are confirmed only after the server verifies the Razorpay payment.</p>
      </div>

      <div className="booking-layout">
        <form className="glass-card booking-form" onSubmit={submit}>
          {error && <div className="alert error">{error}</div>}
          {success && <div className="alert success">{success}</div>}

          <label>
            Station
            <select value={form.stationId} onChange={e => setForm({ ...form, stationId: e.target.value })}>
              {stations.filter(s => s.status !== 'MAINTENANCE').map(s => (
                <option key={s.id} value={s.id}>{s.name} • ₹{s.hourly_rate}/hr</option>
              ))}
            </select>
          </label>

          <label>
            Date & start time
            <input type="datetime-local" min={minStart} required value={form.start} onChange={e => setForm({ ...form, start: e.target.value })} />
          </label>

          <label>
            Duration
            <select value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })}>
              <option value="30">30 minutes</option>
              <option value="60">1 hour</option>
              <option value="90">1.5 hours</option>
              <option value="120">2 hours</option>
              <option value="180">3 hours</option>
            </select>
          </label>

          <label>
            Offer code
            <input
              placeholder={offers[0]?.code || 'Optional'}
              value={form.offerCode}
              onChange={e => setForm({ ...form, offerCode: e.target.value.toUpperCase() })}
            />
          </label>

          <div>
            <span className="field-label">Payment method</span>
            <div className="payment-options payment-options-three">
              <button type="button" className={form.paymentChoice === 'CASH' ? 'payment-option active' : 'payment-option'} onClick={() => setForm({ ...form, paymentChoice: 'CASH' })}>
                <WalletCards/><b>Cash</b><small>Pay at counter</small>
              </button>
              <button type="button" className={form.paymentChoice === 'UPI' ? 'payment-option active' : 'payment-option'} onClick={() => setForm({ ...form, paymentChoice: 'UPI' })}>
                <Smartphone/><b>UPI</b><small>Available when enabled on Razorpay</small>
              </button>
              <button type="button" className={form.paymentChoice === 'ONLINE' ? 'payment-option active' : 'payment-option'} onClick={() => setForm({ ...form, paymentChoice: 'ONLINE' })}>
                <CreditCard/><b>Card / Other</b><small>Razorpay Checkout</small>
              </button>
            </div>
          </div>

          <button className="btn btn-block" disabled={busy || !form.stationId}>
            {busy ? 'Processing...' : 'Confirm booking'}
          </button>
        </form>

        <aside className="glass-card booking-summary">
          <CalendarClock size={34}/>
          <h3>Booking summary</h3>
          <p>{station?.name || 'Choose a station'}</p>
          <div className="summary-row"><span>Rate</span><b>₹{station?.hourly_rate || 0}/hr</b></div>
          <div className="summary-row"><span>Duration</span><b>{form.duration} min</b></div>
          <div className="summary-row"><span>Payment</span><b>{form.paymentChoice}</b></div>
          <div className="summary-total"><span>Estimated</span><b><IndianRupee size={20}/>{estimate.toFixed(0)}</b></div>
          <small>Final price is calculated by the backend and may change if a valid offer is applied.</small>
        </aside>
      </div>
    </main>
  )
}
