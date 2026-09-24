import { CircleDollarSign, Clock3, Gamepad2, Play, RefreshCw, Square, Users, Wifi, WifiOff } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import api, { SOCKET_URL } from '../api'

const EARLY_START_MS = 5 * 60 * 1000

function formatHms(ms) {
  const total = Math.max(0, Math.floor(Math.abs(ms) / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return [hours, minutes, seconds].map(v => String(v).padStart(2, '0')).join(':')
}

function formatCompact(ms) {
  if (ms <= 0) return 'now'
  const totalMinutes = Math.ceil(ms / 60000)
  if (totalMinutes < 60) return `${totalMinutes}m`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`
}

function bookingStatusClass(status) {
  if (status === 'CONFIRMED') return 'available'
  if (status === 'CANCELLED' || status === 'NO_SHOW') return 'maintenance'
  return 'occupied'
}

export default function Admin() {
  const [overview, setOverview] = useState(null)
  const [bookings, setBookings] = useState([])
  const [sessions, setSessions] = useState([])
  const [stations, setStations] = useState([])
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [acting, setActing] = useState('')
  const [live, setLive] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [now, setNow] = useState(Date.now())
  const refreshTimer = useRef(null)

  const load = useCallback(async ({ signal, quiet = false } = {}) => {
    if (quiet) setRefreshing(true)
    else setLoading(true)
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
    else setLastUpdated(new Date())

    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    load({ signal: controller.signal })

    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] })
    socket.on('connect', () => {
      setLive(true)
      load({ quiet: true })
    })
    socket.on('disconnect', () => setLive(false))
    socket.on('connect_error', () => setLive(false))

    const scheduleRefresh = () => {
      clearTimeout(refreshTimer.current)
      refreshTimer.current = setTimeout(() => load({ quiet: true }), 120)
    }

    ;[
      'station:updated',
      'session:started',
      'session:ended',
      'booking:created',
      'booking:cancelled',
      'booking:updated',
      'payment:updated'
    ].forEach(event => socket.on(event, scheduleRefresh))

    // Socket.IO is primary. This is a quiet fallback in case a connection drops
    // or a free hosting instance briefly reconnects.
    const fallback = setInterval(() => load({ quiet: true }), 30000)

    return () => {
      controller.abort()
      clearInterval(fallback)
      clearTimeout(refreshTimer.current)
      socket.disconnect()
    }
  }, [load])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  async function act(key, fn, confirmText) {
    if (confirmText && !window.confirm(confirmText)) return
    setMsg('')
    setActing(key)
    try {
      await fn()
      await load({ quiet: true })
    } catch (err) {
      setMsg(err?.message || 'Action failed.')
    } finally {
      setActing('')
    }
  }

  function canStartBooking(b) {
    if (b.booking_status !== 'CONFIRMED') return false
    if (sessions.some(s => s.booking_id === b.id)) return false
    const start = new Date(b.start_time).getTime()
    const end = new Date(b.end_time).getTime()
    return now >= start - EARLY_START_MS && now < end
  }

  return (
    <main className="page container">
      <div className="page-head admin-page-head">
        <div>
          <span className="eyebrow">CONTROL ROOM</span>
          <h1>Admin dashboard</h1>
          <p>Manage bookings, live sessions, cash collection and station maintenance.</p>
        </div>
        <div className="admin-live-tools">
          <span className={`live-pill ${live ? 'online' : 'offline'}`}>
            {live ? <Wifi size={14}/> : <WifiOff size={14}/>} {live ? 'LIVE' : 'RECONNECTING'}
          </span>
          <button className="ghost-btn" disabled={refreshing} onClick={() => load({ quiet: true })}>
            <RefreshCw size={15} className={refreshing ? 'spin' : ''}/> Refresh
          </button>
          {lastUpdated && <small>Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</small>}
        </div>
      </div>

      {msg && <div className="alert error">{msg}</div>}
      {loading && <div className="glass-card" style={{ padding: '18px', marginBottom: '20px' }}><p className="muted">Loading dashboard...</p></div>}

      {overview && (
        <div className="metrics">
          <div className="metric glass-card"><CircleDollarSign/><span>Revenue today</span><b>₹{Number(overview.revenueToday).toFixed(0)}</b></div>
          <div className="metric glass-card"><Users/><span>Bookings today</span><b>{overview.bookingsToday}</b></div>
          <div className="metric glass-card"><Gamepad2/><span>Available stations</span><b>{overview.stations.available}/{overview.stations.total}</b><small>{overview.stations.reserved || 0} reserved</small></div>
          <div className="metric glass-card"><Play/><span>Active sessions</span><b>{overview.activeSessions}</b></div>
        </div>
      )}

      <section className="admin-section">
        <div className="section-title-row">
          <div><h2>Active sessions</h2><p className="muted">Timers update every second. A red timer means the booked slot has ended.</p></div>
          <span className="session-count"><Clock3 size={15}/>{sessions.length} running</span>
        </div>
        <div className="table-wrap glass-card">
          <table className="session-table">
            <thead><tr><th>Station</th><th>Customer</th><th>Started</th><th>Elapsed</th><th>Time left</th><th>Action</th></tr></thead>
            <tbody>
              {sessions.map(s => {
                const startedAt = new Date(s.start_time).getTime()
                const scheduledEnd = s.booking_end_time ? new Date(s.booking_end_time).getTime() : null
                const remaining = scheduledEnd ? scheduledEnd - now : null
                const overdue = remaining !== null && remaining <= 0
                const totalWindow = scheduledEnd ? Math.max(1, scheduledEnd - startedAt) : 1
                const elapsed = Math.max(0, now - startedAt)
                const progress = Math.min(100, Math.max(0, (elapsed / totalWindow) * 100))

                return (
                  <tr key={s.id} className={overdue ? 'session-overdue-row' : ''}>
                    <td><b>{s.station_name}</b><small className="table-sub">{s.booking_code}</small></td>
                    <td>{s.customer_name}</td>
                    <td>{new Date(s.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                    <td><span className="mono-timer">{formatHms(elapsed)}</span></td>
                    <td>
                      {remaining === null ? <span className="muted">—</span> : (
                        <div className="timer-cell">
                          <span className={`mono-timer ${overdue ? 'timer-danger' : 'timer-good'}`}>
                            {overdue ? `+${formatHms(remaining)}` : formatHms(remaining)}
                          </span>
                          <small>{overdue ? 'OVERTIME' : `Ends ${new Date(s.booking_end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}</small>
                          <span className="timer-track"><span className={overdue ? 'overdue' : ''} style={{ width: `${progress}%` }}/></span>
                        </div>
                      )}
                    </td>
                    <td>
                      <button className="ghost-btn danger" disabled={Boolean(acting)} onClick={() => act(`end-${s.id}`, () => api.post(`/sessions/${s.id}/end`), `End the session on ${s.station_name}?`)}>
                        <Square size={15}/> {acting === `end-${s.id}` ? 'Ending…' : 'End'}
                      </button>
                    </td>
                  </tr>
                )
              })}
              {!sessions.length && <tr><td colSpan="6" className="muted">No active sessions.</td></tr>}
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
              {bookings.slice(0, 40).map(b => {
                const startMs = new Date(b.start_time).getTime()
                const endMs = new Date(b.end_time).getTime()
                const active = sessions.some(s => s.booking_id === b.id)
                const tooEarly = b.booking_status === 'CONFIRMED' && now < startMs - EARLY_START_MS
                const expired = b.booking_status === 'CONFIRMED' && now >= endMs && !active

                return (
                  <tr key={b.id}>
                    <td>{b.booking_code}</td>
                    <td>{b.customer_name}<small className="table-sub">{b.phone || ''}</small></td>
                    <td>{b.station_name}</td>
                    <td>{new Date(b.start_time).toLocaleString()}<small className="table-sub">to {new Date(b.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></td>
                    <td><span className={`status ${bookingStatusClass(b.booking_status)}`}>{b.booking_status}</span></td>
                    <td>{b.payment_method} • {b.payment_status}</td>
                    <td className="table-actions">
                      {canStartBooking(b) && (
                        <button className="ghost-btn" disabled={Boolean(acting)} onClick={() => act(`start-${b.id}`, () => api.post('/sessions/start', { bookingId: b.id }))}>
                          <Play size={15}/> {acting === `start-${b.id}` ? 'Starting…' : 'Start'}
                        </button>
                      )}
                      {tooEarly && <span className="action-hint">Starts in {formatCompact(startMs - now)}</span>}
                      {expired && <span className="action-hint danger-text">Window ended</span>}
                      {active && <span className="action-hint live-text">In session</span>}
                      {b.payment_method === 'CASH' && b.payment_status !== 'PAID' && ['CONFIRMED','COMPLETED'].includes(b.booking_status) && (
                        <button className="ghost-btn" disabled={Boolean(acting)} onClick={() => act(`cash-${b.id}`, () => api.patch(`/admin/bookings/${b.id}/mark-cash-paid`))}>
                          {acting === `cash-${b.id}` ? 'Saving…' : 'Cash paid'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {!bookings.length && <tr><td colSpan="7" className="muted">No bookings found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-section">
        <h2>Stations</h2>
        <div className="station-grid">
          {stations.map(s => {
            const displayStatus = s.display_status || s.status
            const locked = ['OCCUPIED','RESERVED'].includes(displayStatus)
            return (
              <article className="glass-card station-admin" key={s.id}>
                <div><small>{s.console_type}</small><h3>{s.name}</h3><p>₹{s.hourly_rate}/hour</p></div>
                <span className={`status ${displayStatus === 'AVAILABLE' ? 'available' : displayStatus === 'OCCUPIED' ? 'occupied' : displayStatus === 'RESERVED' ? 'reserved' : 'maintenance'}`}>{displayStatus}</span>
                {s.expected_available_at && displayStatus === 'RESERVED' && <small className="muted">Reserved until {new Date(s.expected_available_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>}
                {!locked && (
                  <button className="ghost-btn" disabled={Boolean(acting)} onClick={() => act(`station-${s.id}`, () => api.patch(`/admin/stations/${s.id}/status`, { status: s.status === 'MAINTENANCE' ? 'AVAILABLE' : 'MAINTENANCE' }))}>
                    {s.status === 'MAINTENANCE' ? 'Mark available' : 'Maintenance'}
                  </button>
                )}
                {locked && <small className="muted">Status is controlled by the current booking/session.</small>}
              </article>
            )
          })}
        </div>
      </section>
    </main>
  )
}
