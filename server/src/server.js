import 'dotenv/config'
import express from 'express'
import http from 'http'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { Server } from 'socket.io'
import { pool } from './config/db.js'
import authRoutes from './routes/auth.js'
import gameRoutes from './routes/games.js'
import stationRoutes from './routes/stations.js'
import bookingRoutes from './routes/bookings.js'
import paymentRoutes from './routes/payments.js'
import sessionRoutes from './routes/sessions.js'
import adminRoutes from './routes/admin.js'
import offerRoutes from './routes/offers.js'
import { notFound,errorHandler } from './middleware/error.js'

if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
  console.error('DATABASE_URL and JWT_SECRET are required. Copy .env.example to .env first.')
  process.exit(1)
}

const app = express()
// Render and similar hosts sit behind a reverse proxy. Trust the first proxy so
// rate limiting sees the real client IP instead of treating every visitor as one.
app.set('trust proxy', 1)
const server = http.createServer(app)
const allowedOrigin = process.env.CLIENT_URL || 'http://localhost:5173'
const io = new Server(server,{ cors:{ origin:allowedOrigin, methods:['GET','POST','PATCH'] } })
app.set('io',io)

app.use(helmet({ crossOriginResourcePolicy:false }))
app.use(cors({ origin:allowedOrigin, credentials:true }))
app.use(express.json({ limit:'1mb' }))
app.use('/api/auth', rateLimit({ windowMs:15*60*1000, limit:100, standardHeaders:true, legacyHeaders:false }))

app.get('/api/health', async (req,res,next) => {
  try { await pool.query('SELECT 1'); res.json({status:'ok',service:'galaxy-gaming-house-api'}) } catch (err) { next(err) }
})
app.use('/api/auth',authRoutes)
app.use('/api/games',gameRoutes)
app.use('/api/stations',stationRoutes)
app.use('/api/offers',offerRoutes)
app.use('/api/bookings',bookingRoutes)
app.use('/api/payments',paymentRoutes)
app.use('/api/sessions',sessionRoutes)
app.use('/api/admin',adminRoutes)
app.use(notFound)
app.use(errorHandler)

io.on('connection',(socket)=> console.log('Socket connected:',socket.id))

const port = process.env.PORT || 5000
server.listen(port,'0.0.0.0',()=>console.log(`Galaxy API running on http://localhost:${port}`))
