"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type EventSummary } from "../../lib/api";

export default function AdminPage() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // create form
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"invite_csv" | "instant">("invite_csv");
  const [rounds, setRounds] = useState(5);
  const [dateSec, setDateSec] = useState(120);
  const [breakSec, setBreakSec] = useState(30);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const list = await api<EventSummary[]>("/api/events");
      setEvents(list);
      setError(null);
    } catch (e) {
      setError("Could not load events — is the server running?");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await api<EventSummary>("/api/events", {
        method: "POST",
        body: JSON.stringify({
          name,
          mode,
          config: {
            rounds,
            dateDurationSec: dateSec,
            breakDurationSec: breakSec,
          },
        }),
      });
      setName("");
      await load();
    } catch {
      setError("Failed to create event.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-6 sm:p-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">Admin · Events</h1>
        <p className="text-sm text-neutral-500">
          Create a speed-dating event and manage its roster.
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Create form */}
      <form
        onSubmit={createEvent}
        className="mb-10 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
      >
        <h2 className="mb-4 text-lg font-medium">Create event</h2>

        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-neutral-600">Event name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Friday Night Speed Dating"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>

        <fieldset className="mb-4">
          <span className="mb-2 block text-sm text-neutral-600">Mode</span>
          <div className="grid gap-3 sm:grid-cols-2">
            <ModeCard
              active={mode === "invite_csv"}
              onClick={() => setMode("invite_csv")}
              title="Invite / CSV"
              desc="Upload a roster. Guests join by their registered email."
            />
            <ModeCard
              active={mode === "instant"}
              onClick={() => setMode("instant")}
              title="Instant meeting"
              desc="Share a link. Anyone joins with name + gender."
            />
          </div>
        </fieldset>

        <div className="mb-4 grid grid-cols-3 gap-3">
          <NumField label="Rounds" value={rounds} onChange={setRounds} />
          <NumField label="Date (sec)" value={dateSec} onChange={setDateSec} />
          <NumField label="Break (sec)" value={breakSec} onChange={setBreakSec} />
        </div>
        <p className="mb-4 text-xs text-neutral-400">
          Testing defaults: 120s date / 30s break. Switch to 600 / 120 for production.
        </p>

        <button
          type="submit"
          disabled={creating}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create event"}
        </button>
      </form>

      {/* Events list */}
      <h2 className="mb-3 text-lg font-medium">Your events</h2>
      {loading ? (
        <p className="text-sm text-neutral-400">Loading…</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-neutral-400">No events yet.</p>
      ) : (
        <ul className="space-y-3">
          {events.map((ev) => (
            <li
              key={ev._id}
              className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3"
            >
              <div>
                <p className="font-medium">{ev.name}</p>
                <p className="text-xs text-neutral-500">
                  {ev.mode === "invite_csv" ? "Invite / CSV" : "Instant"} ·{" "}
                  {ev.status}
                </p>
              </div>
              <Link
                href={`/admin/events/${ev._id}`}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
              >
                Manage →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function ModeCard({
  active,
  onClick,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition ${
        active
          ? "border-neutral-900 bg-neutral-50 ring-1 ring-neutral-900"
          : "border-neutral-200 hover:border-neutral-300"
      }`}
    >
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-neutral-500">{desc}</p>
    </button>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-neutral-600">{label}</span>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2"
      />
    </label>
  );
}
