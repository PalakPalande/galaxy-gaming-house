import { Routes,Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import Games from './pages/Games'
import Stations from './pages/Stations'
import Booking from './pages/Booking'
import Login from './pages/Login'
import Register from './pages/Register'
import MyBookings from './pages/MyBookings'
import Admin from './pages/Admin'
import NotFound from './pages/NotFound'

export default function App(){return <div className="app-shell"><Navbar/><Routes>
  <Route path="/" element={<Home/>}/>
  <Route path="/games" element={<Games/>}/>
  <Route path="/stations" element={<Stations/>}/>
  <Route path="/book" element={<Booking/>}/>
  <Route path="/login" element={<Login/>}/>
  <Route path="/register" element={<Register/>}/>
  <Route path="/my-bookings" element={<ProtectedRoute><MyBookings/></ProtectedRoute>}/>
  <Route path="/admin" element={<ProtectedRoute roles={['ADMIN','STAFF']}><Admin/></ProtectedRoute>}/>
  <Route path="*" element={<NotFound/>}/>
</Routes><Footer/></div>}
