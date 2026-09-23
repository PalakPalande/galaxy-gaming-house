import { Search } from 'lucide-react'
import { useEffect,useMemo,useState } from 'react'
import api from '../api'
import GameCard from '../components/GameCard'

export default function Games(){
  const [games,setGames]=useState([]),[q,setQ]=useState(''),[error,setError]=useState('')
  useEffect(()=>{
    const controller=new AbortController()
    api.get('/games',{signal:controller.signal}).then(r=>setGames(r.data)).catch(err=>{
      if(err?.code!=='ERR_CANCELED'&&err?.name!=='CanceledError')setError(err?.message||'Could not load games.')
    })
    return()=>controller.abort()
  },[])
  const filtered=useMemo(()=>games.filter(g=>(g.name+' '+g.genre).toLowerCase().includes(q.toLowerCase())),[games,q])
  return <main className="page container"><div className="page-head"><span className="eyebrow">GAME LIBRARY</span><h1>Available PS5 games</h1><p>Demo artwork is included locally so the project works without depending on third-party image hotlinks.</p></div>
    {error&&<div className="alert error">{error}</div>}
    <div className="search-box"><Search size={18}/><input placeholder="Search by game or genre" value={q} onChange={e=>setQ(e.target.value)}/></div>
    <div className="game-grid">{filtered.map(g=><GameCard key={g.id} game={g}/>)}</div>
  </main>
}
