# Phase 2 — Waiting room, presence & timers (your steps)

What's new:
- After joining, participants land in a **live waiting room** (`/event/<slug>`).
- An always-on **count-up timer** (synced to the server clock).
- **Live presence** — everyone sees who's in the room; it updates in real time.
- A **Leave** button for participants.
- **Reconnect** — refresh or drop and you come right back to the waiting room.
- Admin gets a **Live control** panel (who's present) and a **Start event** button.
- "Ongoing / Up next" is a placeholder until the round engine (Phase 4).

No new dependencies this phase — just restart both apps.

---

## Step 1 — Restart both servers

**Server terminal:**
```bash
# Ctrl+C, then
npm run dev
```
Look for `[mongo] connected` and `[server] listening`.

**Web terminal:**
```bash
# Ctrl+C, then
npm run dev
```
(If anything looks cached/odd, delete `.next` first: `Remove-Item -Recurse -Force .next`.)

---

## Step 2 — Test the waiting room (multi-tab)

You'll simulate several people using multiple browser tabs/windows.

1. Open the **admin** page http://localhost:3000/admin and **Manage** your event (or create a fresh **Instant** event — easiest for testing, since anyone can join with name + gender).
2. Copy the **Join link**.
3. Open it in **2–3 separate tabs** (use an incognito window or a different browser for each so they get separate sessions). Join with different names/genders.
4. In each participant tab you should see:
   - the **count-up timer** ticking,
   - a live **"In the room now"** list that grows as each tab joins.
5. On the **admin** page, the **Live control** panel shows the same people appearing in real time, with a green dot = in waiting room.

---

## Step 3 — Test reconnect

1. In one participant tab, **refresh** the page (F5).
2. It should drop and **return to the waiting room automatically** (no re-login), and the timer keeps going.
3. Watch the admin panel: that person may flash to an amber dot (disconnected) for a moment, then back to green.

---

## Step 4 — Test Leave

1. In one participant tab, click **Leave**.
2. That tab returns to the join screen, and the person **disappears** from everyone else's list and from the admin panel.

---

## Step 5 — Test Start event

1. With at least **2 people present**, click **Start event** on the admin page.
2. All participant tabs flip to **"The event has started! 🎉"**.
3. (For now that's a placeholder screen — the actual rounds, pairing, and video arrive in Phases 3–5.)

---

## What's working vs. later

- ✅ Live waiting room, presence, synced count-up timer, leave, reconnect, admin Start.
- ⏳ The **escape-to-next-person** behavior during a date, and the **"ongoing / up next"** host pairing view, depend on the round engine and arrive in **Phase 4**. I've reserved their spots in the UI.

---

## If something's off

- **Participant list not updating** → both servers running? Check the browser console (F12) for socket errors and the server terminal for `[socket]` logs.
- **Timer stuck at 0:00** → the waiting clock starts when the first person joins; make sure at least one participant has joined.
- **"Session expired" on the waiting page** → the saved token is stale; click "Back to join" and rejoin.

---

## When you're done

Tell me **"Phase 2 works"** (or paste any issue). Next:

### ▶️ Phase 3 preview — Matching algorithm
Opposite-gender + nearest-age pairing (random tie-breaks), no repeats across the 5 rounds, fair byes for odd/uneven counts, auto-capped rounds for small groups — built and unit-tested in isolation before we wire it into the live engine in Phase 4.
