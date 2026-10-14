"use client";

import { useState } from "react";

import type { AwayReport } from "@/lib/economy/away";

/**
 * "While you were away" (design doc §10.3.1): the terminal's account of
 * what the crew did since the last visit. Shown once per settle; closing
 * it is client state only, because the next settle moves last_tick_at
 * forward and the report will not repeat.
 */
export function AwaySummary({ report, alerting = false }: { report: AwayReport; alerting?: boolean }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;

  // Below the TopBar (56 px from lg, 108 below), and the AlertBanner too when one is up.
  return (
    <div data-hud className={`pointer-events-auto absolute inset-x-0 ${alerting ? "top-[160px] lg:top-[116px]" : "top-[116px] lg:top-[72px]"} z-20 flex justify-center px-4`}>
      <section className="route-enter max-h-[calc(100dvh-180px)] w-full max-w-md overflow-y-auto border border-hud-violet/60 bg-hud-bg/95 p-4 font-mono text-sm text-hud-bone">
        <p className="mb-2 text-[10px] uppercase tracking-[0.25em] text-hud-bone/60">
          main-branch:~$ cat since_last_login.log
        </p>
        <h2 className="mb-3 text-hud-violet">{report.headline}</h2>
        <ul className="space-y-1 text-hud-bone/85">
          {report.lines.map((line) => (
            <li key={line}>&gt; {line}</li>
          ))}
          {report.warnings.map((line) => (
            <li key={line} className="text-hud-red-text">
              &gt; {line}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mt-4 border border-hud-violet px-3 py-1 text-hud-violet hover:bg-hud-violet/10"
        >
          back to work
        </button>
      </section>
    </div>
  );
}
