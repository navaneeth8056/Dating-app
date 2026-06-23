# Phase 6 — Post-event matching (your steps)

The final piece: after the event ends, each person picks **Like** or **Pass** on
everyone they met. If **both** like each other, it's a **match** and we reveal each
other's contact details. If even one passes (or hasn't decided), nothing is shared.

No new dependencies — just restart both servers.

---

## Step 1 — Restart

- **Server:** Ctrl+C → `npm run dev` (loads the new selection routes).
- **Web:** Ctrl+C → `npm run dev`.

---

## Step 2 — Run a quick event to the end

1. Create a short **Instant** event (Date 15s / Break 5s), join with **2 males + 2 females**
   on separate browsers/devices, **Start**, and let it run to **"That's a wrap!"**.
   (Use Invite/CSV mode if you want real emails/phones revealed — instant-mode joiners have
   no contact details on file.)

---

## Step 3 — Like / Pass

On each finished screen you'll see **"Choose who you'd like to see again"** with everyone
that person met:

1. Click **Like** or **Pass** on each. Your choice highlights (Liked ✓ / Passed ✓) and is
   saved immediately.
2. Have **two people Like each other**.
3. Click **Refresh matches** (or it updates when you make a choice) — the matched person now
   shows **💚 It's a match!** with their **email / phone**.
4. On a pair where one side **passed**, no contact is ever shown to either side.

> The contact reveal is enforced on the **server** — contact details are only ever sent
> when a mutual match exists, so a passed/declined person can't see them.

---

## Notes

- You can re-open the event link later (same browser) to make or change choices — your
  session token is remembered, and a finished event drops you straight onto this screen.
- Invite/CSV events reveal the **email + phone** from your uploaded roster. Instant events
  have only name + gender, so a match shows "no contact on file" — expected.

---

## 🎉 That's the full MVP

All six build phases are done — the complete loop works:

upload/instant → waiting room → live matched video rounds with timers → leave/rejoin →
finish → like/pass → mutual-match contact reveal.

### What's left (Phase 7 — polish, when you're ready)
- Resume a running event if the server restarts (timers currently live in memory).
- Email notifications ("it's a match", invites).
- Deploy to Vercel + Render with HTTPS (needed for cameras in production).
- Admin auth, rate limits, and general hardening.

Tell me **"Phase 6 works"** and whether you'd like to start **Phase 7 (deploy + polish)**.
