"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useSyncExternalStore } from "react";

import { getBackfillStatus, syncBytes, type BackfillStatus, type SyncState } from "@/app/sync/actions";

const IDLE: SyncState = { tone: "idle", message: "", at: 0 };

/** Wall clock in whole minutes; null on the server so the elapsed label never mismatches hydration. */
const subscribeMinute = (cb: () => void) => { const id = setInterval(cb, 60_000); return () => clearInterval(id); };
const minuteNow = () => Math.floor(Date.now() / 60_000) * 60_000;

/** "now", "14m", "3h", "2d": how long since the last sync. */
export function elapsedLabel(fromMs: number, nowMs: number): string {
  const minutes = Math.max(0, Math.floor((nowMs - fromMs) / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / (60 * 24))}d`;
}

/**
 * The Sync button with its own feedback: "syncing_" while the Server
 * Action runs, then what happened, fading on its own (CSS, keyed on the
 * result's timestamp so a repeat click restarts the fade). Next to the
 * icon, the time since `lastSyncedAt` (github_sync_state) or this visit's
 * last successful sync; nothing when neither is known.
 */
export function SyncButton({ lastSyncedAt = null }: { lastSyncedAt?: string | null }) {
  const now = useSyncExternalStore(subscribeMinute, minuteNow, () => null);
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
  const stored = lastSyncedAt ? Date.parse(lastSyncedAt) : NaN;
  const syncedAt = Math.max(Number.isFinite(stored) ? stored : 0, state.tone === "ok" ? state.at : 0);
  const elapsed = now !== null && syncedAt > 0 ? elapsedLabel(syncedAt, now) : null;
  const busy = pending || importing;
  const label = status === "failed" || state.tone === "warn" ? "Retry sync" : "Sync";

  return (
    <form action={action} className="relative">
      <button
        type="submit"
        disabled={busy}
        aria-busy={busy}
        aria-label={busy ? undefined : label}
        title={busy ? undefined : elapsed ? `${label} · last synced ${elapsed === "now" ? "just now" : `${elapsed} ago`}` : label}
        className="flex h-9 items-center gap-2 border border-hud-violet/40 px-3 text-xs text-hud-bone/70 hover:bg-hud-violet/10 disabled:cursor-progress disabled:opacity-60"
      >
        <svg aria-hidden viewBox="0 0 14 14" className={`h-3.5 w-3.5 fill-none stroke-current ${warning ? "text-hud-amber" : "text-hud-violet"}`} strokeWidth={1.4}>
          <path d="M11.5 5.5A4.75 4.75 0 0 0 2.6 4.2M2.5 8.5a4.75 4.75 0 0 0 8.9 1.3M2.5 1.5v3h3M11.5 12.5v-3h-3" />
        </svg>
        {busy ? (
          <>
            syncing<span className="blink">_</span>
          </>
        ) : (
          elapsed !== null && <span className="tabular-nums">{elapsed}</span>
        )}
      </button>
      {message && (
        <div
          role="status"
          key={state.at}
          aria-live="polite"
          className={`${!pending && !initial && !warning ? "hud-fade " : ""}absolute right-0 top-full z-30 mt-1 w-64 max-w-[calc(100vw-2rem)] border border-hud-violet/40 bg-hud-bg/95 p-2 text-xs ${
            warning ? "text-hud-amber" : "text-hud-bone/70"
          }`}
        >
          &gt; {message}
        </div>
      )}
    </form>
  );
}
