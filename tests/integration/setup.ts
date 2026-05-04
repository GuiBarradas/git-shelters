/**
 * Integration test setup.
 *
 * Loads .env.local into process.env so the Supabase admin client can pick up
 * the project URL and service-role key. The unit test runner does not need
 * this (no env-dependent code paths run there), so this lives in a separate
 * config and only gets imported by integration tests.
 */

import { config } from "dotenv";

config({ path: ".env.local" });

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

for (const key of REQUIRED) {
  if (!process.env[key]) {
    throw new Error(
      `Integration tests require ${key} in .env.local. ` +
        `Run \`cp .env.local.example .env.local\` and fill in real values.`,
    );
  }
}
