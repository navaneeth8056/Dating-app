"use client";

import { useEffect, useRef } from "react";
import DailyIframe, { type DailyCall } from "@daily-co/daily-js";

/**
 * Mounts a Daily video call into a container and joins with the given token.
 * Robust against React StrictMode's double-mount and rapid room changes:
 * any existing Daily instance is destroyed before a new frame is created.
 */
export default function VideoCall({
  roomUrl,
  token,
}: {
  roomUrl: string;
  token: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const callRef = useRef<DailyCall | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Tear down any stray/previous instance first (StrictMode safety).
      const existing = DailyIframe.getCallInstance();
      if (existing) {
        try {
          await existing.destroy();
        } catch {
          /* ignore */
        }
      }
      if (cancelled || !wrapRef.current) return;

      const call = DailyIframe.createFrame(wrapRef.current, {
        showLeaveButton: false,
        iframeStyle: {
          position: "absolute",
          top: "0",
          left: "0",
          width: "100%",
          height: "100%",
          border: "0",
          borderRadius: "12px",
        },
      });
      callRef.current = call;

      // If we were cleaned up while awaiting, undo immediately.
      if (cancelled) {
        call.destroy().catch(() => {});
        callRef.current = null;
        return;
      }

      try {
        await call.join({ url: roomUrl, token });
      } catch (e) {
        console.error("[daily] join failed", e);
      }
    })();

    return () => {
      cancelled = true;
      const c = callRef.current;
      callRef.current = null;
      if (c) c.destroy().catch(() => {});
    };
  }, [roomUrl, token]);

  return (
    <div
      ref={wrapRef}
      className="relative mx-auto h-[72vh] max-h-[760px] min-h-[380px] w-full overflow-hidden rounded-xl bg-black"
    />
  );
}
