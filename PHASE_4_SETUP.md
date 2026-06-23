# Phase 4 — Live round engine & timers (your steps)

What's new — the event actually *runs* now:
- On **Start**, the server builds the schedule (Phase 3 matcher) and begins **round 1**.
- It drives the cycle automatically: **date → break → next round → … → finished**,
  with server-synced count-up timers on every screen.
- Each participant sees **who they're talking to now** and **who's up next**.
- **Leave this date** (escape hatch): leave the current date early; you sit out the rest
  of that round and rejoin next round. Your partner is told you left.
- **Admin** sees live **Ongoing** pairs (and **Up next** during breaks), the round number,
  and who's sitting out.
- **Reconnect** drops you back into your current date, not the lobby.

No new dependencies. Just restart both servers.

---

## Step 1 — Restart

**Server:** Ctrl+C → `npm run dev` (wait for `[mongo] connected`).
**Web:** Ctrl+C → `npm run dev`.

> The round timers live in the server's memory, so **don't edit server files during a
> live test** — a reload (tsx watch) resets the running event. (We add resume-on-restart
> in Phase 7.)

---

## Step 2 — Make a fast test event

A real event with testing defaults (120s date / 30s break) takes ~12 min for 5 rounds.
For quick testing, create an event with **short durations**:

1. http://localhost:3000/admin → **Create event**.
2. Pick **Instant meeting** (easiest — join with just name + gender).
3. Set **Date (sec) = 15**, **Break (sec) = 5**, Rounds = 5. Create.

> Matching is opposite-gender. In instant mode there's no age, so it's opposite-gender
> random — make sure you join some as **male** and some as **female**, or no pairs form.

---

## Step 3 — Join as several people

1. **Manage** the event, copy the **Join link**.
2. Open it in **4 tabs** (incognito/different browsers so each is its own session).
   Join 2 as **male**, 2 as **female**, different names.
3. All 4 land in the waiting room; the admin **Live control** shows them present.

---

## Step 4 — Start and watch the rounds

1. On admin, click **Start event**.
2. Each participant tab flips to **"Round 1 of N — on a date"** showing their partner's
   name, a count-up timer, and **Up next: <name>**.
3. After 15s → **Break** (5s) showing the next partner → then **Round 2**, and so on.
4. The **admin** panel shows the live **Ongoing** pairs each round (and **Up next**
   during the break), plus anyone **sitting out**.
5. After the last round → every tab shows **"That's a wrap! 🎉"**.

With 2+2 you'll get 2 rounds (each person meets 2 distinct people). Add more people for
more rounds.

---

## Step 5 — Test the escape hatch & reconnect

- In a date, click **Leave this date** in one tab → that tab shows "You left this date";
  the partner's tab shows they're now alone; admin marks the pair "(someone left)".
  Both move on together at the next round.
- **Refresh** a tab mid-date → it reconnects straight back into the current date.

---

## What's working vs. later

- ✅ Full live event loop: matching → timed rounds → breaks → finish, with the host
  control board, leave-date, leave-event, and reconnect.
- ⏳ **Video** (Daily.co) replaces the "video appears here" placeholder in **Phase 5**.
- ⏳ **Like/reject + mutual match reveal** is **Phase 6**.

---

## If something's off

- **"Not enough people to start"** → you need at least one male and one female present.
- **Timer not advancing** → you edited a server file mid-event (reset); restart and retry.
- **Someone shows no partner** → they're a bye that round (uneven male/female count). Even
  it out for full pairing.

---

## When you're done

Tell me **"Phase 4 works"** (or paste any issue). Next:

### ▶️ Phase 5 — Daily.co video
Each pair gets a real video room created on the fly; the call mounts on the date screen
and tears down at round end. You'll need a free Daily.co API key (I'll walk you through it).
