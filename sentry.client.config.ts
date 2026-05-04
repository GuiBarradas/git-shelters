/**
 * Sentry initialisation for the browser bundle.
 *
 * The DSN is intentionally exposed to the client. Sentry's design accepts
 * this — DSNs grant POST-only access to event ingestion, not read access
 * to any data. Treat the DSN as an "event endpoint", not a credential.
 *
 * Sample rates are tuned for the Public Alpha:
 *   - tracesSampleRate 0.1 keeps free-tier performance quota usable.
 *   - replaysSessionSampleRate 0 disables session replay until needed
 *     (large bandwidth cost; turn on when investigating a UX bug).
 *   - replaysOnErrorSampleRate 1.0 captures replays of crashing sessions
 *     for free (only fires on error, low volume).
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  // Avoid spamming Sentry with errors that originate outside our code
  // (browser extensions, ad blockers, third-party widgets).
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    /chrome-extension:\/\//,
    /moz-extension:\/\//,
  ],
});
