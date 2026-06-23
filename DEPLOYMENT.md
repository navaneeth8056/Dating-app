# Deployment guide — share the app with devices & teammates

Your app has two parts that must be deployed separately:

- **web/** (Next.js frontend) → **Vercel**
- **server/** (Express + Socket.IO backend) → **Render**
- **MongoDB Atlas** and **Daily.co** you already have.

Both Vercel and Render give you **HTTPS automatically** — which is required for the
camera/mic to work on phones and other devices.

There are two paths below:

- **Option A — Vercel + Render** (recommended): a stable public link you can reuse.
- **Option B — Quick tunnel** (cloudflared): fastest for a same-day test, no GitHub needed.

---

## Option A — Vercel + Render (recommended)

### Step 0 — Put the code on GitHub
From the project root (`Dating app-Daily`):
```bash
git init
git add .
git commit -m "Speed dating app"
```
Create a new repo on GitHub and follow its "push an existing repo" commands.
(Your `.env` files and `node_modules` are already git-ignored — secrets stay out of the repo.)

> Before sharing widely, rotate your MongoDB password (Atlas → Database Access → Edit user),
> since it appeared in earlier screenshots.

---

### Step 1 — Deploy the backend on Render
1. Go to <https://render.com> → **New → Web Service** → connect your GitHub repo.
2. Configure:
   - **Root Directory:** `server`
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
3. Add **Environment Variables** (Render → your service → Environment):
   | Key | Value |
   |---|---|
   | `MONGODB_URI` | your Atlas connection string (the non-SRV one you're using) |
   | `DAILY_API_KEY` | your Daily key |
   | `JWT_SECRET` | any long random string (e.g. 40+ random chars) |
   | `ADMIN_PASSWORD` | a password for deleting events (default was `admin123`) |
   | `CLIENT_ORIGIN` | leave as `http://localhost:3000` **for now** — we set the real one in Step 3 |
   - Don't set `PORT` — Render provides it and the app reads it automatically.
4. Deploy. When it's live you'll get a URL like `https://speeddating-server.onrender.com`.
5. Test it: open `https://<your-render-url>/health` → you should see the JSON `{ "ok": true, ... }`.

> **Atlas access:** make sure Atlas → Network Access allows `0.0.0.0/0` (you already added this)
> so Render's servers can connect.

---

### Step 2 — Deploy the frontend on Vercel
1. Go to <https://vercel.com> → **Add New → Project** → import the same GitHub repo.
2. Configure:
   - **Root Directory:** `web`
   - Framework Preset: **Next.js** (auto-detected)
3. Add **Environment Variables** (Vercel → Project → Settings → Environment Variables):
   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | your Render backend URL, e.g. `https://speeddating-server.onrender.com` |
   | `NEXT_PUBLIC_APP_URL` | your Vercel URL once known (you can add it after first deploy and redeploy) |
4. Deploy. You'll get a URL like `https://speeddating-web.vercel.app`.

> These `NEXT_PUBLIC_*` values are baked in **at build time**, so if you change them later you
> must **redeploy** the Vercel project.

---

### Step 3 — Connect the two (CORS)
1. Back in **Render → your service → Environment**, set:
   ```
   CLIENT_ORIGIN = https://speeddating-web.vercel.app,http://localhost:3000
   ```
   (Use your real Vercel URL. The comma-separated list lets the deployed site **and** your
   local machine both talk to the backend.)
2. Save — Render redeploys automatically.
3. In **Vercel**, set `NEXT_PUBLIC_APP_URL` to your Vercel URL and **redeploy** so the
   shareable `/join/...` links use the public domain.

---

### Step 4 — Test & share
- Open your Vercel URL → **Go to Admin** → create an event → copy the **Join link**.
- Open that link on your phone and send it to teammates. Cameras will work (HTTPS). 🎉

---

## Option B — Quick tunnel (cloudflared, no deploy)

Best for a fast test while everything runs on your machine. Gives temporary HTTPS URLs.

1. Install cloudflared: <https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/>
   (or `winget install --id Cloudflare.cloudflared`).
2. Start your app locally as usual (`npm run dev` in both `server` and `web`).
3. In two more terminals, open a tunnel to each:
   ```bash
   cloudflared tunnel --url http://localhost:4000   # backend  → gives https://xxxx.trycloudflare.com
   cloudflared tunnel --url http://localhost:3000   # frontend → gives https://yyyy.trycloudflare.com
   ```
4. Point the apps at the tunnels:
   - `web/.env`: `NEXT_PUBLIC_API_URL=https://xxxx.trycloudflare.com` and
     `NEXT_PUBLIC_APP_URL=https://yyyy.trycloudflare.com`
   - `server/.env`: `CLIENT_ORIGIN=https://yyyy.trycloudflare.com,http://localhost:3000`
5. **Restart both** `npm run dev`, then share the **frontend** tunnel URL (`https://yyyy...`).

Caveats: the free tunnel URLs change each time you start them, and your laptop must stay on
with both servers running.

---

## Important notes for live events

- **Render free tier sleeps** after ~15 min idle and cold-starts (~30–60s) on the next hit.
  Also, the round timers live in the server's memory, so if the service restarts **mid-event**
  the event won't advance. For a real event, either keep the service warm (open it shortly
  before and don't let it idle) or use a paid Render instance. For casual testing the free
  tier is fine.
- **Cameras need HTTPS** — that's why we deploy rather than use a plain `http://<LAN-IP>`
  address (those block the camera on other devices).
- **Daily free plan** has monthly minute limits — plenty for testing.

---

## Quick reference — environment variables

**Render (server):**
```
MONGODB_URI=...           DAILY_API_KEY=...
JWT_SECRET=<long-random>  ADMIN_PASSWORD=...
CLIENT_ORIGIN=https://<your-vercel-app>,http://localhost:3000
```

**Vercel (web):**
```
NEXT_PUBLIC_API_URL=https://<your-render-app>.onrender.com
NEXT_PUBLIC_APP_URL=https://<your-vercel-app>.vercel.app
```
