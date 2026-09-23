import { useState } from 'react'
import { Link,useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Register(){
  const {register}=useAuth(),nav=useNavigate()
  const [form,setForm]=useState({name:'',email:'',phone:'',password:''}),[error,setError]=useState(''),[busy,setBusy]=useState(false)

  async function submit(e){
    e.preventDefault();setBusy(true);setError('')
    try{await register(form);nav('/book')}
    catch(e){setError(e.message||'Registration failed')}
    finally{setBusy(false)}
  }

  return <main className="auth-page"><form className="auth-card glass-card" onSubmit={submit}>
    <span className="eyebrow">CREATE PLAYER PROFILE</span><h1>Register</h1>
    {error&&<div className="alert error">{error}</div>}
    <label>Name<input autoComplete="name" required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
    <label>Email<input type="email" autoComplete="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
    <label>Phone<input type="tel" inputMode="tel" autoComplete="tel" required placeholder="10-digit mobile number" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
    <label>Password<input type="password" autoComplete="new-password" minLength="8" required value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label>
    <button className="btn btn-block" disabled={busy}>{busy?'Creating...':'Create account'}</button>
    <p className="muted">Already registered? <Link to="/login">Login</Link></p>
  </form></main>
}
