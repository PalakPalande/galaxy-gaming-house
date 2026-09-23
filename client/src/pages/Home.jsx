import { ArrowRight,BadgeIndianRupee,CalendarCheck,Clock3,Gamepad2,Sparkles } from 'lucide-react'
import { useEffect,useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import GameCard from '../components/GameCard'
import StationCard from '../components/StationCard'

export default function Home(){
 const [games,setGames]=useState([]),[stations,setStations]=useState([]),[offers,setOffers]=useState([])
 useEffect(()=>{
   const controller=new AbortController()
   Promise.all([api.get('/games',{signal:controller.signal}),api.get('/stations',{signal:controller.signal}),api.get('/offers',{signal:controller.signal})]).then(([g,s,o])=>{setGames(g.data);setStations(s.data);setOffers(o.data)}).catch(()=>{})
   return()=>controller.abort()
 },[])
 return <>
 <section className="hero"><div className="stars"></div><div className="container hero-grid"><div><span className="eyebrow"><Sparkles size={16}/> LIVE • BOOK • PLAY</span><h1>YOUR GAME.<br/><span>YOUR STATION.</span><br/>YOUR TIME.</h1><p>Check PS5 availability, discover installed games, reserve your slot, choose cash or online payment, and walk in ready to play.</p><div className="hero-actions"><Link to="/book" className="btn">Book a Station <ArrowRight size={18}/></Link><Link to="/games" className="btn secondary">Explore Games</Link></div><div className="hero-stats"><div><b>{stations.filter(s=>(s.display_status||s.status)==='AVAILABLE').length}</b><span>Available now</span></div><div><b>{games.length}+</b><span>Games listed</span></div><div><b>₹{stations[0]?.hourly_rate||120}</b><span>Starting / hr</span></div></div></div><div className="hero-console glass-card"><div className="planet-ring"></div><Gamepad2 size={140}/><div className="console-glow"></div><p>GALACTIC PS5 LOUNGE</p></div></div></section>
 <section className="section container"><div className="section-head"><div><span className="eyebrow">LIVE FLOOR</span><h2>Station availability</h2></div><Link to="/stations">View all <ArrowRight size={16}/></Link></div><div className="station-grid">{stations.slice(0,3).map(s=><StationCard key={s.id} station={s}/>)}</div></section>
 <section className="section game-section"><div className="container"><div className="section-head"><div><span className="eyebrow">AVAILABLE GAMES</span><h2>Pick your universe</h2></div><Link to="/games">Full library <ArrowRight size={16}/></Link></div><div className="game-grid">{games.slice(0,6).map(g=><GameCard key={g.id} game={g}/>)}</div></div></section>
 <section className="section container"><div className="feature-grid"><div className="glass-card feature"><CalendarCheck/><h3>Pre-book slots</h3><p>No more reaching the shop and discovering every console has been conquered by humanity.</p></div><div className="glass-card feature"><Clock3/><h3>Automatic sessions</h3><p>Staff start and end sessions while the server calculates actual play time.</p></div><div className="glass-card feature"><BadgeIndianRupee/><h3>Cash + online</h3><p>Choose pay-at-counter cash or Razorpay test/online checkout.</p></div></div></section>
 {offers[0]&&<section className="section container"><div className="offer-banner"><div><span className="eyebrow">ACTIVE OFFER • {offers[0].code}</span><h2>{offers[0].title}</h2><p>{offers[0].description}</p></div><div className="offer-value">{offers[0].discount_type==='PERCENT'?`${offers[0].discount_value}%`:`₹${offers[0].discount_value}`}<small>OFF</small></div></div></section>}
 <section className="section container"><div className="cta glass-card"><h2>Ready to enter the lobby?</h2><p>Pick a PS5, choose your time and reserve it before someone else does the extremely human thing of arriving five minutes before you.</p><Link className="btn" to="/book">Reserve now</Link></div></section>
 </>
}
