/**
 * Next.js instrumentation entrypoint.
 *
 * Runs once per server runtime at startup. In Next 16, both Server Components
 * and the proxy (former middleware) run on Node — there is no edge runtime
 * dispatch unless we explicitly opt a Route Handler into `runtime: 'edge'`.
 * We do not, so only the Node init is wired here.
 *
 * Reference: https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */

import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
}

// Forward request errors from server components / route handlers to Sentry
// in the Next.js 16+ shape. Without this, only thrown errors caught by the
// Next runtime are reported; nested promise rejections can slip through.
export const onRequestError = Sentry.captureRequestError;
