import type { Server as SocketServer, Socket } from "socket.io";
import { Event } from "../models/Event";
import { Participant } from "../models/Participant";
import { verifySession } from "../auth/jwt";
import {
  startEvent,
  leaveDate,
  rejoinDate,
  issueDateToken,
  broadcastRoundState,
} from "./roundEngine";

const eventRoom = (eventId: string) => `event:${eventId}`;
const adminRoom = (eventId: string) => `admin:${eventId}`;

interface SocketData {
  participantId?: string;
  eventId?: string;
  isAdmin?: boolean;
}

/** Broadcasts waiting-room (pre-start) presence to participants + admin. */
async function broadcastState(io: SocketServer, eventId: string) {
  const event = await Event.findById(eventId).lean();
  if (!event) return;

  const participants = await Participant.find({ eventId })
    .sort({ createdAt: 1 })
    .lean();

  const present = participants.filter(
    (p) => p.presence === "in_waiting_room" || p.presence === "in_date"
  );

  const payload = {
    event: {
      id: String(event._id),
      name: event.name,
      phase: event.phase,
      status: event.status,
      phaseStartedAt: event.phaseStartedAt
        ? new Date(event.phaseStartedAt).getTime()
        : null,
      currentRound: event.currentRound,
      serverNow: Date.now(),
    },
    presentCount: present.length,
    present: present.map((p) => ({
      id: String(p._id),
      name: p.name,
      gender: p.gender ?? null,
      presence: p.presence,
    })),
    roster: participants.map((p) => ({
      id: String(p._id),
      name: p.name,
      email: p.email ?? null,
      gender: p.gender ?? null,
      presence: p.presence,
    })),
  };

  io.to(eventRoom(eventId)).emit("waiting:state", payload);
  io.to(adminRoom(eventId)).emit("waiting:state", payload);
}

export function registerWaitingRoom(io: SocketServer) {
  io.on("connection", (socket: Socket) => {
    const data = socket.data as SocketData;

    socket.on("participant:join", async ({ token }: { token?: string }) => {
      const session = token ? verifySession(token) : null;
      if (!session) {
        socket.emit("auth:error", { message: "Invalid or expired session." });
        return;
      }

      data.participantId = session.participantId;
      data.eventId = session.eventId;
      socket.join(eventRoom(session.eventId));

      const event = await Event.findById(session.eventId);
      const running = event?.status === "running";

      await Participant.findByIdAndUpdate(session.participantId, {
        presence: running ? "in_date" : "in_waiting_room",
        socketId: socket.id,
        lastSeenAt: new Date(),
      });

      if (event && event.phase === "idle") {
        event.phase = "waiting";
        event.phaseStartedAt = new Date();
        event.status = "waiting";
        await event.save();
      }

      const me = await Participant.findById(session.participantId).lean();
      socket.emit("participant:joined", {
        participant: me ? { id: String(me._id), name: me.name } : null,
      });

      // Land them in the right place: live round if running, else waiting room.
      if (running) {
        await broadcastRoundState(io, session.eventId);
      } else {
        await broadcastState(io, session.eventId);
      }
    });

    socket.on("participant:leave", async () => {
      if (!data.participantId || !data.eventId) return;
      await Participant.findByIdAndUpdate(data.participantId, {
        presence: "offline",
        socketId: null,
        lastSeenAt: new Date(),
      });
      socket.leave(eventRoom(data.eventId));
      const eventId = data.eventId;
      data.participantId = undefined;
      data.eventId = undefined;
      await broadcastState(io, eventId);
    });

    // Escape hatch: leave the current date early.
    socket.on("date:leave", async () => {
      if (!data.participantId || !data.eventId) return;
      await leaveDate(io, data.eventId, data.participantId);
    });

    // Change your mind: rejoin the current date.
    socket.on("date:rejoin", async () => {
      if (!data.participantId || !data.eventId) return;
      await rejoinDate(io, data.eventId, data.participantId);
    });

    // Request a Daily video token for the current date.
    socket.on("date:token", async () => {
      if (!data.participantId || !data.eventId) return;
      const res = await issueDateToken(data.eventId, data.participantId);
      socket.emit("date:token:res", res);
    });

    socket.on("admin:watch", async ({ eventId }: { eventId?: string }) => {
      if (!eventId) return;
      data.isAdmin = true;
      data.eventId = eventId;
      socket.join(adminRoom(eventId));
      const event = await Event.findById(eventId).lean();
      if (event?.status === "running" || event?.status === "completed") {
        await broadcastRoundState(io, eventId);
      } else {
        await broadcastState(io, eventId);
      }
    });

    socket.on("admin:start", async ({ eventId }: { eventId?: string }) => {
      if (!eventId) return;
      await startEvent(io, eventId);
    });

    socket.on("disconnect", async () => {
      if (data.participantId) {
        const p = await Participant.findById(data.participantId);
        if (p && p.socketId === socket.id) {
          p.presence = "disconnected";
          p.socketId = null;
          p.lastSeenAt = new Date();
          await p.save();
          if (data.eventId) {
            const event = await Event.findById(data.eventId).lean();
            if (event?.status === "running") {
              await broadcastRoundState(io, data.eventId);
            } else {
              await broadcastState(io, data.eventId);
            }
          }
        }
      }
    });
  });
}
