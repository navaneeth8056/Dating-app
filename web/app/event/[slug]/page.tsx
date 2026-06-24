"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getSocket,
  closeSocket,
  formatElapsed,
  type WaitingState,
  type RoundState,
  type DateToken,
} from "../../../lib/socket";
import VideoCall from "../../../components/VideoCall";
import PostEventSelection from "../../../components/PostEventSelection";

export default function EventPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const router = useRouter();

  const [waiting, setWaiting] = useState<WaitingState | null>(null);
  const [round, setRound] = useState<RoundState | null>(null);
  const [authError, setAuthError] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [myName, setMyName] = useState("");
  const [myPid, setMyPid] = useState("");
  const [myToken, setMyToken] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [leftEvent, setLeftEvent] = useState(false);
  const [exited, setExited] = useState(false);
  const [dateToken, setDateToken] = useState<DateToken | null>(null);

  const clockSkew = useRef(0);
  const phaseStartedAt = useRef<number | null>(null);

  useEffect(() => {
    const token = window.localStorage.getItem("sd_token");
    setMyName(window.localStorage.getItem("sd_name") ?? "");
    setMyPid(window.localStorage.getItem("sd_pid") ?? "");
    setMyToken(token ?? "");
    if (!token) {
      router.replace(`/join/${slug}`);
      return;
    }

    const socket = getSocket();
    const joinNow = () => socket.emit("participant:join", { token });
    if (socket.connected) joinNow();
    socket.on("connect", joinNow);

    const applyTiming = (startedAt: number | null, serverNow: number) => {
      if (startedAt != null) {
        clockSkew.current = serverNow - Date.now();
        phaseStartedAt.current = startedAt;
      }
    };

    socket.on("waiting:state", (s: WaitingState) => {
      setWaiting(s);
      // Waiting room has no timer — the clock only runs during the event.
      phaseStartedAt.current = null;
    });

    socket.on("round:state", (s: RoundState) => {
      setRound(s);
      applyTiming(s.event.phaseStartedAt, s.event.serverNow);
      // Stop the clock once the event is over.
      if (s.event.phase === "finished") phaseStartedAt.current = null;
    });

    socket.on("auth:error", () => setAuthError(true));
    socket.on("event:error", (e: { message?: string }) =>
      setErrorMsg(e?.message ?? "Could not start the event.")
    );
    socket.on("date:token:res", (r: DateToken | null) => setDateToken(r));

    return () => {
      socket.off("connect", joinNow);
      socket.off("waiting:state");
      socket.off("round:state");
      socket.off("auth:error");
      socket.off("event:error");
      socket.off("date:token:res");
    };
  }, [slug, router]);

  useEffect(() => {
    const id = setInterval(() => {
      if (phaseStartedAt.current != null) {
        setElapsed(Date.now() + clockSkew.current - phaseStartedAt.current);
      }
    }, 250);
    return () => clearInterval(id);
  }, []);

  // Request a Daily video token whenever we're actively on a date with a room.
  const myPairForVideo = round?.pairs.find(
    (p) => p.aId === myPid || p.bId === myPid
  );
  const wantVideo =
    round?.event.phase === "in_date" &&
    !!myPairForVideo &&
    !(myPairForVideo.leftBy ?? []).includes(myPid) &&
    !!myPairForVideo.hasRoom;
  const videoKey = wantVideo ? `r${round?.event.currentRound}` : "";
  useEffect(() => {
    if (videoKey) getSocket().emit("date:token");
    else setDateToken(null);
  }, [videoKey]);

  function leaveEvent() {
    if (!window.confirm("Leave the whole event? You can rejoin from this page."))
      return;
    getSocket().emit("participant:leave");
    setLeftEvent(true);
  }

  function rejoinEvent() {
    const token = window.localStorage.getItem("sd_token");
    if (!token) {
      router.replace(`/join/${slug}`);
      return;
    }
    getSocket().emit("participant:join", { token });
    setLeftEvent(false);
  }

  function exitForGood() {
    const socket = getSocket();
    socket.emit("participant:leave");
    closeSocket();
    window.localStorage.removeItem("sd_token");
    window.localStorage.removeItem("sd_pid");
    setExited(true);
  }

  function leaveDate() {
    getSocket().emit("date:leave");
  }

  function rejoinDate() {
    getSocket().emit("date:rejoin");
  }

  if (authError) {
    return (
      <Centered>
        <h1 className="text-xl font-semibold">Session expired</h1>
        <button
          onClick={() => router.replace(`/join/${slug}`)}
          className="mt-4 rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white"
        >
          Back to join
        </button>
      </Centered>
    );
  }

  if (exited) {
    return (
      <Centered>
        <div className="mb-3 text-5xl">💛</div>
        <h1 className="text-xl font-semibold">Thanks for coming!</h1>
        <p className="mt-2 text-sm text-neutral-500">
          We hope you had a lovely time{myName ? `, ${myName}` : ""}. See you at
          the next event! 🌹
        </p>
      </Centered>
    );
  }

  if (leftEvent) {
    return (
      <Centered>
        <h1 className="text-xl font-semibold">You left the event</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Changed your mind? You can jump back in.
        </p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            onClick={rejoinEvent}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
          >
            Rejoin event
          </button>
          <button
            onClick={exitForGood}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm text-neutral-600"
          >
            Exit
          </button>
        </div>
      </Centered>
    );
  }

  const phase = round?.event.phase ?? "waiting";
  const eventName = round?.event.name ?? waiting?.event.name ?? "Speed Dating";

  // Find my pairing this round
  const myPair = round?.pairs.find((p) => p.aId === myPid || p.bId === myPid);
  const myNext = round?.nextPairs.find(
    (p) => p.aId === myPid || p.bId === myPid
  );
  const partnerName = myPair
    ? myPair.aId === myPid
      ? myPair.bName
      : myPair.aName
    : null;
  const nextPartnerName = myNext
    ? myNext.aId === myPid
      ? myNext.bName
      : myNext.aName
    : null;
  const partnerId = myPair
    ? myPair.aId === myPid
      ? myPair.bId
      : myPair.aId
    : null;
  const leftBy = myPair?.leftBy ?? [];
  const iLeft = leftBy.includes(myPid);
  const partnerLeft = !!partnerId && leftBy.includes(partnerId);
  const amBye = round && !myPair;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col p-4 sm:p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{eventName}</h1>
          {myName && <p className="text-sm text-neutral-500">You're {myName}</p>}
        </div>
        <button
          onClick={leaveEvent}
          className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          Leave event
        </button>
      </header>

      {errorMsg && (
        <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {errorMsg}
        </div>
      )}

      {/* Timer + round indicator */}
      <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-6 text-center">
        <p className="text-xs uppercase tracking-wide text-neutral-400">
          {phase === "waiting" && "Waiting for the host to start the meeting…"}
          {phase === "in_date" &&
            `Round ${round?.event.currentRound} of ${round?.event.maxRounds} — on a date`}
          {phase === "in_break" && "Break — get ready for your next date"}
          {phase === "finished" && "Event finished"}
        </p>
        {(phase === "in_date" || phase === "in_break") && (
          <p className="mt-1 font-mono text-4xl font-semibold tabular-nums">
            {formatElapsed(elapsed)}
          </p>
        )}
      </div>

      {/* WAITING */}
      {phase === "waiting" && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-neutral-700">
              In the room now
            </h2>
            <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-sm font-medium">
              {waiting?.presentCount ?? 0}
            </span>
          </div>
          {!waiting || waiting.present.length === 0 ? (
            <p className="text-sm text-neutral-400">Waiting for people to join…</p>
          ) : (
            <ul className="space-y-2">
              {waiting.present.map((p) => (
                <li key={p.id} className="flex items-center gap-2 text-sm">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      p.presence === "in_waiting_room"
                        ? "bg-green-500"
                        : "bg-amber-400"
                    }`}
                  />
                  {p.name}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-neutral-400">
            You can safely refresh — you'll come right back here.
          </p>
        </section>
      )}

      {/* IN DATE */}
      {phase === "in_date" && (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
          {/* Main: partner + video */}
          <section className="flex-1 rounded-2xl border border-neutral-200 bg-white p-4 text-center sm:p-6">
            {amBye ? (
              <p className="text-neutral-600">
                You're sitting this round out. Sit tight — you'll be matched
                next round.
              </p>
            ) : iLeft ? (
              <div className="py-8">
                <p className="text-neutral-600">You left this date.</p>
                <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <button
                    onClick={rejoinDate}
                    className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
                  >
                    Rejoin this date
                  </button>
                  <span className="text-sm text-neutral-400">
                    or wait for the next round
                  </span>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs uppercase tracking-wide text-neutral-400">
                  You're talking with
                </p>
                <p className="mt-1 text-3xl font-semibold">{partnerName}</p>
                {partnerLeft && (
                  <p className="mx-auto mt-2 max-w-md rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Your match left the date — they may have a network issue.
                    You'll be paired with someone new next round.
                  </p>
                )}
                {dateToken ? (
                  <div className="mt-3">
                    <VideoCall
                      roomUrl={dateToken.roomUrl}
                      token={dateToken.token}
                    />
                  </div>
                ) : myPair?.hasRoom ? (
                  <p className="mt-2 text-sm text-neutral-500">
                    Connecting video…
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-neutral-400">
                    (Video unavailable — Daily API key not set on the server)
                  </p>
                )}
                <button
                  onClick={leaveDate}
                  className="mt-5 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Leave this date
                </button>
              </>
            )}
          </section>

          {/* Side: up next (right on laptop, below on phone) */}
          <aside className="rounded-2xl border border-neutral-200 bg-white p-5 lg:w-64 lg:shrink-0">
            <p className="text-xs uppercase tracking-wide text-neutral-400">
              Up next
            </p>
            {nextPartnerName ? (
              <p className="mt-1 text-xl font-semibold">{nextPartnerName}</p>
            ) : (
              <p className="mt-1 text-sm text-neutral-400">
                {round && round.event.currentRound >= round.event.maxRounds
                  ? "Last round — you're all done after this."
                  : "You're sitting the next round out."}
              </p>
            )}
          </aside>
        </div>
      )}

      {/* IN BREAK */}
      {phase === "in_break" && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 text-center">
          {nextPartnerName ? (
            <>
              <p className="text-xs uppercase tracking-wide text-neutral-400">
                Up next
              </p>
              <p className="mt-1 text-3xl font-semibold">{nextPartnerName}</p>
            </>
          ) : round && round.event.currentRound >= round.event.maxRounds ? (
            <p className="text-neutral-600">Last round done — wrapping up…</p>
          ) : (
            <p className="text-neutral-600">
              You're sitting the next round out.
            </p>
          )}
        </section>
      )}

      {/* FINISHED */}
      {phase === "finished" && (
        <section className="rounded-2xl border border-green-200 bg-green-50 p-5 sm:p-6">
          <p className="text-center text-lg font-semibold text-green-800">
            That's a wrap! 🎉
          </p>
          <div className="mt-4 rounded-xl bg-white p-4">
            {myToken && <PostEventSelection token={myToken} />}
          </div>
        </section>
      )}

      {/* YOUR DATES LOG */}
      {round && phase !== "waiting" && (
        <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-medium text-neutral-700">
            Your dates
          </h2>
          {(() => {
            const mine = round.allPairs
              .filter((p) => p.aId === myPid || p.bId === myPid)
              .sort((a, b) => a.round - b.round);
            if (mine.length === 0)
              return (
                <p className="text-sm text-neutral-400">
                  No dates assigned this event.
                </p>
              );
            const cur = round.event.currentRound;
            return (
              <ul className="space-y-1.5 text-sm">
                {mine.map((p) => {
                  const partner = p.aId === myPid ? p.bName : p.aName;
                  const done =
                    phase === "finished" ||
                    p.round < cur ||
                    (p.round === cur && phase !== "in_date");
                  const state =
                    p.status === "left"
                      ? "Left"
                      : done
                        ? "Completed"
                        : p.round === cur
                          ? "Ongoing"
                          : "Upcoming";
                  const color =
                    state === "Completed"
                      ? "text-neutral-400"
                      : state === "Ongoing"
                        ? "text-green-600"
                        : state === "Left"
                          ? "text-amber-600"
                          : "text-neutral-500";
                  return (
                    <li key={p.round} className="flex justify-between">
                      <span>
                        Round {p.round}: {partner}
                      </span>
                      <span className={color}>{state}</span>
                    </li>
                  );
                })}
              </ul>
            );
          })()}
        </section>
      )}
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        {children}
      </div>
    </main>
  );
}
