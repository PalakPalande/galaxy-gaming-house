import { Clock,Gamepad2 } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function StationCard({station}){
  const display=station.display_status || station.status
  const state=display==='AVAILABLE'?'available':display==='OCCUPIED'?'occupied':display==='RESERVED'?'reserved':'maintenance'
  return <article className="station-card glass-card">
    <div className="station-top"><div><small>{station.console_type}</small><h3>{station.name}</h3></div><span className={`status ${state}`}>{display}</span></div>
    <div className="price">₹{Number(station.hourly_rate).toFixed(0)}<span>/hour</span></div>
    {station.expected_available_at&&<p className="muted"><Clock size={15}/> Expected free {new Date(station.expected_available_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</p>}
    <div className="tag-row">{station.games?.slice(0,4).map(g=><span className="tag" key={g.id}>{g.name}</span>)}</div>
    {display==='MAINTENANCE'
      ? <button className="btn btn-block" disabled>Temporarily unavailable</button>
      : <Link className="btn btn-block" to={`/book?station=${station.id}`}><Gamepad2 size={17}/> Book Station</Link>}
  </article>
}
