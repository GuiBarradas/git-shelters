"use client";

import { useId } from "react";

import { describeCrew, type EventEcho, type Mood } from "@/lib/forks/mood";

import type { CrewTip } from "./crewTip";
import { useDisclosure } from "./useDisclosure";

const ECHO: Record<EventEcho, string | null> = {
  pending: "a packet is waiting on the Main Branch terminal",
  good: "lifted by today's packet",
  bad: "rattled by today's packet",
  flat: null,
};

/**
 * Lower-left log: crew size and idle hands, then up to three `>` lines.
 * From xl a 128 px card; below that one line that expands upward over the
 * scene, so opening it never resizes the band (or moves the camera).
 * FirstSteps takes this slot during onboarding.
 */
export function CrewLog({ mood, lastPushAt, echo, forks, tip }: {
  mood: Mood;
  lastPushAt: string | null;
  echo: EventEcho | null;
  forks: ReadonlyArray<{ roomSlot: number | null }>;
  tip: CrewTip | null;
}) {
  const { open, setOpen, root, trigger } = useDisclosure();
  const id = useId();
  // A Fork with no room wanders the Main Branch: that is idle.
  const idle = forks.filter((f) => !f.roomSlot).length;
  const packet = echo ? ECHO[echo] : null;
  const crew = describeCrew(mood, lastPushAt);
  return (
    <div
      ref={root}
      role="region"
      aria-label="Crew log"
      className="pointer-events-auto relative w-full font-mono text-xs xl:h-32 xl:w-[380px] xl:overflow-hidden xl:border xl:border-hud-violet/40 xl:bg-hud-bg/95 xl:p-4"
    >
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-11 w-full items-center gap-3 border bg-hud-bg/95 px-4 text-left text-hud-bone hover:bg-hud-violet/10 xl:hidden ${open ? "border-hud-violet" : "border-hud-violet/40"}`}
      >
        <span className="min-w-0 flex-1 truncate">&gt; {crew}</span>
        <svg aria-hidden viewBox="0 0 10 10" className={`h-2.5 w-2.5 shrink-0 fill-none stroke-current text-hud-violet ${open ? "rotate-180" : ""}`} strokeWidth={1.4}>
          <path d="M2 6.5 5 3.5 8 6.5" />
        </svg>
      </button>
      <div
        id={id}
        className={`${open ? "" : "max-xl:hidden"} max-xl:absolute max-xl:inset-x-0 max-xl:bottom-full max-xl:mb-1 max-xl:border max-xl:border-hud-violet max-xl:bg-hud-bg/95 max-xl:p-4`}
      >
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-[10px] uppercase tracking-[0.22em] text-hud-violet">Crew.log</h2>
          <p className="text-[10px] text-hud-bone/60">
            {forks.length} {forks.length === 1 ? "Fork" : "Forks"} ·{" "}
            <span className={idle > 0 ? "text-hud-amber" : ""}>{idle} idle</span>
          </p>
        </div>
        <ul className="space-y-1 leading-snug">
          {/* Below xl the toggle already shows this line. */}
          <li className="truncate text-hud-bone max-xl:hidden">&gt; {crew}</li>
          {packet && <li className="truncate text-hud-bone/70 max-xl:whitespace-normal">&gt; {packet}</li>}
          {tip && <li className={`line-clamp-2 max-xl:line-clamp-none ${tip.tone}`}>&gt; {tip.text}</li>}
        </ul>
      </div>
    </div>
  );
}
