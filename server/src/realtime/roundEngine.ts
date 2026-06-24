import type { Server as SocketServer } from "socket.io";
import { Event } from "../models/Event";
import { Participant } from "../models/Participant";
import { Pairing } from "../models/Pairing";
import { buildSchedule } from "../matching/buildSchedule";
import {
  createRoom,
  createMeetingToken,
  dailyEnabled,
} from "../lib/daily";

const eventRoom = (id: string) => `event:${id}`;
const adminRoom = (id: string) => `admin:${id}`;

// In-memory phase timers, keyed by eventId. (Lost on server restart — fine for
// dev; a resume-on-boot pass can be added in Phase 7.)
const timers = new Map<string, NodeJS.Timeout>();

function clearEventTimer(eventId: string) {
  const t = timers.get(eventId);
  if (t) {
    clearTimeout(t);
    timers.delete(eventId);
  }
}

/** Build the per-round payload every screen reacts to. */
export async function broadcastRoundState(io: SocketServer, eventId: string) {
  const event = await Event.findById(eventId).lean();
  if (!event) return;

  const parts = await Participant.find({ eventId }).lean();
  const nameById = new Map(parts.map((p) => [String(p._id), p.name]));

  const round = event.currentRound;
  const allPairsDocs = await Pairing.find({ eventId }).sort({ round: 1 }).lean();
  const curPairs = allPairsDocs.filter((p) => p.round === round);
  const nextPairs = allPairsDocs.filter((p) => p.round === round + 1);

  const present = parts.filter(
    (p) => p.presence === "in_date" || p.presence === "in_waiting_room"
  );
  const pairedIds = new Set(curPairs.flatMap((p) => [p.aId, p.bId]));
  const byes = present
    .filter((p) => !pairedIds.has(String(p._id)))
    .map((p) => ({ id: String(p._id), name: p.name }));

  const payload = {
    event: {
      id: String(event._id),
      name: event.name,
      phase: event.phase,
      status: event.status,
      currentRound: event.currentRound,
      maxRounds: event.maxRounds,
      phaseStartedAt: event.phaseStartedAt
        ? new Date(event.phaseStartedAt).getTime()
        : null,
      phaseEndsAt: event.phaseEndsAt
        ? new Date(event.phaseEndsAt).getTime()
        : null,
      serverNow: Date.now(),
    },
    pairs: curPairs.map((p) => ({
      aId: p.aId,
      aName: nameById.get(p.aId) ?? "?",
      bId: p.bId,
      bName: nameById.get(p.bId) ?? "?",
      status: p.status,
      leftBy: p.leftBy ?? [],
      hasRoom: Boolean(p.roomName),
    })),
    nextPairs: nextPairs.map((p) => ({
      aId: p.aId,
      aName: nameById.get(p.aId) ?? "?",
      bId: p.bId,
      bName: nameById.get(p.bId) ?? "?",
    })),
    // Every round's pairs — lets each screen build a per-person dates log.
    allPairs: allPairsDocs.map((p) => ({
      round: p.round,
      aId: p.aId,
      aName: nameById.get(p.aId) ?? "?",
      bId: p.bId,
      bName: nameById.get(p.bId) ?? "?",
      status: p.status,
    })),
    byes,
  };

  io.to(eventRoom(eventId)).emit("round:state", payload);
  io.to(adminRoom(eventId)).emit("round:state", payload);
}

/** Host starts the event: build + persist the schedule, begin round 1. */
export async function startEvent(io: SocketServer, eventId: string) {
  const event = await Event.findById(eventId);
  if (!event) return;
  if (event.status === "running") return; // already live; a finished event may be re-run

  const present = await Participant.find({
    eventId,
    presence: { $in: ["in_waiting_room", "in_date"] },
  }).lean();

  const people = present.map((p) => ({
    id: String(p._id),
    gender: p.gender ?? "",
    age: p.age ?? undefined,
  }));

  const schedule = buildSchedule(people, {
    rounds: event.config?.rounds ?? 5,
    matchRule:
      (event.config?.matchRule as
        | "opposite_gender_nearest_age"
        | "opposite_gender_random") ?? "opposite_gender_nearest_age",
  });

  if (schedule.maxRounds === 0) {
    io.to(eventRoom(eventId)).emit("event:error", {
      message:
        schedule.warnings.join(" ") || "Not enough people to start the event.",
    });
    io.to(adminRoom(eventId)).emit("event:error", {
      message: schedule.warnings.join(" ") || "Not enough people to start.",
    });
    return;
  }

  await Pairing.deleteMany({ eventId });
  const docs = schedule.rounds.flatMap((r) =>
    r.pairs.map((pr) => ({
      eventId: event._id,
      round: r.round,
      aId: pr.aId,
      bId: pr.bId,
      status: "active" as const,
    }))
  );
  if (docs.length) await Pairing.insertMany(docs);

  await Participant.updateMany(
    { _id: { $in: present.map((p) => p._id) } },
    { presence: "in_date" }
  );

  event.maxRounds = schedule.maxRounds;
  event.currentRound = 1;
  event.status = "running";
  await event.save();

  await enterDatePhase(io, String(event._id));
}

