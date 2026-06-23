"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "../../../lib/api";

interface PublicEvent {
  _id: string;
  name: string;
  mode: "invite_csv" | "instant";
  joinPolicy: "roster_email" | "open";
  status: string;
}

interface JoinResponse {
  token: string;
  participant: { id: string; name: string; email?: string; gender?: string };
}

export default function JoinPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const router = useRouter();

  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [joined, setJoined] = useState<JoinResponse | null>(null);

  useEffect(() => {
    api<PublicEvent>(`/api/events/slug/${slug}`)
      .then(setEvent)
      .catch(() => setNotFound(true));
  }, [slug]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const body =
        event?.joinPolicy === "roster_email"
          ? { email, name }
          : { name, gender, phone };
      const res = await api<JoinResponse>(`/api/join/${slug}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      // Store the session and head into the waiting room.
      window.localStorage.setItem("sd_token", res.token);
      window.localStorage.setItem("sd_event", slug);
      window.localStorage.setItem("sd_name", res.participant.name);
      window.localStorage.setItem("sd_pid", res.participant.id);
      router.push(`/event/${slug}`);
    } catch (err: unknown) {
      const e = err as { body?: { message?: string }; status?: number };
      if (e.status === 403) {
        setErrorMsg(
          e.body?.message ??
            "This email isn't on the guest list. Please use your registered email."
        );
      } else if (e.status === 409) {
        setErrorMsg(
          e.body?.message ?? "Sorry, the event has started — you can't join now."
        );
      } else {
        setErrorMsg("Could not join. Please check your details and try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (notFound) {
    return (
      <Centered>
        <h1 className="text-xl font-semibold">Event not found</h1>
        <p className="mt-2 text-sm text-neutral-500">
          This link may be incorrect or the event has ended.
        </p>
      </Centered>
    );
  }

  if (!event) {
    return <Centered>Loading…</Centered>;
  }

  if (event.status === "running" || event.status === "completed") {
    return (
      <Centered>
        <h1 className="text-xl font-semibold">Sorry, the event has started</h1>
        <p className="mt-2 text-sm text-neutral-500">
          You can no longer join <strong>{event.name}</strong>.
        </p>
      </Centered>
    );
  }

  if (joined) {
    return (
      <Centered>
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl">
            ✓
          </div>
          <h1 className="text-xl font-semibold">You're in, {joined.participant.name}!</h1>
          <p className="mt-2 text-sm text-neutral-500">
            You've joined <strong>{event.name}</strong>. The waiting room opens in
            the next phase — hang tight.
          </p>
        </div>
      </Centered>
    );
  }

  return (
    <Centered>
      <h1 className="text-xl font-semibold">{event.name}</h1>
      <p className="mb-6 mt-1 text-sm text-neutral-500">
        {event.joinPolicy === "roster_email"
          ? "Enter the email you registered with to join."
          : "Enter your details to join the meeting."}
      </p>

      <form onSubmit={submit} className="space-y-4">
        {event.joinPolicy === "roster_email" ? (
          <>
            <Field label="Name (optional)">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="Your name"
              />
            </Field>
            <Field label="Registered email">
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="Name">
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="Your name"
              />
            </Field>
            <Field label="Gender">
              <select
                required
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="input"
              >
                <option value="">Select…</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Phone number">
              <input
                required
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input"
                placeholder="+1 555 123 4567"
              />
            </Field>
          </>
        )}

        {errorMsg && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Joining…" : "Join event"}
        </button>
      </form>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid rgb(212 212 212);
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
        }
      `}</style>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        {children}
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-neutral-600">{label}</span>
      {children}
    </label>
  );
}
