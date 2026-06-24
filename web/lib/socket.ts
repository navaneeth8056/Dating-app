import { io, type Socket } from "socket.io-client";
import { API_URL } from "./api";

/** One shared Socket.IO connection per browser tab. */
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_URL, { transports: ["websocket"] });
  }
  return socket;
}

export function closeSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/** Shape broadcast by the server's waiting-room state. */
export interface WaitingState {
  event: {
    id: string;
    name: string;
    phase: string;
    status: string;
    phaseStartedAt: number | null;
    currentRound: number;
    serverNow: number;
  };
  presentCount: number;
  present: Array<{
    id: string;
    name: string;
    gender: string | null;
    presence: string;
  }>;
  roster: Array<{
    id: string;
    name: string;
    email: string | null;
    gender: string | null;
    presence: string;
  }>;
}

/** Shape broadcast by the round engine during a live event. */
export interface RoundPair {
  aId: string;
  aName: string;
  bId: string;
  bName: string;
  status?: string;
  leftBy?: string[];
  hasRoom?: boolean;
}

export interface DateToken {
  roomUrl: string;
  token: string;
}

export interface RoundState {
  event: {
    id: string;
    name: string;
    phase: string; // in_date | in_break | finished
    status: string;
    currentRound: number;
    maxRounds: number;
    phaseStartedAt: number | null;
    phaseEndsAt: number | null;
    serverNow: number;
  };
  pairs: RoundPair[];
  nextPairs: RoundPair[];
  allPairs: Array<RoundPair & { round: number }>;
  byes: Array<{ id: string; name: string }>;
}

/** Formats elapsed milliseconds as M:SS (count-up). */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
