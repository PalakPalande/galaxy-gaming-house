import bcrypt from 'bcryptjs'
import { pool } from './config/db.js'

const games = [
  ['Asphalt Legends Unite','asphalt-legends-unite','/games/asphalt-legends.svg','Racing',true,4,'High-speed arcade racing with spectacular tracks and multiplayer action.'],
  ['Mortal Kombat 1','mortal-kombat-1','/games/mortal-kombat.svg','Fighting',true,2,'Fast competitive fighting built for couch battles and tournaments.'],
  ['Tekken 8','tekken-8','/games/tekken-8.svg','Fighting',true,2,'A modern 3D fighter with deep competitive mechanics.'],
  ['Gran Turismo 7','gran-turismo-7','/games/gran-turismo-7.svg','Racing',true,2,'Realistic racing, car collecting and track competition.'],
  ["Marvel's Spider-Man 2",'spider-man-2','/games/spider-man-2.svg','Action',false,1,'Open-world superhero action across New York.'],
  ['EA SPORTS FC 25','ea-sports-fc-25','/games/fc-25.svg','Sports',true,4,'Football matches for solo, local multiplayer and friendly tournaments.'],
  ['Call of Duty: Black Ops 6','black-ops-6','/games/black-ops-6.svg','Shooter',true,2,'Fast-paced action with campaign and multiplayer modes.']
]

try {
  const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  const adminPassword = String(process.env.ADMIN_PASSWORD || '')
  const adminPhone = String(process.env.ADMIN_PHONE || '').trim() || null

  if (adminEmail && adminPassword) {
    if (adminPassword.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters.')
    const adminHash = await bcrypt.hash(adminPassword, 12)
    await pool.query(`
      INSERT INTO users (name,email,phone,password_hash,role)
      VALUES ('Galaxy Admin',$1,$2,$3,'ADMIN')
      ON CONFLICT (email) DO UPDATE SET phone=EXCLUDED.phone, password_hash=EXCLUDED.password_hash, role='ADMIN'
    `, [adminEmail, adminPhone, adminHash])
    console.log(`Admin account seeded for ${adminEmail}.`)
    // Remove the legacy demo admin if the project was seeded with an older build.
    if (adminEmail !== 'admin@galaxy.local') {
      await pool.query(`DELETE FROM users WHERE email='admin@galaxy.local'`)
    }
  } else {
    console.log('ADMIN_EMAIL/ADMIN_PASSWORD not set; skipping admin account seed.')
  }

  for (let i=1;i<=6;i++) {
    await pool.query(`
      INSERT INTO stations (name, console_type, status, hourly_rate, notes)
      VALUES ($1,'PS5','AVAILABLE',$2,$3)
      ON CONFLICT (name) DO NOTHING
    `,[`Nebula PS-${i}`, i <= 4 ? 120 : 150, i <= 4 ? 'Standard 4K setup' : 'Premium large-screen setup'])
  }

  for (const g of games) {
    await pool.query(`
      INSERT INTO games (name,slug,cover_url,genre,multiplayer,max_players,description)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (slug) DO UPDATE SET cover_url=EXCLUDED.cover_url, description=EXCLUDED.description
    `, g)
  }

  const stations = (await pool.query(`SELECT id,name FROM stations ORDER BY name`)).rows
  const dbGames = (await pool.query(`SELECT id,name FROM games ORDER BY name`)).rows
  for (const station of stations) {
    const selected = dbGames.filter((_, idx) => (idx + stations.indexOf(station)) % 2 === 0 || idx < 3)
    for (const game of selected) {
      await pool.query(`INSERT INTO station_games (station_id, game_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [station.id, game.id])
    }
  }

  await pool.query(`
    INSERT INTO offers (code,title,description,discount_type,discount_value,start_at,end_at,active)
    VALUES ('HOSTEL15','Hostel Night Pass','15% off eligible bookings during the promotional period.','PERCENT',15,NOW() - INTERVAL '1 day',NOW() + INTERVAL '365 days',TRUE)
    ON CONFLICT (code) DO NOTHING
  `)

  console.log('Seed complete.')
} catch (err) {
  console.error('Seed failed:', err)
  process.exitCode = 1
} finally {
  await pool.end()
}
