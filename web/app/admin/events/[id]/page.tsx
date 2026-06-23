"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, APP_URL, type EventSummary } from "../../../../lib/api";
import {
  getSocket,
  type WaitingState,
  type RoundState,
} from "../../../../lib/socket";

interface Participant {
  _id: string;
  name: string;
  email?: string;
  gender?: string;
  age?: number;
  phone?: string;
  source: string;
  authStatus: string;
}

interface EventDetail extends EventSummary {
  participantCount: number;
}

interface UploadResult {
  inserted: number;
  skippedExisting: number;
  validRows: number;
  errors: string[];
  totalInRoster: number;
}

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [roster, setRoster] = useState<Participant[]>([]);
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<WaitingState | null>(null);
  const [roundLive, setRoundLive] = useState<RoundState | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const ev = await api<EventDetail>(`/api/events/${id}`);
      setEvent(ev);
      const list = await api<Participant[]>(`/api/events/${id}/participants`);
      setRoster(list);
    } catch {
      setError("Could not load this event.");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Live presence via Socket.IO
  useEffect(() => {
    if (!id) return;
    const socket = getSocket();
    const watch = () => socket.emit("admin:watch", { eventId: id });
    if (socket.connected) watch();
    socket.on("connect", watch);
    socket.on("waiting:state", (s: WaitingState) => setLive(s));
    socket.on("round:state", (s: RoundState) => setRoundLive(s));
    return () => {
      socket.off("connect", watch);
      socket.off("waiting:state");
      socket.off("round:state");
    };
  }, [id]);

  function startEvent() {
    getSocket().emit("admin:start", { eventId: id });
  }

  async function deleteEvent() {
    const password = window.prompt(
      "Enter admin password to permanently delete this event:"
    );
    if (password === null) return;
    try {
      await api(`/api/events/${id}`, {
        method: "DELETE",
        body: JSON.stringify({ password }),
      });
      router.push("/admin");
    } catch (e) {
      const err = e as { status?: number };
      alert(
        err.status === 403
          ? "Wrong password — event was not deleted."
          : "Could not delete the event."
      );
    }
  }

  // Build the join link from the domain the admin is actually on (works in
  // dev and prod without depending on an env var).
  const base =
    typeof window !== "undefined" ? window.location.origin : APP_URL;
  const joinLink = event ? `${base}/join/${event.joinSlug}` : "";
  const finished =
    roundLive?.event.phase === "finished" ||
    roundLive?.event.status === "completed";
  const isRunning =
    !finished &&
    (roundLive?.event.status === "running" ||
      live?.event.status === "running" ||
      event?.status === "running");

  async function copyLink() {
    await navigator.clipboard.writeText(joinLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      const csvText = await file.text();
      const res = await api<UploadResult>(`/api/events/${id}/participants`, {
        method: "POST",
        body: JSON.stringify({ csvText }),
      });
      setResult(res);
      await load();
    } catch (err) {
      setError("Upload failed. Make sure it's a CSV with name & email columns.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-10">
        <p className="text-red-600">{error}</p>
        <Link href="/admin" className="text-sm underline">
          ← Back to events
        </Link>
      </main>
    );
  }

  if (!event) {
    return <main className="mx-auto max-w-3xl p-10 text-neutral-400">Loading…</main>;
  }

  return (
    <main className="mx-auto max-w-3xl p-6 sm:p-10">
      <Link href="/admin" className="text-sm text-neutral-500 hover:underline">
        ← Events
      </Link>

      <header className="mb-6 mt-2 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{event.name}</h1>
          <p className="text-sm text-neutral-500">
            {event.mode === "invite_csv" ? "Invite / CSV" : "Instant meeting"} ·{" "}
            {event.status} · {event.participantCount} participant(s)
          </p>
        </div>
        <button
          onClick={deleteEvent}
          className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          Delete event
        </button>
      </header>

      {/* Share link */}
      <section className="mb-8 rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-2 text-sm font-medium text-neutral-700">Join link</h2>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={joinLink}
            className="flex-1 rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm"
          />
          <button
            onClick={copyLink}
            className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <p className="mt-2 text-xs text-neutral-400">
          {event.mode === "invite_csv"
            ? "Guests enter their registered email to join."
            : "Anyone with this link joins by entering name + gender."}
        </p>
      </section>

      {/* Live control */}
      <section className="mb-8 rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-700">Live control</h2>
          <span className="text-xs text-neutral-500">
            Phase: {roundLive?.event.phase ?? live?.event.phase ?? event.phase}
            {roundLive
              ? ` · round ${roundLive.event.currentRound}/${roundLive.event.maxRounds}`
              : ` · ${live?.presentCount ?? 0} present`}
          </span>
        </div>

        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={startEvent}
            disabled={isRunning || (!finished && (live?.presentCount ?? 0) < 2)}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {isRunning
              ? "Event running"
              : finished
                ? "Start again"
                : "Start event"}
          </button>
          {finished && (
            <span className="text-xs text-neutral-400">
              Event finished — you can start a new run with whoever's still here.
            </span>
          )}
          {!isRunning && !finished && (live?.presentCount ?? 0) < 2 && (
            <span className="text-xs text-neutral-400">
              Need at least 2 people present to start.
            </span>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Present now */}
          <div className="rounded-xl border border-neutral-200 p-3">
            <p className="mb-2 text-xs font-medium text-neutral-500">
              In waiting room
            </p>
            {!live || live.present.length === 0 ? (
              <p className="text-sm text-neutral-400">No one yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {live.present.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-sm">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        p.presence === "in_waiting_room"
                          ? "bg-green-500"
                          : "bg-amber-400"
                      }`}
                    />
                    {p.name}
                    {p.gender ? (
                      <span className="text-xs text-neutral-400">
                        ({p.gender})
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Live pairings */}
          <div className="rounded-xl border border-neutral-200 p-3">
            <p className="mb-2 text-xs font-medium text-neutral-500">
              {roundLive?.event.phase === "in_break"
                ? "Up next"
                : "Ongoing"}{" "}
              {roundLive ? `(round ${roundLive.event.currentRound})` : ""}
            </p>
            {!roundLive ? (
              <p className="text-sm text-neutral-400">
                Pairings appear here once you start the event.
              </p>
            ) : roundLive.event.phase === "finished" ? (
              <p className="text-sm text-neutral-500">Event finished.</p>
            ) : (
              (() => {
                const showing =
                  roundLive.event.phase === "in_break"
                    ? roundLive.nextPairs
                    : roundLive.pairs;
                if (showing.length === 0)
                  return (
                    <p className="text-sm text-neutral-400">No pairs.</p>
                  );
                return (
                  <ul className="space-y-1.5">
                    {showing.map((p, i) => (
                      <li key={i} className="text-sm">
                        {p.aName} ↔ {p.bName}
                        {p.status === "left" && (
                          <span className="ml-2 text-xs text-amber-600">
                            (someone left)
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                );
              })()
            )}
            {roundLive && roundLive.byes.length > 0 && (
              <p className="mt-2 text-xs text-neutral-400">
                Sitting out: {roundLive.byes.map((b) => b.name).join(", ")}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Rounds log */}
      {roundLive && roundLive.allPairs.length > 0 && (
        <section className="mb-8 rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-medium text-neutral-700">
            Rounds log
          </h2>
          <div className="space-y-3">
            {Array.from(new Set(roundLive.allPairs.map((p) => p.round)))
              .sort((a, b) => a - b)
              .map((rn) => {
                const cur = roundLive.event.currentRound;
                const ph = roundLive.event.phase;
                const done =
                  ph === "finished" ||
                  rn < cur ||
                  (rn === cur && ph !== "in_date");
                const label = done
                  ? "Completed"
                  : rn === cur
                    ? "Ongoing"
                    : "Upcoming";
                const color = done
                  ? "text-neutral-400"
                  : rn === cur
                    ? "text-green-600"
                    : "text-neutral-500";
                return (
                  <div key={rn}>
                    <p className="text-xs font-medium">
                      <span className="text-neutral-600">Round {rn}</span>{" "}
                      <span className={color}>· {label}</span>
                    </p>
                    <ul className="mt-1 space-y-0.5 text-sm text-neutral-600">
                      {roundLive.allPairs
                        .filter((p) => p.round === rn)
                        .map((p, i) => (
                          <li key={i}>
                            {p.aName} ↔ {p.bName}
                            {p.status === "left" && (
                              <span className="ml-2 text-xs text-amber-600">
                                (left)
                              </span>
                            )}
                          </li>
                        ))}
                    </ul>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {/* CSV upload (Mode A only) */}
      {event.mode === "invite_csv" && (
        <section className="mb-8 rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-medium text-neutral-700">
            Upload roster (CSV)
          </h2>
          <p className="mb-3 text-xs text-neutral-400">
            Columns: name, email, gender, age, phone. Duplicates are skipped.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleUpload}
            disabled={uploading}
            className="block text-sm"
          />
          {uploading && (
            <p className="mt-2 text-sm text-neutral-500">Importing…</p>
          )}
          {result && (
            <div className="mt-3 rounded-lg bg-neutral-50 p-3 text-sm">
              <p className="text-green-700">
                Imported {result.inserted} · skipped {result.skippedExisting}{" "}
                existing · roster now {result.totalInRoster}.
              </p>
              {result.errors.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-xs text-amber-700">
                  {result.errors.slice(0, 8).map((er, i) => (
                    <li key={i}>{er}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      )}

      {/* Roster */}
      <section>
        <h2 className="mb-1 text-sm font-medium text-neutral-700">
          All participants ({roster.length})
        </h2>
        <p className="mb-3 text-xs text-neutral-400">
          Everyone registered for this event (uploaded guest list, or everyone
          who joined in instant mode) — not just who's online right now.
        </p>
        {roster.length === 0 ? (
          <p className="text-sm text-neutral-400">
            {event.mode === "invite_csv"
              ? "No one uploaded yet."
              : "No one has joined yet."}
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-neutral-500">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Gender</th>
                  <th className="px-3 py-2">Age</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((p) => (
                  <tr key={p._id} className="border-t border-neutral-100">
                    <td className="px-3 py-2">{p.name}</td>
                    <td className="px-3 py-2 text-neutral-500">{p.email ?? "—"}</td>
                    <td className="px-3 py-2">{p.gender ?? "—"}</td>
                    <td className="px-3 py-2">{p.age ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          p.authStatus === "verified"
                            ? "text-green-600"
                            : "text-neutral-400"
                        }
                      >
                        {p.authStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
