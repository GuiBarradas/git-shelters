import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

/**
 * Sentry build-time wrapper.
 *
 * Uploads sourcemaps to Sentry on production builds so stack traces in
 * minified production code remain readable. Requires SENTRY_AUTH_TOKEN
 * in the build environment — without it, the upload step is skipped
 * silently, the app still builds.
 *
 * silent: !process.env.CI — quiet on local dev (no log noise during
 * fast inner loop), verbose in CI/prod builds (we want to see the
 * sourcemap upload step succeed or fail).
 *
 * widenClientFileUpload uploads more files than strictly the entry — pays
 * off when third-party code throws (e.g. inside @react-three/fiber) and
 * we want a real stack trace.
 *
 * tunnelRoute proxies Sentry traffic through our own /monitoring endpoint
 * so client-side ad blockers do not silently drop telemetry. The proxy
 * matcher (src/proxy.ts) excludes this path so Sentry events do not
 * trigger an auth.getUser() refresh on every beacon.
 */
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  // disableLogger is webpack-only and emits a deprecation warning under
  // Turbopack. Next 16 defaults to Turbopack, so we drop the flag.
});
