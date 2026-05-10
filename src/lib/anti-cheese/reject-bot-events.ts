import type { GitHubEvent } from "@/lib/github/events";

import { isBotLogin } from "./bot-list";

/**
 * Strips events whose actor is a known automation account.
 *
 * Pure function: input → output, no I/O. The caller wires this into the
 * sync pipeline (server action and cron handler) before mapping events
 * to credits, so bot pushes never reach the ledger.
 *
 * Events with no `actor.login` are treated as suspicious and dropped —
 * better to lose a real event to a malformed payload than to credit an
 * anonymous one. The GitHub events API always returns `actor.login` for
 * legitimate events, so a missing login signals a partial / stale fetch.
 */
export function rejectBotEvents(events: GitHubEvent[]): GitHubEvent[] {
  return events.filter((event) => {
    const login = event.actor?.login;
    if (!login) return false;
    return !isBotLogin(login);
  });
}
