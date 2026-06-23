# Phase 3 — Matching algorithm (notes)

Phase 3 is **pure backend logic** — the engine that decides who meets whom. It isn't
wired into the live event yet (that's Phase 4), so there's no new screen to click.
It ships fully built and **unit-tested**.

## What it does

`server/src/matching/buildSchedule.ts` takes the list of participants and produces the
full multi-round plan:

- **Opposite-gender only.** Male↔female pairs. Anyone with another gender is benched
  with a warning (relevant to instant mode).
- **Nearest age.** Each round is a minimum-total-age-gap matching (the Hungarian
  algorithm in `hungarian.ts`), with a tiny random tie-break so equally-close matches
  vary — i.e. "randomized, but age-aware". Instant mode uses the random-only variant.
- **No repeats.** Nobody is paired with the same person twice across the rounds.
- **Fair byes.** Uneven or odd counts → the extra people sit out a round; byes rotate.
- **Auto-capped rounds.** With few people it runs fewer than 5 rounds automatically
  (you can't have 5 distinct partners if only 3 are available).

## How it was verified

7 unit tests in `server/src/matching/buildSchedule.test.ts`, all passing:

- equal 6+6 → 5 full rounds, no repeats, every pair male↔female
- uneven 2+4 → capped to 4 rounds, 2 pairs + 2 byes each, each male meets 4 distinct
- tiny 1+1 → exactly 1 round
- nearest-age actually picks the minimal-gap matching
- no male or no female → 0 rounds + warning
- non-binary gender → benched every round + warning
- odd 3+3 → 3 rounds, 9 unique pairs

## Run the tests yourself (optional)

```bash
cd server
npx tsx src/matching/buildSchedule.test.ts
```
You should see all 7 ✓ and "All 7 matching tests passed ✅".

## Small UI change this phase

The participant waiting room now reads **"Waiting for the host to start the meeting…"**
to make the host-gated start explicit. Restart the web dev server to see it.

## Next

### ▶️ Phase 4 — Round engine + synchronized timers
Wire this scheduler into the live event: on **Start**, generate the rounds, then drive
the date → break → next-round state machine with server-synced count-up timers, show
each person their current and next partner, and surface the **host "ongoing / up next"**
view. This is also where the **leave-a-date / escape-to-next-person** behavior lands.
