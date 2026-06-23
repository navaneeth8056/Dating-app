# Phase 5 — Daily.co video (your steps)

What's new: each date is now a **real video call**. When a round starts, the server
creates a private Daily room per pair and gives each participant a scoped token; the call
mounts right on the date screen and tears down at the end of the round (or when you leave).

---

## Step 1 — Confirm your Daily key

In `server/.env` you should have:
```
DAILY_API_KEY=your_key_here
```
(You said it's added. ✅) Get it from <https://dashboard.daily.co> → **Developers → API key** if needed.
If this key is missing, the app still runs — the date screen just shows
"Video unavailable" instead of a call.

---

## Step 2 — Install the new web dependency & restart

The web app gained the Daily SDK. In the **web** terminal:
```bash
# Ctrl+C
npm install
npm run dev
```
Restart the **server** too (Ctrl+C → `npm run dev`) so it picks up the Daily key.

---

## Step 3 — Test the video (needs 2 cameras)

Video calls need camera/mic, so test with **two real participants**:

- Best: **two devices** (your laptop + your phone), each opening the join link, OR
- **two different browsers** on one machine (e.g. Chrome + Edge) so each can hold the
  camera independently. (Two tabs in the *same* browser will fight over the camera.)

Steps:
1. Create a short **Instant** event (Date 30s / Break 5s), 1 male + 1 female so they pair.
2. Open the join link on both devices/browsers, join (one male, one female).
3. On admin, **Start event**.
4. On each side, the date screen shows the partner's name and a **live video call** —
   allow camera/mic when the browser asks.
5. At the end of the round the call closes automatically; next round → new room.
6. Click **Leave this date** → your video drops and you see the rejoin option.

---

## Notes

- Rooms are **private** and **auto-expire** shortly after each round, so nothing piles up
  in your Daily account.
- The free Daily plan is fine for testing (it has monthly minute limits — plenty here).
- Camera works on `localhost` (a secure context). When you deploy, use HTTPS or cameras
  will be blocked by the browser.

---

## If something's off

- **"Video unavailable — Daily API key not set"** → the server didn't get `DAILY_API_KEY`;
  check `server/.env` and restart the server. Watch the server log for `[daily]` errors.
- **"Connecting video…" stuck** → check the browser console (F12) and that you allowed
  camera/mic. A wrong/expired Daily key will log a `[daily] token`/`room` error server-side.
- **Black tile** → camera permission was denied; reset site permissions and rejoin.

---

## When you're done

Tell me **"Phase 5 works"**. Last build phase next:

### ▶️ Phase 6 — Post-event matching
After the event, each person picks **like / pass** on everyone they met; on a **mutual
like** we reveal each other's contact info (phone/email) — and only then. One pass = nothing
shared.
