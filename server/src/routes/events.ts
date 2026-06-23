import { Router, type Request, type Response, type NextFunction } from "express";
import Papa from "papaparse";
import { Event } from "../models/Event";
import { Participant } from "../models/Participant";
import { Pairing } from "../models/Pairing";
import { makeSlug } from "../lib/slug";
import { env } from "../config/env";

export const eventsRouter = Router();

/**
 * Wraps an async handler so any rejection is forwarded to Express'
 * error middleware (Express 4 does NOT do this automatically — without
 * it a failed DB query leaves the request hanging forever).
 */
const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

/** Delete an event (and its participants + pairings). Password-gated. */
eventsRouter.delete(
  "/:id",
  wrap(async (req, res) => {
    const { password } = req.body ?? {};
    if (password !== env.adminPassword) {
      return res.status(403).json({ error: "wrong_password" });
    }
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: "event not found" });
    await Participant.deleteMany({ eventId: event._id });
    await Pairing.deleteMany({ eventId: event._id });
    await event.deleteOne();
    res.json({ ok: true });
  })
);

/** Create an event (Mode A: invite_csv, or Mode B: instant). */
eventsRouter.post(
  "/",
  wrap(async (req, res) => {
    const { name, mode, config } = req.body ?? {};
    if (!name || !mode) {
      return res.status(400).json({ error: "name and mode are required" });
    }
    if (mode !== "invite_csv" && mode !== "instant") {
      return res.status(400).json({ error: "mode must be invite_csv or instant" });
    }

    const joinPolicy = mode === "invite_csv" ? "roster_email" : "open";
    const matchRule =
      mode === "invite_csv"
        ? "opposite_gender_nearest_age"
        : "opposite_gender_random";

    const event = await Event.create({
      name,
      mode,
      joinPolicy,
      joinSlug: makeSlug(),
      status: "open",
      config: {
        rounds: config?.rounds ?? 5,
        dateDurationSec: config?.dateDurationSec ?? 120,
        breakDurationSec: config?.breakDurationSec ?? 30,
        matchRule,
      },
    });

    res.status(201).json(event);
  })
);

/** List events (admin), newest first. */
eventsRouter.get(
  "/",
  wrap(async (_req, res) => {
    const events = await Event.find().sort({ createdAt: -1 }).lean();
    res.json(events);
  })
);

/** Public event info by slug — used by the join page. */
eventsRouter.get(
  "/slug/:slug",
  wrap(async (req, res) => {
    const event = await Event.findOne({ joinSlug: req.params.slug }).lean();
    if (!event) return res.status(404).json({ error: "event not found" });
    res.json({
      _id: event._id,
      name: event.name,
      mode: event.mode,
      joinPolicy: event.joinPolicy,
      status: event.status,
    });
  })
);

/** Event detail (admin) incl. participant count. */
eventsRouter.get(
  "/:id",
  wrap(async (req, res) => {
    const event = await Event.findById(req.params.id).lean();
    if (!event) return res.status(404).json({ error: "event not found" });
    const count = await Participant.countDocuments({ eventId: event._id });
    res.json({ ...event, participantCount: count });
  })
);

/** Upload roster CSV (Mode A only). Body: { csvText }. */
eventsRouter.post(
  "/:id/participants",
  wrap(async (req, res) => {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: "event not found" });
    if (event.mode !== "invite_csv") {
      return res
        .status(400)
        .json({ error: "roster upload is only for invite_csv events" });
    }

    const csvText: string = req.body?.csvText ?? "";
    if (!csvText.trim()) {
      return res.status(400).json({ error: "csvText is empty" });
    }

    const parsed = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
    });

    const errors: string[] = [];
    const seen = new Set<string>();
    const docs: Array<Record<string, unknown>> = [];

    parsed.data.forEach((row, i) => {
      const line = i + 2; // +1 header, +1 to 1-index
      const name = (row.name ?? "").trim();
      const email = (row.email ?? "").trim().toLowerCase();
      const gender = (row.gender ?? "").trim().toLowerCase();
      const ageRaw = (row.age ?? "").trim();
      const phone = (row.phone ?? "").trim();

      if (!name || !email) {
        errors.push(`Row ${line}: missing name or email — skipped`);
        return;
      }
      if (seen.has(email)) {
        errors.push(`Row ${line}: duplicate email "${email}" in file — skipped`);
        return;
      }
      seen.add(email);

      const ageNum = ageRaw ? Number(ageRaw) : undefined;
      const ageValid = ageNum !== undefined && !Number.isNaN(ageNum);
      if (ageRaw && !ageValid) {
        errors.push(`Row ${line}: age "${ageRaw}" is not a number — left blank`);
      }

      docs.push({
        eventId: event._id,
        name,
        email,
        gender,
        age: ageValid ? ageNum : undefined,
        phone,
        source: "csv",
        authStatus: "invited",
      });
    });

    let inserted = 0;
    let skippedExisting = 0;
    for (const doc of docs) {
      try {
        const r = await Participant.updateOne(
          { eventId: event._id, email: doc.email },
          { $setOnInsert: doc },
          { upsert: true }
        );
        if (r.upsertedCount && r.upsertedCount > 0) inserted += 1;
        else skippedExisting += 1;
      } catch {
        skippedExisting += 1;
      }
    }

    const total = await Participant.countDocuments({ eventId: event._id });
    res.json({
      inserted,
      skippedExisting,
      validRows: docs.length,
      errors,
      totalInRoster: total,
    });
  })
);

/** List roster (admin). */
eventsRouter.get(
  "/:id/participants",
  wrap(async (req, res) => {
    const list = await Participant.find({ eventId: req.params.id })
      .sort({ createdAt: 1 })
      .lean();
    res.json(list);
  })
);
