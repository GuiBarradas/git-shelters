import path from "node:path";

import { defineConfig } from "vitest/config";

/**
 * Integration test config — hits the live remote Supabase (dev project).
 *
 * Run via `pnpm test:integration`. Excluded from the default `pnpm test`
 * run so that CI (which has no Supabase secrets) and the fast unit-test
 * inner loop both stay green.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/integration/setup.ts"],
    include: ["tests/integration/**/*.{test,spec}.{ts,tsx}"],
    // Integration tests cross the network; the fast inner-loop unit timeout
    // (5s) would flake on cold connections. Bump to 15s.
    testTimeout: 15_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
