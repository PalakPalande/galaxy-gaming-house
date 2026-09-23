import { CircleDollarSign, Gamepad2, Play, Square, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import api from '../api'

export default function Admin() {
  const [overview, setOverview] = useState(null)
  const [bookings, setBookings] = useState([])
  const [sessions, setSessions] = useState([])
  const [stations, setStations] = useState([])
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)

  const load = useCallback(async (signal) => {
    setLoading(true)
    setMsg('')

    const requests = await Promise.allSettled([
      api.get('/admin/overview', { signal }),
      api.get('/admin/bookings', { signal }),
      api.get('/sessions/active', { signal }),
      api.get('/stations', { signal })
    ])

    if (signal?.aborted) return

    const [o, b, se, st] = requests
    if (o.status === 'fulfilled') setOverview(o.value.data)
    if (b.status === 'fulfilled') setBookings(b.value.data)
    if (se.status === 'fulfilled') setSessions(se.value.data)
    if (st.status === 'fulfilled') setStations(st.value.data)

    const failed = requests.find(r => r.status === 'rejected' && r.reason?.code !== 'ERR_CANCELED')
    if (failed) setMsg(failed.reason?.message || 'Some dashboard data could not be loaded.')

    setLoading(false)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  async function act(fn) {
    setMsg('')
    setActing(true)
    try {
      await fn()
      await load()
    } catch (err) {
      setMsg(err?.message || 'Action failed.')
    } finally {
      setActing(false)
    }
  }

  return (
    <main className="page container">
      <div className="page-head">
        <span className="eyebrow">CONTROL ROOM</span>
        <h1>Admin dashboard</h1>
        <p>Manage confirmed bookings, active sessions, cash collection and station maintenance.</p>
      </div>

      {msg && <div className="alert error">{msg}</div>}
      {loading && <div className="glass-card" style={{ padding: '18px', marginBottom: '20px' }}><p className="muted">Loading dashboard...</p></div>}

      {overview && (
        <div className="metrics">
          <div className="metric glass-card"><CircleDollarSign/><span>Revenue today</span><b>₹{Number(overview.revenueToday).toFixed(0)}</b></div>
          <div className="metric glass-card"><Users/><span>Bookings today</span><b>{overview.bookingsToday}</b></div>
          <div className="metric glass-card"><Gamepad2/><span>Available stations</span><b>{overview.stations.available}/{overview.stations.total}</b></div>
          <div className="metric glass-card"><Play/><span>Active sessions</span><b>{overview.activeSessions}</b></div>
        </div>
      )}

      <section className="admin-section">
        <h2>Active sessions</h2>
        <div className="table-wrap glass-card">
          <table>
            <thead><tr><th>Station</th><th>Customer</th><th>Started</th><th>Action</th></tr></thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.id}>
                  <td>{s.station_name}</td>
                  <td>{s.customer_name}</td>
                  <td>{new Date(s.start_time).toLocaleTimeString()}</td>
                  <td><button className="ghost-btn danger" disabled={acting} onClick={() => act(() => api.post(`/sessions/${s.id}/end`))}><Square size={15}/> End</button></td>
                </tr>
              ))}
              {!sessions.length && <tr><td colSpan="4" className="muted">No active sessions.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-section">
        <h2>Bookings</h2>
        <div className="table-wrap glass-card">
          <table>
            <thead><tr><th>Code</th><th>Customer</th><th>Station</th><th>Start</th><th>Status</th><th>Payment</th><th>Action</th></tr></thead>
            <tbody>
              {bookings.slice(0, 30).map(b => (
                <tr key={b.id}>
                  <td>{b.booking_code}</td>
                  <td>{b.customer_name}</td>
                  <td>{b.station_name}</td>
                  <td>{new Date(b.start_time).toLocaleString()}</td>
                  <td>{b.booking_status}</td>
                  <td>{b.payment_method} • {b.payment_status}</td>
                  <td className="table-actions">
                    {b.booking_status === 'CONFIRMED' && !sessions.some(s => s.booking_id === b.id) && (
                      <button className="ghost-btn" disabled={acting} onClick={() => act(() => api.post('/sessions/start', { bookingId: b.id }))}><Play size={15}/> Start</button>
                    )}
                    {b.payment_method === 'CASH' && b.payment_status !== 'PAID' && b.booking_status === 'CONFIRMED' && (
                      <button className="ghost-btn" disabled={acting} onClick={() => act(() => api.patch(`/admin/bookings/${b.id}/mark-cash-paid`))}>Cash paid</button>
                    )}
                  </td>
                </tr>
              ))}
              {!bookings.length && <tr><td colSpan="7" className="muted">No bookings found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-section">
        <h2>Stations</h2>
        <div className="station-grid">
          {stations.map(s => (
            <article className="glass-card station-admin" key={s.id}>
              <div><small>{s.console_type}</small><h3>{s.name}</h3><p>₹{s.hourly_rate}/hour</p></div>
              <span className={`status ${s.status === 'AVAILABLE' ? 'available' : s.status === 'OCCUPIED' ? 'occupied' : 'maintenance'}`}>{s.status}</span>
              {s.status !== 'OCCUPIED' && (
                <button className="ghost-btn" disabled={acting} onClick={() => act(() => api.patch(`/admin/stations/${s.id}/status`, { status: s.status === 'MAINTENANCE' ? 'AVAILABLE' : 'MAINTENANCE' }))}>
                  {s.status === 'MAINTENANCE' ? 'Mark available' : 'Maintenance'}
                </button>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
