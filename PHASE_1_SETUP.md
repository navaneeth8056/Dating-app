# Phase 1 — Admin, roster upload & join (your steps)

What's new in this phase:
- An **admin dashboard** to create events (Mode A invite/CSV **or** Mode B instant).
- **CSV roster upload** with validation + duplicate skipping.
- A shareable **`/join/<slug>`** link.
- A **join flow**: email cross-check (Mode A) or name + gender (Mode B), issuing a session token.
- Data is now stored in **MongoDB**.

---

## Step 1 — Make sure your Mongo connection is set

Open `server/.env` and confirm `MONGODB_URI=` has your Atlas string (you said you added it ✅).
If your Atlas user/password has special characters, they must be URL-encoded.

> Tip: in Atlas → **Network Access**, make sure your current IP (or `0.0.0.0/0` for testing) is allowed,
> or the server will hang on connect.

---

## Step 2 — Install the new dependencies & restart

The backend gained a few packages (JWT, CSV parsing). In the **server** terminal:

```bash
# Ctrl+C to stop the old server first
cd server
npm install
npm run dev
```

You should see:
```
[mongo] connected
[server] listening on http://localhost:4000
```
If you see `[mongo] connected`, the database is wired. 🎉
(The frontend has no new dependencies — but restart `npm run dev` in the **web** terminal to pick up the new pages.)

---

## Step 3 — Test Mode A (Invite / CSV)

1. Go to <http://localhost:3000/admin> (or click **Go to Admin** on the home page).
2. **Create event:** name it, pick **Invite / CSV**, leave the testing defaults (5 / 120 / 30), click **Create event**.
3. Click **Manage →** on the new event.
4. Under **Upload roster (CSV)**, choose the `sample_participants.csv` file in this project folder.
   - You should see: *Imported 10 · skipped 0 existing · roster now 10*, and the table fills with the 10 people.
   - Try uploading the **same file again** → it should report *skipped 10 existing* (no duplicates).
5. Copy the **Join link** at the top.
6. Open that link in a new tab (or incognito):
   - Enter `aarav.sharma@example.com` (from the sample) → **"You're in, …!"** ✅
   - Try a random email not in the list → you get the **"not on the guest list"** warning. ✅

---

## Step 4 — Test Mode B (Instant meeting)

1. Back in **/admin**, create another event, pick **Instant meeting**, create it.
2. **Manage →**, copy the join link, open it.
3. Enter a **name + gender** → **"You're in!"** ✅
4. Refresh the admin event page → the person now appears in the **Roster** table (source = self-join).

---

## What's working now vs. later

- ✅ Events, both join modes, roster upload, email gate, session token.
- ⏳ The waiting room, live presence, timers, matching, and video come in **Phases 2–5**.
  After joining you currently see a "waiting room opens next phase" confirmation — that's expected.

---

## If something doesn't work

- **Admin page can't load events / "is the server running?"** → the server terminal isn't up, or Mongo didn't connect. Check for `[mongo] connected`.
- **Server logs a Mongo timeout** → fix Atlas Network Access (allow your IP) or the connection string.
- **Upload says "name & email columns"** → make sure the CSV header row is `name,email,gender,age,phone`.

---

## When you're done

Tell me **"Phase 1 works"** (or paste any errors). Then we start:

### ▶️ Phase 2 preview — Waiting room + presence + count-up timer
- After joining, participants land in a **live waiting room** (Socket.IO).
- Admin sees who's present in real time.
- An always-on **count-up timer** starts, and the admin gets a **Start event** button.
