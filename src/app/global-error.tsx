"use client";

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

/**
 * Last-resort error boundary.
 *
 * Catches errors thrown in the root layout itself — failures so deep that
 * the normal error.tsx boundary cannot render. Must define its own
 * <html>/<body> because the parent layout has crashed.
 *
 * Sentry strongly recommends having this even if the route-level error.tsx
 * exists; otherwise root-layout crashes silently 500.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
