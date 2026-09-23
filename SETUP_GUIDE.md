# Local Setup Guide — Galaxy Gaming House

## 1. Install these applications
1. **Node.js 22 LTS or newer compatible release** from nodejs.org. Vite requires a modern Node release.
2. **Visual Studio Code**.
3. **Git**.
4. **Postman** (optional but useful for testing APIs).
5. A browser such as Chrome/Edge.

You do **not** need to install PostgreSQL locally if you use a free Supabase database.

## 2. Create a Supabase PostgreSQL database
1. Create a Supabase account and project.
2. In the project dashboard click **Connect**.
3. Copy a PostgreSQL connection string. For many home/college IPv4 networks, the **Session pooler** connection is the easiest option.
4. Keep the database password private.

## 3. Open the project
Extract the project folder, then open the `galaxy-gaming-house` folder in VS Code.

Open **Terminal > New Terminal**.

## 4. Install dependencies
From the project root:

```bash
npm install
npm run install:all
```

The first command installs the root development helper (`concurrently`). The second installs client and server packages.

## 5. Configure backend environment variables
In `server`, copy `.env.example` to `.env`.

Windows PowerShell:
```powershell
Copy-Item server/.env.example server/.env
```

Then edit `server/.env`:

```env
PORT=5000
CLIENT_URL=http://localhost:5173
DATABASE_URL=YOUR_SUPABASE_POSTGRES_CONNECTION_STRING
JWT_SECRET=put_a_long_random_secret_here_at_least_32_characters
JWT_EXPIRES_IN=7d
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
NODE_ENV=development
```

For a strong JWT secret you can run:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 6. Configure frontend environment variables
Copy `client/.env.example` to `client/.env`.

```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
VITE_RAZORPAY_KEY_ID=
```

You can leave Razorpay values empty initially. Cash bookings will still work.

## 7. Create database tables
Run:

```bash
npm run db:setup
```

This executes `database/schema.sql` against your PostgreSQL database.

## 8. Add demo data
Run:

```bash
npm run db:seed
```

This creates:
- 6 PS5 stations
- 7 games
- station/game mappings
- the `HOSTEL15` offer
- an admin account

Admin demo login:
- Email: `admin@galaxy.local`
- Password: `Admin@123`

Change this before real use.

## 9. Run the complete project
From the root:

```bash
npm run dev
```

This runs:
- React frontend: `http://localhost:5173`
- Express API: `http://localhost:5000`

Check the API manually at:
`http://localhost:5000/api/health`

## 10. Test the main workflow
1. Open the site and create a customer account.
2. Open **Games** and confirm the seeded PS5 game cards appear.
3. Open **Stations**.
4. Book a station and choose **Cash**.
5. Log out and log in as the admin.
6. Open **Admin**.
7. Find the booking and click **Start**.
8. Open the station page in another browser/tab; the station should become occupied.
9. End the session in Admin.
10. Mark the cash payment as paid.

## 11. Enable Razorpay test payments
1. Create a Razorpay account.
2. Switch to **Test Mode**.
3. Generate a test Key ID and Key Secret.
4. Put both values in `server/.env`.
5. Put only the **Key ID** in `client/.env` as `VITE_RAZORPAY_KEY_ID`.
6. Restart both servers after changing `.env` files.

Never put `RAZORPAY_KEY_SECRET` in the frontend.

## 12. Where to change business data
- Gaming-house address/social links: `client/src/components/Footer.jsx`
- Home text: `client/src/pages/Home.jsx`
- Game demo data: `server/src/seed.js`
- PS5 station count/prices: `server/src/seed.js`
- Offer: `server/src/seed.js`
- Theme/colors: variables at the top of `client/src/styles.css`

## 13. Game artwork
The included artwork is original demo SVG artwork, not official publisher cover art. For a real commercial website, replace it with artwork the gaming house has permission to use.
