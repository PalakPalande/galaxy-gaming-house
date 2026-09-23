import { useCallback,useEffect,useState } from 'react'
import { io } from 'socket.io-client'
import api,{SOCKET_URL} from '../api'
import StationCard from '../components/StationCard'

export default function Stations(){
  const [stations,setStations]=useState([]),[error,setError]=useState('')
  const load=useCallback(async(signal)=>{
    try{const r=await api.get('/stations',{signal});setStations(r.data);setError('')}
    catch(err){if(err?.code!=='ERR_CANCELED'&&err?.name!=='CanceledError')setError(err?.message||'Could not load stations.')}
  },[])

  useEffect(()=>{
    const controller=new AbortController()
    load(controller.signal)
    const socket=io(SOCKET_URL)
    const refresh=()=>load()
    ;['station:updated','session:started','session:ended','booking:created','booking:cancelled'].forEach(e=>socket.on(e,refresh))
    return()=>{controller.abort();socket.disconnect()}
  },[load])

  return <main className="page container"><div className="page-head"><span className="eyebrow">REAL-TIME FLOOR</span><h1>Choose your station</h1><p>Availability updates when bookings begin and when staff start or end sessions.</p></div>
    {error&&<div className="alert error">{error}</div>}
    <div className="station-grid">{stations.map(s=><StationCard key={s.id} station={s}/>)}</div>
  </main>
}
