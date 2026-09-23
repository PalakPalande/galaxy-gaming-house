import { useCallback, useEffect, useState } from 'react'
import api from '../api'

export default function MyBookings() {
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async ({ signal, quiet = false } = {}) => {
    if (!quiet) setLoading(true)
    else setRefreshing(true)
    setError('')

    try {
      const response = await api.get('/bookings/my', { signal })
      setItems(response.data)
    } catch (err) {
      if (err?.code !== 'ERR_CANCELED' && err?.name !== 'CanceledError') {
        setError(err?.message || 'Could not load your bookings.')
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    load({ signal: controller.signal })

    return () => controller.abort()
  }, [load])

  async function cancel(id) {
    setError('')
    try {
      await api.patch(`/bookings/${id}/cancel`)
      await load({ quiet: true })
    } catch (err) {
      setError(err?.message || 'Could not cancel this booking.')
    }
  }

  return (
    <main className="page container">
      <div className="page-head">
        <span className="eyebrow">PLAYER HISTORY</span>
        <h1>My bookings</h1>
        <p>Confirmed, completed and cancelled bookings appear here. Unpaid online checkout attempts are not treated as bookings.</p>
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="booking-list">
        {loading ? (
          <div className="glass-card booking-item"><p className="muted">Loading bookings...</p></div>
        ) : (
          <>
            {items.map(b => (
              <article className="glass-card booking-item" key={b.id}>
                <div>
                  <small>{b.booking_code}</small>
                  <h3>{b.station_name}</h3>
                  <p>
                    {new Date(b.start_time).toLocaleString()} →{' '}
                    {new Date(b.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div>
                  <span className={`status ${b.booking_status === 'CONFIRMED' ? 'available' : b.booking_status === 'CANCELLED' ? 'maintenance' : 'occupied'}`}>
                    {b.booking_status}
                  </span>
                  <p><b>₹{b.total_amount}</b> • {b.payment_method} • {b.payment_status}</p>
                  {b.booking_status === 'CONFIRMED' && new Date(b.start_time) > new Date() && !(b.payment_method === 'RAZORPAY' && b.payment_status === 'PAID') && (
                    <button className="ghost-btn danger" disabled={refreshing} onClick={() => cancel(b.id)}>
                      Cancel
                    </button>
                  )}
                </div>
              </article>
            ))}
            {!items.length && <p className="muted">No bookings yet.</p>}
          </>
        )}
      </div>
    </main>
  )
}
