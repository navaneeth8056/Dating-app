# Online Speed Dating Platform — Architecture & Build Plan

**Project:** Dating app (Daily.co + MongoDB)
**Prepared for:** Krishna (dVerse Labs)
**Date:** 23 June 2026
**Reference analyzed:** DateNight AI × PETA (`datenight.ai/peta`)

---

## 1. How the reference (DateNight AI) works

From analyzing the PETA landing page and FAQ, DateNight's model is:

1. **Register & pay** — user fills a questionnaire (age, location, preferences) and pays via Stripe (~$25).
2. **Pre-computed matches** — a couple of hours *before* the event, an algorithm pairs each person with up to 7 compatible singles. Matches are emailed in advance.
3. **The event** — at a fixed start time, everyone joins a link. They do **7-minute** one-on-one video chats, one per match, for ~1 hour. Filters out anyone you've met in past events (by email).
4. **Post-event** — a feedback form (also available *during* the event) lets you mark who you'd see again. **Mutual** interest → they introduce you.

**Key takeaway:** DateNight pre-computes the entire schedule offline and just plays it back. It is *not* doing live, in-room matching.

### Where your model differs (and is harder)

| Aspect | DateNight | **Your app** |
|---|---|---|
| Registration | Self-serve + payment | **Admin bulk-uploads** participants (name, email, gender, age…) from other sources |
| Matching timing | Hours before, offline | **Live**, after everyone joins a waiting room |
| Pairing logic | Compatibility questionnaire | **Opposite gender + nearest age**, randomized |
| Rounds | 7 × 7 min | **5 × 10 min + 2 min breaks** (testing: 2 min + 30 sec) |
| Schedule | Fixed, emailed | **Computed at runtime**, "next date" shown on screen |
| Timers | Implicit | **Always-on count-up timers**, including the waiting room |
| Post-event | Feedback form → mutual intro | Same: **mutual like → reveal phone/email**; one reject → nothing shared |

Your app is essentially a **real-time event orchestration engine** on top of video chat. The waiting room + live matching + synchronized round timers are the core technical challenge — that's where most of the engineering goes.

---

## 2. Recommended tech stack

You've already chosen **Daily.co** (video) and **MongoDB** (database), and **Next.js + React** (frontend), with **login by registered email**. Here is the full stack around that:

### Frontend
- **Next.js 14 (App Router) + React + TypeScript** — one codebase for participant app + admin dashboard.
- **Tailwind CSS + shadcn/ui** — fast, clean UI for waiting room, video stage, timers, selection screen.
- **@daily-co/daily-react + @daily-co/daily-js** — official React hooks for the video calls.
- **Socket.IO client** — receives real-time events (round start, your next match, timer sync, break countdown).
- **Zustand** (or React Context) — lightweight client state for the event session.

### Backend
- **Node.js + Express (or NestJS) + TypeScript** — REST API + the round-orchestration engine. *(Kept as a separate long-running service, not Next.js serverless routes, because the event engine needs persistent in-memory state and timers — see §6.)*
- **Socket.IO server** — pushes synchronized event state to all participants.
- **BullMQ + Redis** — timed jobs (end round, start break, advance round) and pub/sub so the engine scales beyond one server instance.
- **Mongoose** — MongoDB ODM / schema layer.
- **Daily.co REST API** — programmatically create per-pair video rooms + short-lived meeting tokens.

### Data & infra
- **MongoDB Atlas** — managed Mongo (free M0 tier to start).
- **Redis (Upstash or Render Redis)** — BullMQ queue + Socket.IO adapter + ephemeral round state.
- **Resend** (or AWS SES / Postmark) — transactional email: invites, magic links, "it's a match" notifications.
- **CSV/XLSX parsing**: `papaparse` / `xlsx` for admin uploads.

