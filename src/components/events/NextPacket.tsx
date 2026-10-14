"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Countdown to the next UTC-midnight packet, once today's is resolved.
 * Starts from the server's `observedAt` so the first render matches
 * hydration, then ticks each second. At zero it does not reload by itself:
 * the player gets a refresh button.
 */
export function NextPacket({ availableAt, observedAt, compact = false }: {
  availableAt: string;
  observedAt: string;
  /** The overview's PacketCard: below xl, label left and countdown right, no reset line. */
  compact?: boolean;
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.parse(observedAt));
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.ceil((Date.parse(availableAt) - now) / 1000));
  if (seconds === 0) {
    return (
      <button type="button" onClick={() => router.refresh()} className="min-h-11 w-full border border-hud-amber px-3 py-2 text-hud-amber hover:bg-hud-amber/10">
        A new daily event is ready · refresh
      </button>
    );
  }
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
  const day = new Date(availableAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return (
    <div className={compact ? "max-xl:flex max-xl:flex-wrap max-xl:items-center max-xl:justify-between max-xl:gap-3" : undefined}>
      <div className={`flex items-baseline justify-between ${compact ? "max-xl:flex-col max-xl:gap-1" : ""}`}>
        <p className="text-[10px] uppercase tracking-[0.22em] text-hud-violet">Next packet</p>
        <p className="text-[10px] text-hud-bone/60">today ✓ resolved</p>
      </div>
      <p role="timer" aria-label={`Next daily event in ${h}h ${m}m`} className={`my-1 font-pixel text-[30px] leading-tight tabular-nums text-hud-violet ${compact ? "max-xl:my-0 max-sm:text-2xl sm:max-xl:text-lg" : ""}`}>
        {pad(h)}:{pad(m)}:{pad(s)}
      </p>
      <p className={`text-hud-bone/60 ${compact ? "max-xl:hidden" : ""}`}>
        Resets 00:00 UTC · <time dateTime={availableAt}>{day}</time>
      </p>
    </div>
  );
}
