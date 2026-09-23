import { useState } from 'react'
import { Link,useLocation,useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login(){
  const {login}=useAuth(),nav=useNavigate(),loc=useLocation()
  const [form,setForm]=useState({email:'',password:''}),[error,setError]=useState(''),[busy,setBusy]=useState(false)

  async function submit(e){
    e.preventDefault();setBusy(true);setError('')
    try{
      const user=await login(form)
      if(user.role==='CUSTOMER') nav(loc.state?.from||'/')
      else nav('/admin')
    }catch(e){setError(e.message||'Login failed')}
    finally{setBusy(false)}
  }

  return <main className="auth-page"><form className="auth-card glass-card" onSubmit={submit}>
    <span className="eyebrow">WELCOME BACK</span><h1>Login</h1>
    {error&&<div className="alert error">{error}</div>}
    <label>Email<input type="email" autoComplete="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
    <label>Password<input type="password" autoComplete="current-password" required value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label>
    <button className="btn btn-block" disabled={busy}>{busy?'Entering orbit...':'Login'}</button>
    <p className="muted">New customer? <Link to="/register">Create account</Link></p>
  </form></main>
}
