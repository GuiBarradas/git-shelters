"use client";

import { useActionState } from "react";

import { syncBytes, type SyncState } from "@/app/sync/actions";

const IDLE: SyncState = { tone: "idle", message: "", at: 0 };

/**
 * The Sync button with its own feedback: "syncing_" while the Server
 * Action runs, then what happened, fading on its own (CSS, keyed on the
 * result's timestamp so a repeat click restarts the fade).
 */
export function SyncButton() {
  const [state, action, pending] = useActionState(async () => syncBytes(), IDLE);

  return (
    <form action={action} className="relative">
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="border border-[#7FFF6A] px-3 py-1 transition hover:bg-[#7FFF6A]/10 disabled:cursor-progress disabled:opacity-60"
      >
        {pending ? (
          <>
            syncing<span className="blink">_</span>
          </>
        ) : (
          "Sync"
        )}
      </button>
      {!pending && state.tone !== "idle" && (
        <output
          key={state.at}
          aria-live="polite"
          className={`hud-fade absolute right-0 top-full mt-1 whitespace-nowrap text-xs ${
            state.tone === "ok" ? "text-[#7FFF6A]/80" : "text-[#A14545]"
          }`}
        >
          &gt; {state.message}
        </output>
      )}
    </form>
  );
}