### Auth — simple email cross-check (per your update)
We only need **name + email**. No OTP, no password.
- Admin uploads the participant list CSV (the roster) before the event.
- Participant opens the event link and enters their **email** (and name).
- Backend checks the email against that event's roster:
  - **Match** → they're let into the waiting room (a JWT session is issued for that event).
  - **No match** → they get a warning: *"This email isn't on the guest list — please log in with your registered email."*
- This keeps entry friction near zero while still gating the room to invited people. (If you later want stronger protection against someone guessing another person's email, we can add an optional OTP step — but it's not required for the MVP.)

### Recommended hosting
- **Frontend (Next.js):** Vercel.
- **Backend engine + Socket.IO:** Render or Railway (a persistent container — *not* serverless, because of in-memory timers and websockets).
- **DB:** MongoDB Atlas. **Redis:** Upstash. **Email:** Resend. **Video:** Daily.co.
- All have generous free tiers — you can run the full MVP at $0–$20/month until you scale.

---

## 3. System architecture (high level)

```
┌─────────────────┐         ┌──────────────────────────┐
│  Admin (browser)│  HTTPS  │   Next.js app (Vercel)    │
│  upload CSV     ├────────▶│  - Admin dashboard         │
└─────────────────┘         │  - Participant app         │
                            └───────────┬────────────────┘
┌─────────────────┐  WebSocket (Socket.IO) │  REST
│ Participant     │◀───────────────────────┤
│ (browser)       │         ┌──────────────▼────────────┐
│ - waiting room  │         │  Node backend (Render)     │
│ - video stage   │  REST   │  - Auth / OTP              │
│ - timers        ├────────▶│  - Event & roster API      │
│ - selection     │         │  - ROUND ENGINE (state mc) │
└────────┬────────┘         │  - Socket.IO server        │
         │                  └───┬──────────┬─────────┬───┘
         │ video                │          │         │
         ▼                      ▼          ▼         ▼
   ┌───────────┐         ┌──────────┐ ┌────────┐ ┌────────┐
   │ Daily.co  │         │ MongoDB  │ │ Redis  │ │ Resend │
   │ rooms     │         │ Atlas    │ │ +Bull  │ │ email  │
   └───────────┘         └──────────┘ └────────┘ └────────┘
```

The **Round Engine** is the heart of the system: it owns each event's live state machine and emits Socket.IO events that every participant's screen reacts to.

---

## 3b. Two ways to run an event (event modes)

The platform supports **two creation modes**, chosen when an event is made. Both feed into the *same* waiting room → matching → rounds → selection engine; they only differ in how people get in and what data we collect.

### Mode A — Invite / CSV link (pre-registered, roster-gated)
1. Admin uploads the participant CSV (`name, email, gender, age, …`).
2. System generates a **shareable event link** (and optionally a unique per-person link). Admin sends it through any channel — email, WhatsApp, SMS, etc.
3. Participant opens the link, enters their **email** → cross-checked against the roster (see Auth). Match → in; no match → warning.
4. Because gender + age came from the CSV, matching uses the full **opposite-gender + nearest-age** rule.

*Best for:* organized events where you already have a guest list.

### Mode B — Instant meeting (Google-Meet style, open join)
1. Admin clicks **"Create instant meeting"** → a room + link is generated immediately, no upload.
2. Admin shares the link; **anyone with it joins by entering name + gender** (no age in instant mode — per current decision).
3. As people land in the waiting room, the live roster builds itself. When the admin hits **Start** (or quorum is reached), matching runs on whoever's present and the event begins.

*Best for:* spontaneous sessions, demos, or testing — spin up and share in seconds.

*Matching in Mode B:* since age isn't collected, matching is **opposite-gender randomized** (the nearest-age weighting applies only to Mode A, where age comes from the CSV).

**Shared link mechanics:** every event gets a unique `eventId` and a slug URL like `app.yourdomain.com/join/<eventId>`. In Mode A the link resolves to the email-gate; in Mode B it resolves to the name+gender(+age) form. The same engine runs underneath, so we build it once.

