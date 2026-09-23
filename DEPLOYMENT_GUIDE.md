# Free/Low-Cost Deployment Guide

Recommended student-project deployment:
- **Frontend:** Vercel
- **Backend:** Render Web Service
- **Database:** Supabase PostgreSQL

## A. Push to GitHub
Create a GitHub repository and push the project. Never commit `.env` files.

## B. Deploy backend to Render
1. Create a Render Web Service from the GitHub repository.
2. Root directory: `server`
3. Build command: `npm install`
4. Start command: `npm start`
5. Add environment variables from `server/.env`.
6. Set `NODE_ENV=production`.
7. Initially set `CLIENT_URL` to your future Vercel URL once known.
8. Deploy and copy the generated Render URL.

Render free services can spin down after idle time, so the first request after inactivity may be slow.

## C. Deploy frontend to Vercel
1. Import the GitHub repository into Vercel.
2. Root directory: `client`
3. Framework preset: Vite
4. Build command: `npm run build`
5. Add:
   - `VITE_API_URL=https://YOUR-RENDER-APP.onrender.com/api`
   - `VITE_SOCKET_URL=https://YOUR-RENDER-APP.onrender.com`
   - `VITE_RAZORPAY_KEY_ID=YOUR_PUBLIC_TEST_OR_LIVE_KEY_ID`
6. Deploy.

## D. Update Render CORS origin
Set Render `CLIENT_URL` to the exact Vercel URL, for example:
`https://galaxy-gaming-house.vercel.app`
Then redeploy/restart the Render service.

## E. Production cautions
For an actual business launch, add proper terms/refund policy, production Razorpay webhooks, stricter admin account management, backups, monitoring, email/WhatsApp confirmations and a paid always-on backend if the free service sleep delay is unacceptable.
