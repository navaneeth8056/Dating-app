# Speed Dating Platform

Online speed dating app — live waiting room, randomized gender/age matching, rotating
video-chat rounds (Daily.co), and post-event mutual matching.

## Repository layout

```
Dating app-Daily/
├── web/        Next.js frontend (participant app + admin dashboard)
├── server/     Express + Socket.IO backend (API + round engine)
├── sample_participants.csv                 Placeholder roster format
├── SpeedDating_Architecture_and_BuildPlan.md   Full architecture + phased plan
└── PHASE_0_SETUP.md                        Step-by-step setup for the current phase
```

## Current status: **Phase 6 — Post-event matching (MVP complete 🎉)**

Full loop works: upload/instant join → waiting room → live matched video rounds with
timers (leave/rejoin) → finish → like/pass → **mutual-match contact reveal** (gated
server-side). Phase 7 (deploy + polish) is optional next.

➡️ **Current steps:** [`PHASE_6_SETUP.md`](./PHASE_6_SETUP.md).
Earlier: [`PHASE_5_SETUP.md`](./PHASE_5_SETUP.md), [`PHASE_4_SETUP.md`](./PHASE_4_SETUP.md),
[`PHASE_3_NOTES.md`](./PHASE_3_NOTES.md), [`PHASE_2_SETUP.md`](./PHASE_2_SETUP.md),
[`PHASE_1_SETUP.md`](./PHASE_1_SETUP.md), [`PHASE_0_SETUP.md`](./PHASE_0_SETUP.md).

## Tech stack

- **Frontend:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend:** Node.js, Express, Socket.IO, Mongoose (TypeScript)
- **Database:** MongoDB Atlas
- **Video:** Daily.co (added in Phase 5)
- **Realtime/timers:** Socket.IO (+ Redis/BullMQ from Phase 4)

See the full plan in `SpeedDating_Architecture_and_BuildPlan.md`.