> **Note on Mode B matching:** the nearest-age rule needs `age`. If you'd rather keep instant-join to just name + gender, the matcher automatically degrades to *opposite-gender randomized* (no age weighting). I've assumed we collect age in Mode B too — easy to drop if you prefer.

---

## 4. Data model (MongoDB collections)

```
Event
  _id
  name, status: draft|open|waiting|running|completed
  mode: "invite_csv" | "instant"          // Mode A or Mode B
  joinPolicy: "roster_email" | "open"      // gate by roster vs open name+gender
  joinSlug                                 // public URL: /join/<slug>
  config: {
    rounds: 5,
    dateDurationSec: 600,      // 10 min (testing: 120)
    breakDurationSec: 120,     // 2 min (testing: 30)
    matchRule: "opposite_gender_nearest_age",
    ageWeight, randomness
  }
  currentRound: 0
  phase: idle|waiting|in_date|in_break|finished
  phaseEndsAt: ISODate          // for timers
  createdBy, createdAt

Participant            // one row per uploaded person, scoped to an event
  _id
  eventId
  name, email (unique per event), gender, age
  phone, extraFields {}
  authStatus: invited|verified
  presence: offline|in_waiting_room|in_date|disconnected
  socketId, dailyUserId
  joinedAt

Pairing                // every 1:1 date that happens
  _id
  eventId, round
  participantA, participantB     // or "bye" if odd count
  dailyRoomName, dailyRoomUrl
  startedAt, endedAt

Selection              // post-event (and during) like/reject
  _id
  eventId
  fromParticipant, toParticipant
  decision: like|reject|pending
  createdAt

Match                  // computed when BOTH sides like
  _id
  eventId
  participantA, participantB
  revealedContact: { aToB:{phone,email}, bToA:{phone,email} }
  createdAt
```

Indexes: `Participant {eventId, email}` unique; `Selection {eventId, fromParticipant, toParticipant}` unique; `Pairing {eventId, round}`.

---

## 5. The matching algorithm (gender + nearest age)

**Constraint per your spec:** match opposite genders, keep the age gap as small as possible, randomized among equally-good candidates, no repeat pairings across the 5 rounds, and scale rounds down if there are too few people.

Approach: build the full 5-round schedule incrementally — **round by round** — once the waiting room closes (or re-balance live as people join). Each round is a *bipartite matching* (men ↔ women) that:
- never repeats a pair already used in earlier rounds,
- minimizes total age difference,
- breaks ties randomly so it doesn't feel deterministic.

### Algorithm (per round)

```
function buildRound(maleList, femaleList, alreadyPaired):
    # Candidate edges = every valid opposite-gender pair NOT used before
    edges = []
    for m in maleList:
        for f in femaleList:
            if (m,f) not in alreadyPaired:
                cost = abs(m.age - f.age) + smallRandomJitter()   # jitter breaks ties
                edges.push({m, f, cost})

    # Minimum-cost bipartite matching (Hungarian algo) on `cost`
    pairs = hungarianMatch(maleList, femaleList, edges)   # minimizes total age gap

    # Unmatched (odd counts / uneven gender split) get a "bye" this round
    leftover = everyone not in pairs
    return pairs, leftover
```

- **Why Hungarian / min-cost matching:** it provably minimizes the *total* age difference across the whole round, which is better than greedy nearest-neighbor (greedy can strand someone with a huge gap).
- **Randomization:** the `smallRandomJitter()` added to each cost means that when several candidates are equally close in age, the chosen partner varies between runs — satisfying "randomized."
- **No repeats:** we pass `alreadyPaired` (all pairs from prior rounds) and exclude those edges, so across 5 rounds each person meets 5 *different* people.
- **Uneven numbers:** if genders are unequal, the extra people on the larger side rotate through **byes** (a 2-min solo wait, or we seat them out) — spread so the same person isn't benched twice before others are benched once.

### Scaling down rounds (few people)

