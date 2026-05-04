/**
 * Sentry initialisation for the Node.js server runtime.
 *
 * Captures errors from Server Components, Route Handlers, and Server Actions.
 * Uses the non-public DSN (server-only) so a build-time misconfiguration
 * cannot accidentally bundle it to the client (the public one is for that).
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  // Server errors are higher-signal than client errors, so we keep the
  // "spread thin" sampling tighter than typical.
});
