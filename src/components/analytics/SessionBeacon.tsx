"use client";

import { useEffect } from "react";

/**
 * Emits session_end when the tab is hidden or closed (ADR 0008).
 * `sendBeacon` survives page unload and carries the session cookie, so
 * the route handler can attribute it without any client-side identity.
 * Mounted once per authenticated page; owns nothing else.
 */
export function SessionBeacon() {
  useEffect(() => {
    const startedAt = Date.now();
    let sent = false;

    const send = () => {
      if (sent || document.visibilityState !== "hidden") return;
      sent = true;
      const body = new Blob([JSON.stringify({ duration_ms: Date.now() - startedAt })], {
        type: "application/json",
      });
      navigator.sendBeacon("/api/analytics/session-end", body);
    };

    document.addEventListener("visibilitychange", send);
    return () => document.removeEventListener("visibilitychange", send);
  }, []);

  return null;
}
