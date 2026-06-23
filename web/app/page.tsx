"use client";

import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function Home() {
  const [apiStatus, setApiStatus] = useState<string>("checking…");
  const [socketStatus, setSocketStatus] = useState<string>("connecting…");

  useEffect(() => {
    // 1) Check REST health endpoint
    fetch(`${API_URL}/health`)
      .then((r) => r.json())
      .then((d) => setApiStatus(`OK — ${d.service} (phase ${d.phase})`))
      .catch(() => setApiStatus("UNREACHABLE — is the server running?"));

    // 2) Check the realtime (Socket.IO) channel
    const socket: Socket = io(API_URL, { transports: ["websocket"] });
    socket.on("connect", () => {
      socket.emit("ping:test", "hello from web");
    });
    socket.on("pong:test", (data: { received: string }) => {
      setSocketStatus(`OK — echo: "${data.received}"`);
    });
    socket.on("connect_error", () => setSocketStatus("UNREACHABLE"));

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md w-full rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold mb-1">Speed Dating</h1>
        <p className="text-sm text-neutral-500 mb-6">Phase 0 — system check</p>

        <div className="space-y-3 text-sm">
          <Row label="API (/health)" value={apiStatus} />
          <Row label="Realtime (Socket.IO)" value={socketStatus} />
        </div>

        <p className="mt-6 text-xs text-neutral-400">
          Both should read “OK”. If not, make sure the server is running on{" "}
          {API_URL}.
        </p>

        <a
          href="/admin"
          className="mt-6 block w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-center text-sm font-medium text-white"
        >
          Go to Admin →
        </a>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const ok = value.startsWith("OK");
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-neutral-600">{label}</span>
      <span
        className={
          ok
            ? "font-medium text-green-600"
            : value.includes("…")
              ? "text-neutral-400"
              : "font-medium text-red-600"
        }
      >
        {value}
      </span>
    </div>
  );
}
