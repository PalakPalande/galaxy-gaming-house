import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({children,roles}){
  const {user,loading}=useAuth()
  const location=useLocation()
  if(loading)return <div className="page container"><p>Loading...</p></div>
  if(!user)return <Navigate to="/login" replace state={{from:location.pathname+location.search}}/>
  if(roles&&!roles.includes(user.role))return <Navigate to="/" replace/>
  return children
}
