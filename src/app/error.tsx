"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Route-level error boundary.
 *
 * Catches errors thrown in any segment under app/, except the root layout
 * itself (that's global-error.tsx). The boundary reports to Sentry and
 * shows a tone-appropriate fallback to the player. Reset() retries the
 * segment without a full page reload.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex-1 w-full h-dvh flex items-center justify-center p-8">
      <div className="max-w-md w-full space-y-6 border border-[#E6DFC8]/20 p-6">
        <div className="text-xs uppercase tracking-widest text-[#E6DFC8]/60">
          {"// system :: error"}
        </div>
        <h1 className="text-2xl font-mono">CONNECTION LOST</h1>
        <p className="text-sm text-[#E6DFC8]/80 leading-relaxed">
          Something in the bunker stopped responding. The 404 always claims
          something. The fault has been logged.
        </p>
        {error.digest ? (
          <p className="text-[10px] uppercase tracking-widest text-[#E6DFC8]/40">
            digest: {error.digest}
          </p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          className="border border-[#7FFF6A] px-4 py-2 text-[#7FFF6A] font-mono text-sm hover:bg-[#7FFF6A]/10 transition"
        >
          retry
        </button>
      </div>
    </main>
  );
}