```
maxRounds = min(config.rounds, min(#maleList, #femaleList))
```
If 4 men + 3 women show up, you can run at most 3 rounds (the limiting side). The engine caps rounds automatically and tells participants "3 dates tonight" instead of 5.

### Two scheduling options
1. **Pre-compute all rounds when the room closes** (simplest, recommended for MVP): freeze the roster, generate rounds 1–5 up front, then just play them back. Late joiners wait for the next event.
2. **Live re-balancing** (phase 2): regenerate the *remaining* rounds whenever someone joins/drops. More robust but more complex. Build option 1 first.

---

## 6. Round engine — the real-time state machine

Each running event is a state machine. Timers always count **up** on screen (per your spec) but the engine internally knows when each phase **ends**.

```
        ┌────────────┐  admin "open"   ┌─────────────┐
        │   IDLE     ├────────────────▶│  WAITING    │  (count-up timer in room)
        └────────────┘                 └──────┬──────┘
                                  admin "start" / quorum
                                              ▼
                            ┌───────────────────────────────┐
                            │  IN_DATE  (round N)            │◀────┐
                            │  - create Daily rooms          │     │
                            │  - push each person their pair │     │
                            │  - count-up timer (10:00)      │     │
                            └───────────────┬────────────────┘     │
                                 dateDuration elapsed               │
                                            ▼                        │
                            ┌───────────────────────────────┐       │
                            │  IN_BREAK (2:00 count-up)      │       │
                            │  - show "next match" preview   │       │
                            └───────────────┬────────────────┘       │
                          break elapsed & round < maxRounds ─────────┘
                                            │
                                  round == maxRounds
                                            ▼
                            ┌───────────────────────────────┐
                            │  FINISHED → selection screen   │
                            └───────────────────────────────┘
```

**How timing stays in sync across all browsers:**
- Engine stores `phaseEndsAt` (a server timestamp) and broadcasts it via Socket.IO.
- Each client computes the displayed count-up locally from a server-synced clock, so everyone's timer matches even with network jitter.
- BullMQ schedules the authoritative "advance phase" job at `phaseEndsAt`; when it fires, the engine transitions and broadcasts the next state + each person's new pairing.
- The **"who you'll talk to next"** panel (side/bottom of screen per your spec) is just the next round's pairing for that participant, sent during the break.

**Per-pair video rooms:** at the start of each round the engine calls Daily's REST API to create a room per pairing and issues each participant a short-lived meeting token, then sends `{roomUrl, token}` over the socket. The client mounts the Daily call. At round end, clients leave and rooms are torn down (or auto-expire).

---

## 7. Post-event mutual matching & contact reveal

1. After `FINISHED`, each participant sees a **list of everyone they dated** (5 cards).
2. For each, they choose **Like** or **Reject** → stored in `Selection`. (Per the reference, this can also be filled *during* the event.)
3. When both directions are `like`, the engine creates a `Match` and reveals **each other's phone + email** to both — via the app and an "It's a match!" email.
4. If **either** side rejects (or never responds), **no contact info is shared** to anyone. This is enforced server-side: contact fields are never sent to the client unless a `Match` exists.

---

## 8. Admin workflow (both modes)

Admin logs into the dashboard and picks a mode:

**Mode A — Invite / CSV:**
1. Create an **Event** (name, round count, date/break durations — defaults set to testing values **2 min / 30 sec**).
2. Upload a **CSV/XLSX** of participants. Expected columns: `name, email, gender, age, phone` (+ any extra). We validate, dedupe by email, flag bad rows. *(A sample CSV is included in this folder — `sample_participants.csv` — as a placeholder until you share your real export format.)*
3. System creates `Participant` records and generates the **join link** to share through any channel.
4. Participants enter via the email cross-check gate.

**Mode B — Instant meeting:**
1. Click **Create instant meeting** → link generated immediately, no upload.
2. Share the link; participants self-register with name + gender (+ optional age) on join.

