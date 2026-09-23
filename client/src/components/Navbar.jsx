import { Gamepad2,LogOut,Menu,X } from 'lucide-react'
import { useState } from 'react'
import { Link,NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar(){
  const [open,setOpen]=useState(false); const {user,logout}=useAuth()
  const links=[['/','Home'],['/games','Games'],['/stations','Stations'],['/book','Book']]
  return <header className="navbar"><div className="container nav-inner">
    <Link className="brand" to="/"><span className="brand-orbit"><Gamepad2 size={22}/></span><span>GALAXY <b>GAMING</b></span></Link>
    <button className="icon-btn mobile-menu" onClick={()=>setOpen(!open)}>{open?<X/>:<Menu/>}</button>
    <nav className={open?'nav-links open':'nav-links'} onClick={()=>setOpen(false)}>
      {links.map(([to,label])=><NavLink key={to} to={to}>{label}</NavLink>)}
      {user && <NavLink to="/my-bookings">My Bookings</NavLink>}
      {user && ['ADMIN','STAFF'].includes(user.role) && <NavLink to="/admin">Admin</NavLink>}
      {!user ? <Link className="btn btn-small" to="/login">Login</Link> : <button className="ghost-btn" onClick={logout}><LogOut size={16}/> Logout</button>}
    </nav>
  </div></header>
}
