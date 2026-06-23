import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface SessionPayload {
  participantId: string;
  eventId: string;
}

export function signSession(payload: SessionPayload): string {
  // Sessions last the length of an event; 12h is plenty for testing.
  return jwt.sign(payload, env.jwtSecret, { expiresIn: "12h" });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, env.jwtSecret) as SessionPayload;
  } catch {
    return null;
  }
}
