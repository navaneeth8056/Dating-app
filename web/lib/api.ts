export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function api<T = unknown>(
  path: string,
  options?: RequestInit,
  token?: string
): Promise<T> {
  // Abort after 12s so the UI never spins forever on a stalled request.
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 12000);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options?.headers as Record<string, string>) ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw Object.assign(new Error(data?.error ?? "Request failed"), {
        status: res.status,
        body: data,
      });
    }
    return data as T;
  } finally {
    clearTimeout(timeout);
  }
}

export interface EventSummary {
  _id: string;
  name: string;
  mode: "invite_csv" | "instant";
  joinPolicy: "roster_email" | "open";
  status: string;
  phase?: string;
  joinSlug: string;
  config?: {
    rounds: number;
    dateDurationSec: number;
    breakDurationSec: number;
    matchRule: string;
  };
  createdAt?: string;
}