**Both modes then converge:**
5. Admin opens the **waiting room**; a live roster shows who's joined (presence). Admin clicks **Start** (or it auto-starts at quorum) → engine builds rounds and begins.
6. Admin dashboard shows live event state, current round, and post-event match stats.

---

## 9. Configuration (timers)

Stored per-event so you can change them at deployment without code changes:

```js
// TESTING (now)
{ rounds: 5, dateDurationSec: 120, breakDurationSec: 30 }

// PRODUCTION (later — just edit the event config)
{ rounds: 5, dateDurationSec: 600, breakDurationSec: 120 }
```

---

## 10. Edge cases we'll handle

- **Odd / uneven gender counts** → byes rotated fairly.
- **Fewer people than rounds** → rounds auto-capped.
- **Someone disconnects mid-date** → partner sees "waiting for them to reconnect"; if they don't return, that date just ends at the timer.
- **Late joiner** → enters waiting room; for MVP they wait for the next event (live re-balancing is phase 2).
- **Refresh during a date** → session (JWT) + current phase from server restores them into the right room.
- **No-repeat guarantee** → enforced by the `alreadyPaired` exclusion set.
- **Contact privacy** → contact info gated entirely server-side behind a mutual `Match`.

---

## 11. Step-by-step build plan (phased)

We'll build in vertical slices so there's something runnable at each phase.

### Phase 0 — Foundations (scaffolding)
- Init Next.js + TS, Express backend, MongoDB Atlas, Redis, shared types.
- Deploy a "hello world" of both to Vercel + Render to lock the pipeline.

### Phase 1 — Admin + roster + join (both modes)
- Admin: create event (Mode A or B), upload CSV → `Participant` records, validation UI.
- **Mode A** join gate: enter email → cross-check against roster → JWT session (or warning).
- **Mode B** instant meeting: generate link, open join form (name + gender + optional age) → JWT session.
- Shareable `/join/<slug>` links for both.
- **Outcome:** an admin can set up either event type and a person can get into the waiting room.

### Phase 2 — Waiting room + presence + count-up timer
- Socket.IO wiring; participants join a waiting room; live presence list for admin.
- Always-on count-up timer in the room.
- **Outcome:** people gather in a synchronized waiting room.

### Phase 3 — Matching algorithm (offline-testable)
- Implement the gender + nearest-age min-cost matcher with no-repeat + bye handling.
- Unit tests with synthetic rosters (even, odd, uneven gender, tiny groups).
- **Outcome:** given a roster, we generate a valid 5-round schedule. *(Verifiable in isolation.)*

### Phase 4 — Round engine + synchronized timers
- State machine (waiting → date → break → … → finished), BullMQ timed transitions, server-clock-synced count-up timers, "next match" preview panel.
- **Outcome:** a full event runs end-to-end *without video* (mock cards).

### Phase 5 — Daily.co video integration
- Per-pair room + token creation, mount Daily call on the video stage, teardown on round end.
- **Outcome:** real 1:1 video dates that rotate every round.

### Phase 6 — Post-event selection + mutual match + reveal
- Selection screen, `Selection`/`Match` logic, server-gated contact reveal, "it's a match" email.
- **Outcome:** the complete loop from upload → dates → matches.

### Phase 7 — Polish & hardening
- Reconnect handling, admin live controls, error states, basic analytics, load test with simulated participants, deploy production config (10 min / 2 min).

---

## 12. What I need from you to start Phase 0/1

1. ~~Sample CSV~~ — done. `sample_participants.csv` is in this folder as a placeholder; swap in your real export when you have it and we'll adjust the parser.
2. Your **Daily.co API key** and **MongoDB Atlas** connection (or I'll guide you to create them).
3. ~~Mode B age question~~ — decided: **no age** in instant mode (matching = opposite-gender random).
4. Any **branding** (logo/colors) for the participant + admin UI.

Once you confirm, we start at **Phase 0** and build each phase to a working, reviewable state before moving on.
