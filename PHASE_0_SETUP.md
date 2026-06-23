# Phase 0 — Setup guide (your steps)

Goal of this phase: get the frontend and backend running on your machine and confirm
they talk to each other (REST + realtime). No matching, video, or DB logic yet — this
just locks the foundation so every later phase has something solid to build on.

You'll spend ~20–30 minutes, mostly installing things once.

---

## Step 1 — Install the tools (one-time)

1. **Node.js** (v20 LTS or newer). Download from <https://nodejs.org> → install.
   Verify in a terminal:
   ```bash
   node -v      # should print v20.x or higher
   npm -v
   ```
2. **Git** (optional but recommended) from <https://git-scm.com>.
3. A code editor — **VS Code** (<https://code.visualstudio.com>) is ideal.

---

## Step 2 — Create the free accounts you'll need

You don't need all of these today, but set up the first one now:

| Service | Used for | When | Sign up |
|---|---|---|---|
| **MongoDB Atlas** | Database | Phase 0 (optional) / Phase 1 | <https://www.mongodb.com/cloud/atlas/register> |
| **Daily.co** | Video calls | Phase 5 | <https://dashboard.daily.co/signup> |
| **Vercel** | Host frontend | Deploy step | <https://vercel.com/signup> |
| **Render** | Host backend | Deploy step | <https://render.com> |

> For Phase 0 the server runs fine **without** a database — it'll just log a warning.
> So Atlas is optional right now; do it now if you want, or wait until Phase 1.

### (Optional) Get your MongoDB connection string now
1. In Atlas, create a **free M0 cluster**.
2. Create a database user (username + password) and note them.
3. Under **Network Access**, add your IP (or `0.0.0.0/0` for testing).
4. **Connect → Drivers** → copy the connection string. It looks like:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/speeddating?...`

---

## Step 3 — Start the backend (server)

Open a terminal in the project folder:

```bash
cd "server"
copy .env.example .env        # Windows (use: cp .env.example .env on Mac/Linux)
npm install
npm run dev
```

- If you have a Mongo   string, paste it into `server/.env` as `MONGODB_URI=...`. If not, leave it blank — it'll skip the DB for now.
- You should see:
  ```
  [server] listening on http://localhost:4000
  ```
- Test it: open <http://localhost:4000/health> in a browser → you should see a JSON `{ "ok": true, ... }`.

**Leave this terminal running.**

---

## Step 4 — Start the frontend (web)

Open a **second** terminal in the project folder:

```bash
cd "web"
copy .env.local.example .env.local    # Windows (cp on Mac/Linux)
npm install
npm run dev
```

- You should see Next.js start on <http://localhost:3000>.
- Open <http://localhost:3000> in your browser.

---

## Step 5 — Confirm everything is wired ✅

On the page at <http://localhost:3000> you should see a **system check** card with:

- **API (/health):** `OK — speeddating-server (phase 0)`
- **Realtime (Socket.IO):** `OK — echo: "hello from web"`

If both read **OK (green)**, Phase 0 is complete and the foundation works. 🎉

### If something is red
- *API UNREACHABLE* → the server terminal (Step 3) isn't running, or it's on a different port. Make sure it says "listening on http://localhost:4000".
- *Realtime UNREACHABLE* → same cause; restart the server, then refresh the page.
- Port already in use → change `PORT` in `server/.env` and `NEXT_PUBLIC_API_URL` in `web/.env.local` to match.

---

## Step 6 — (Optional) Put it on GitHub

So we can track changes and deploy later:

```bash
cd ".."          # back to the project root
git init
git add .
git commit -m "Phase 0: project foundation"
```
Then create a repo on GitHub and push (GitHub shows the exact commands after you create it).

---

## What to send me once you're done

Just tell me **"Phase 0 works"** (or paste any error you hit). Then we move to:

### ▶️ Phase 1 preview — Admin, roster upload & join
- Admin screen to create an event (Mode A invite/CSV **or** Mode B instant meeting).
- CSV upload → participant roster (using the `sample_participants.csv` format).
- Join flow: email cross-check (Mode A) / name + gender (Mode B).
- The shareable `/join/<event>` link.

I'll build the code; your steps in Phase 1 will be similar (pull changes, `npm install`,
run, and test the screens I describe).