async function enterDatePhase(io: SocketServer, eventId: string) {
  const event = await Event.findById(eventId);
  if (!event) return;
  const durSec = event.config?.dateDurationSec ?? 120;
  const durMs = durSec * 1000;
  event.phase = "in_date";
  event.phaseStartedAt = new Date();
  event.phaseEndsAt = new Date(Date.now() + durMs);
  await event.save();

  // Provision a Daily room per pair for this round (auto-expires).
  if (dailyEnabled()) {
    const exp = Math.floor(Date.now() / 1000) + durSec + 120;
    const pairs = await Pairing.find({ eventId, round: event.currentRound });
    await Promise.all(
      pairs.map(async (p) => {
        try {
          const room = await createRoom(exp);
          p.roomName = room.name;
          p.roomUrl = room.url;
          await p.save();
        } catch (e) {
          console.error("[daily] room create failed:", e);
        }
      })
    );
  }

  await broadcastRoundState(io, eventId);
  scheduleTransition(io, eventId, durMs);
}

async function enterBreakPhase(io: SocketServer, eventId: string) {
  const event = await Event.findById(eventId);
  if (!event) return;
  const durMs = (event.config?.breakDurationSec ?? 30) * 1000;
  event.phase = "in_break";
  event.phaseStartedAt = new Date();
  event.phaseEndsAt = new Date(Date.now() + durMs);
  await event.save();
  await broadcastRoundState(io, eventId);
  scheduleTransition(io, eventId, durMs);
}

async function finishEvent(io: SocketServer, eventId: string) {
  const event = await Event.findById(eventId);
  if (!event) return;
  event.phase = "finished";
  event.status = "completed";
  event.phaseStartedAt = new Date();
  event.phaseEndsAt = null;
  await event.save();
  clearEventTimer(eventId);
  await broadcastRoundState(io, eventId);
  io.to(eventRoom(eventId)).emit("event:finished", { eventId });
}

function scheduleTransition(io: SocketServer, eventId: string, ms: number) {
  clearEventTimer(eventId);
  timers.set(
    eventId,
    setTimeout(() => {
      advancePhase(io, eventId).catch((e) =>
        console.error("[engine] advance error", e)
      );
    }, ms)
  );
}

async function advancePhase(io: SocketServer, eventId: string) {
  const event = await Event.findById(eventId);
  if (!event) return;
  if (event.phase === "in_date") {
    // After the LAST date, go straight to the feedback screen — no trailing break.
    if ((event.currentRound ?? 0) < (event.maxRounds ?? 0)) {
      await enterBreakPhase(io, eventId);
    } else {
      await finishEvent(io, eventId);
    }
  } else if (event.phase === "in_break") {
    event.currentRound = (event.currentRound ?? 0) + 1;
    await event.save();
    await enterDatePhase(io, eventId);
  }
}

/** Escape hatch: a participant leaves their current date early. */
export async function leaveDate(
  io: SocketServer,
  eventId: string,
  participantId: string
) {
  const event = await Event.findById(eventId).lean();
  if (!event || event.phase !== "in_date") return;
  await Pairing.updateOne(
    {
      eventId,
      round: event.currentRound,
      $or: [{ aId: participantId }, { bId: participantId }],
    },
    { $addToSet: { leftBy: participantId }, $set: { status: "left" } }
  );
  await broadcastRoundState(io, eventId);
}

/**
 * Issues a Daily meeting token for the requester's current, active pairing.
 * Returns null if there's no room (Daily off, or they left the date).
 */
export async function issueDateToken(
  eventId: string,
  participantId: string
): Promise<{ roomUrl: string; token: string } | null> {
  const event = await Event.findById(eventId).lean();
  if (!event || event.phase !== "in_date") return null;
  const pairing = await Pairing.findOne({
    eventId,
    round: event.currentRound,
    $or: [{ aId: participantId }, { bId: participantId }],
  }).lean();
  if (!pairing || !pairing.roomName || !pairing.roomUrl) return null;
  // The person who left this date doesn't get a video token; their partner stays.
  if ((pairing.leftBy ?? []).includes(participantId)) return null;

  const participant = await Participant.findById(participantId).lean();
  const exp =
    Math.floor(Date.now() / 1000) +
    (event.config?.dateDurationSec ?? 120) +
    120;
  try {
    const token = await createMeetingToken(
      pairing.roomName,
      participant?.name ?? "Guest",
      exp
    );
    return { roomUrl: pairing.roomUrl, token };
  } catch (e) {
    console.error("[daily] token failed:", e);
    return null;
  }
}

/** Re-activate the current date after leaving (only while still in the date phase). */
export async function rejoinDate(
  io: SocketServer,
  eventId: string,
  participantId: string
) {
  const event = await Event.findById(eventId).lean();
  if (!event || event.phase !== "in_date") return;
  await Pairing.updateOne(
    {
      eventId,
      round: event.currentRound,
      $or: [{ aId: participantId }, { bId: participantId }],
    },
    { $pull: { leftBy: participantId } }
  );
  await broadcastRoundState(io, eventId);
}
