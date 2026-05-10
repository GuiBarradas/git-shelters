/**
 * Known automation account logins on GitHub.
 *
 * Every entry here closes a vector: a user enabling that bot on their repo
 * and harvesting bytes from its automated commits. Adding a new entry is a
 * code change, intentionally — it goes through PR review like any other
 * trust-relevant rule.
 *
 * Pattern detection in code also recognises the generic `*[bot]` suffix
 * convention GitHub enforces for App accounts; this list is the
 * exact-match fallback for non-suffix automation accounts.
 */

export const KNOWN_BOT_LOGINS: ReadonlySet<string> = new Set([
  "dependabot",
  "github-actions",
  "renovate",
  "imgbot",
  "snyk-bot",
  "allcontributors",
  "codecov",
  "stale",
  "mergify",
  "semantic-release-bot",
]);

/**
 * Returns true if the given GitHub login looks like an automation account.
 * Matches either the `*[bot]` suffix (App convention) or any entry in
 * KNOWN_BOT_LOGINS (case-insensitive).
 */
export function isBotLogin(login: string): boolean {
  if (login.endsWith("[bot]")) return true;
  return KNOWN_BOT_LOGINS.has(login.toLowerCase());
}
