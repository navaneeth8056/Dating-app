import { env } from "../config/env";

const DAILY_API = "https://api.daily.co/v1";

export const dailyEnabled = () => Boolean(env.dailyApiKey);

function authHeaders() {
  return {
    Authorization: `Bearer ${env.dailyApiKey}`,
    "Content-Type": "application/json",
  };
}

/**
 * Creates a private Daily room that auto-expires.
 * Returns { name, url }. Throws on failure.
 */
export async function createRoom(expEpochSec: number): Promise<{
  name: string;
  url: string;
}> {
  const res = await fetch(`${DAILY_API}/rooms`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      privacy: "private",
      properties: {
        exp: expEpochSec, // room self-deletes after this
        enable_chat: true,
        start_video_off: false,
        start_audio_off: false,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Daily createRoom failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { name: string; url: string };
  return { name: data.name, url: data.url };
}

/**
 * Creates a meeting token scoped to a room for one participant.
 */
export async function createMeetingToken(
  roomName: string,
  userName: string,
  expEpochSec: number
): Promise<string> {
  const res = await fetch(`${DAILY_API}/meeting-tokens`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        user_name: userName,
        exp: expEpochSec,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Daily createMeetingToken failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { token: string };
  return data.token;
}
