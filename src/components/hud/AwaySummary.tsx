"use client";

import { useState } from "react";

import type { AwayReport } from "@/lib/economy/away";

/**
 * "While you were away" (design doc §10.3.1): the terminal's account of
 * what the crew did since the last visit. Shown once per settle; closing
 * it is client state only, because the next settle moves last_tick_at
 * forward and the report will not repeat.
 */
export function AwaySummary({ report }: { report: AwayReport }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;

  return (
    <div className="pointer-events-auto absolute inset-x-0 top-24 z-20 flex justify-center px-4">
      <section className="route-enter w-full max-w-md border border-[#7FFF6A]/60 bg-[#0F0F0F]/95 p-4 font-mono text-sm text-[#E6DFC8] shadow-[0_0_30px_rgba(127,255,106,0.12)]">
        <p className="mb-2 text-[10px] uppercase tracking-[0.25em] text-[#7FFF6A]/60">
          main-branch:~$ cat since_last_login.log
        </p>
        <h2 className="mb-3 text-[#7FFF6A]">{report.headline}</h2>
        <ul className="space-y-1 text-[#E6DFC8]/85">
          {report.lines.map((line) => (
            <li key={line}>&gt; {line}</li>
          ))}
          {report.warnings.map((line) => (
            <li key={line} className="text-[#A14545]">
              &gt; {line}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mt-4 border border-[#7FFF6A] px-3 py-1 text-[#7FFF6A] transition hover:bg-[#7FFF6A]/10"
        >
          back to work
        </button>
      </section>
    </div>
  );
}
