"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { getBackfillStatus, syncBytes, type BackfillStatus, type SyncState } from "@/app/sync/actions";

const IDLE: SyncState = { tone: "idle", message: "", at: 0 };

/**
 * The Sync button with its own feedback: "syncing_" while the Server
 * Action runs, then what happened, fading on its own (CSS, keyed on the
 * result's timestamp so a repeat click restarts the fade).
 */
export function SyncButton() {
  const router = useRouter();
  const [status, setStatus] = useState<BackfillStatus | null>(null);
  const [state, action, pending] = useActionState(async () => {
    try {
      return await syncBytes();
    } catch {
      return { tone: "warn" as const, message: "Sync failed. Try again.", at: Date.now() };
    }
  }, IDLE);

  useEffect(() => {
    if (pending) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let wasImporting = false;
    async function check() {
      const next = await getBackfillStatus().catch(() => "unavailable" as const);
      if (cancelled) return;
      setStatus(next);
      if (next === "pending" || next === "in_progress") {
        wasImporting = true;
        timer = setTimeout(check, 5000);
      } else if (next === "done" && wasImporting) {
        router.refresh();
      }
    }
    void check();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [pending, state.at, router]);

  const importing = status === "in_progress";
  const initial = status !== null && status !== "done" && status !== "unavailable";
  const message = pending
    ? initial ? "Checking public pushes from the last 30 days… You can keep playing." : "Checking new public pushes…"
    : importing ? "Importing public pushes from the last 30 days… You can keep playing."
    : status === "failed" ? "Initial sync was interrupted. Retry to finish importing your public pushes."
    : status === "pending" ? "Your initial sync is waiting. Sync to check your last 30 days of public pushes."
    : state.message;
  const warning = !pending && (status === "failed" || state.tone === "warn");

  return (
    <form action={action} className="relative">
      <button
        type="submit"
        disabled={pending || importing}
        aria-busy={pending || importing}
        className="border border-[#BD93F9] px-3 py-1 transition hover:bg-[#BD93F9]/10 disabled:cursor-progress disabled:opacity-60"
      >
        {pending || importing ? (
          <>
            syncing<span className="blink">_</span>
          </>
        ) : (
          status === "failed" || state.tone === "warn" ? "Retry sync" : "Sync"
        )}
      </button>
      {message && (
        <div
          role="status"
          key={state.at}
          aria-live="polite"
          className={`${!pending && !initial && !warning ? "hud-fade " : ""}absolute right-0 top-full mt-1 w-64 max-w-[calc(100vw-2rem)] border border-[#BD93F9]/30 bg-[#0B0713]/95 p-2 text-xs ${
            warning ? "text-[#E8A24A]" : "text-[#BD93F9]/80"
          }`}
        >
          &gt; {message}
        </div>
      )}
    </form>
  );
}
