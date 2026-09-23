# Galaxy Gaming House

A full-stack gaming-house reservation and operations platform with a galactic black/blue/purple UI.

## Core features
- Customer registration and JWT login
- PS5 station catalogue and live status
- Installed-game mapping per station
- 7 seeded game cards with local demo artwork
- Slot booking with overlap prevention
- Cash payment option
- Razorpay online-payment integration
- Offer codes and automatic server-side pricing
- Customer booking history and cancellation
- Staff/admin session start and end
- Server-authoritative session timing and final billing
- Cash-payment confirmation at the counter
- Admin dashboard with daily metrics
- Station maintenance toggle
- Socket.IO live updates

## Stack
- Frontend: React + Vite + React Router + Axios + Socket.IO Client + custom CSS
- Backend: Node.js + Express + PostgreSQL `pg` driver + JWT + bcrypt + Socket.IO
- Database: PostgreSQL (recommended free development host: Supabase)
- Online payment: Razorpay
- Suggested hosting: Vercel (client), Render (server), Supabase (PostgreSQL)

Read `SETUP_GUIDE.md` first.
