"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";

interface DateRow {
  id: string;
  name: string;
  myDecision: "like" | "pass" | null;
  matched: boolean;
  contact: { email: string | null; phone: string | null } | null;
}

export default function PostEventSelection({ token }: { token: string }) {
  const [rows, setRows] = useState<DateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<DateRow[]>(
        "/api/selections/dates",
        undefined,
        token
      );
      setRows(data);
      setError(null);
    } catch {
      setError("Could not load your dates.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
    // Auto-refresh when the other person likes back (real-time).
    const socket = getSocket();
    const onUpdate = () => load();
    socket.on("match:update", onUpdate);
    return () => {
      socket.off("match:update", onUpdate);
    };
  }, [load]);

  async function choose(toId: string, decision: "like" | "pass") {
    setBusyId(toId);
    try {
      await api(
        "/api/selections/select",
        { method: "POST", body: JSON.stringify({ toId, decision }) },
        token
      );
      await load();
    } catch {
      setError("Could not save your choice.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading)
    return <p className="text-sm text-neutral-400">Loading your dates…</p>;

  if (rows.length === 0)
    return <p className="text-sm text-neutral-400">No dates to review.</p>;

  const matched = rows.filter((r) => r.matched);
  const pending = rows.filter((r) => !r.matched);

  return (
    <div className="space-y-5">
      {/* Choose who you'd like to see again */}
      <div className="space-y-3">
        <p className="text-sm text-neutral-500">
          Choose who you'd like to see again. If you both like each other,
          they'll appear in <strong>Your matches</strong> below with their
          contact details.
        </p>
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {pending.length === 0 ? (
          <p className="text-sm text-neutral-400">
            You've decided on everyone. 🎉
          </p>
        ) : (
          <ul className="space-y-2">
            {pending.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-2 rounded-xl border border-neutral-200 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="font-medium">{r.name}</p>
                <div className="flex gap-2">
                  <button
                    disabled={busyId === r.id}
                    onClick={() => choose(r.id, "like")}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
                      r.myDecision === "like"
                        ? "bg-green-600 text-white"
                        : "border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    {r.myDecision === "like" ? "Liked ✓" : "Like"}
                  </button>
                  <button
                    disabled={busyId === r.id}
                    onClick={() => choose(r.id, "pass")}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
                      r.myDecision === "pass"
                        ? "bg-neutral-800 text-white"
                        : "border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    {r.myDecision === "pass" ? "Passed ✓" : "Pass"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <button
          onClick={load}
          className="text-sm text-neutral-500 underline hover:text-neutral-700"
        >
          Refresh
        </button>
      </div>

      {/* Your matches — mutual likes, with contact details */}
      <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
        <h3 className="text-sm font-semibold text-green-800">
          💚 Your matches{matched.length > 0 ? ` (${matched.length})` : ""}
        </h3>
        {matched.length === 0 ? (
          <p className="mt-2 text-sm text-green-700/70">
            No matches yet. When someone you liked likes you back, they'll show
            up here instantly.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {matched.map((r) => (
              <li
                key={r.id}
                className="rounded-xl bg-white p-3 shadow-sm"
              >
                <p className="font-medium">{r.name}</p>
                <p className="mt-0.5 text-sm text-neutral-600">
                  {r.contact?.phone ? (
                    <span>📞 {r.contact.phone}</span>
                  ) : null}
                  {r.contact?.email ? (
                    <span>
                      {r.contact?.phone ? " · " : ""}✉️ {r.contact.email}
                    </span>
                  ) : null}
                  {!r.contact?.phone && !r.contact?.email && (
                    <span className="text-neutral-400">
                      No contact details on file.
                    </span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
