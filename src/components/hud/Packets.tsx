"use client";

import { useActionState, useState } from "react";

import { openNotice, type OpenState } from "@/app/notices/actions";
import type { Notice } from "@/lib/notices";

const IDLE: OpenState = { tone: "idle", bytes: 0, message: "", at: 0 };

/**
 * Packets waiting on the HUD: one amber line per unread notice. Clicking
 * opens it on a CRT, marks it read and collects whatever it carried.
 * The line disappears once the packet is opened; the revalidated page
 * agrees on the next render.
 */
export function Packets({ notices }: { notices: Notice[] }) {
  const [open, setOpen] = useState<Notice | null>(null);
  const [state, action, pending] = useActionState(openNotice, IDLE);
  const [collected, setCollected] = useState<Set<string>>(new Set());

  const waiting = notices.filter((n) => !collected.has(n.id));
  if (waiting.length === 0 && !open) return null;

  return (
    <>
      {waiting.map((n) => (
        <p key={n.id}>
          <button
            type="button"
            onClick={() => setOpen(n)}
            className="pointer-events-auto text-left text-[#E67E22] hover:text-[#E6DFC8]"
          >
            &gt; packet waiting: {n.title} · <span className="blink">open</span>
          </button>
        </p>
      ))}

      {open && (
        <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-[#0B0713]/80 px-4">
          <section className="crt route-enter w-full max-w-lg px-6 py-5 font-mono text-sm text-[#E6DFC8]">
            <p className="mb-3 text-[10px] uppercase tracking-[0.25em] text-[#BD93F9]/70">main-branch:~$ open packet</p>
            <h2 className="mb-3 uppercase tracking-[0.2em] text-[#BD93F9]">{open.title}</h2>
            <p className="leading-relaxed">{open.body}</p>
            {state.tone !== "idle" && state.at > 0 && collected.has(open.id) && (
              <p className={`mt-3 ${state.tone === "ok" ? "text-[#E67E22]" : "text-[#A14545]"}`}>&gt; {state.message}</p>
            )}
            <div className="mt-4 flex items-center justify-between text-xs">
              {collected.has(open.id) ? (
                <button type="button" onClick={() => setOpen(null)} className="border border-[#BD93F9] px-3 py-1 text-[#BD93F9] hover:bg-[#BD93F9]/10">
                  back to work
                </button>
              ) : (
                <form
                  action={(fd) => {
                    setCollected((s) => new Set(s).add(open.id));
                    action(fd);
                  }}
                >
                  <input type="hidden" name="id" value={open.id} />
                  <button
                    type="submit"
                    disabled={pending}
                    className="border border-[#E67E22] px-3 py-1 text-[#E67E22] transition hover:bg-[#E67E22]/10 disabled:opacity-60"
                  >
                    {open.bytes > 0 ? `collect ${open.bytes} B` : "got it"}
                  </button>
                </form>
              )}
              <span className="text-[#E6DFC8]/40">{pending ? "opening_" : ""}</span>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
