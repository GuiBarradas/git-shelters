"use client";

import { useEffect } from "react";

/**
 * Emits session_end for each visible segment of the page (ADR 0008): the
 * clock runs only while the tab is visible, is flushed when it hides,
 * closes or unmounts, and restarts when it is shown again. One segment is
 * sent at most once, so hidden + pagehide + cleanup never double-count.
 * `sendBeacon` survives page unload and carries the session cookie, so
 * the route handler can attribute it without any client-side identity.
 * Mounted once per authenticated page; owns nothing else.
 */
export function SessionBeacon() {
  useEffect(() => {
    let visibleSince: number | null = document.visibilityState === "visible" ? performance.now() : null;

    const flush = () => {
      if (visibleSince === null) return;
      const duration_ms = performance.now() - visibleSince;
      visibleSince = null;
      const body = new Blob([JSON.stringify({ duration_ms, measurement: "visible_segment" })], {
        type: "application/json",
      });
      navigator.sendBeacon("/api/analytics/session-end", body);
    };

    const resume = () => {
      if (visibleSince === null && document.visibilityState === "visible") visibleSince = performance.now();
    };

    const onVisibility = () => (document.visibilityState === "hidden" ? flush() : resume());

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    // Restored from the back/forward cache: a new segment begins.
    window.addEventListener("pageshow", resume);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("pageshow", resume);
      flush();
    };
  }, []);

  return null;
}
