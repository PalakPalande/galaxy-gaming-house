import { createContext,useContext,useEffect,useState } from 'react'
import api from '../api'

const AuthContext=createContext(null)
export function AuthProvider({children}){
  const [user,setUser]=useState(()=>JSON.parse(localStorage.getItem('galaxy_user')||'null'))
  const [loading,setLoading]=useState(Boolean(localStorage.getItem('galaxy_token')))
  useEffect(()=>{
    if(!localStorage.getItem('galaxy_token')) return
    api.get('/auth/me').then(({data})=>{setUser(data);localStorage.setItem('galaxy_user',JSON.stringify(data))}).catch(()=>logout()).finally(()=>setLoading(false))
  },[])
  function store(data){localStorage.setItem('galaxy_token',data.token);localStorage.setItem('galaxy_user',JSON.stringify(data.user));setUser(data.user)}
  async function login(values){const {data}=await api.post('/auth/login',values);store(data);return data.user}
  async function register(values){const {data}=await api.post('/auth/register',values);store(data);return data.user}
  function logout(){localStorage.removeItem('galaxy_token');localStorage.removeItem('galaxy_user');setUser(null);setLoading(false)}
  return <AuthContext.Provider value={{user,loading,login,register,logout}}>{children}</AuthContext.Provider>
}
export const useAuth=()=>useContext(AuthContext)
