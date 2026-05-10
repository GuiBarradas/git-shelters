/**
 * Pure cap-enforcer for the daily byte limit on `source = github_sync`.
 *
 * Caller is responsible for computing `capRemaining` from the database
 * (cap minus already-credited bytes today). This function takes the
 * proposed credits and the room left, and returns the prefix of credits
 * that fits.
 *
 * Atomicity: a credit is never partially applied. If a credit would push
 * the cumulative delta over the cap, it is dropped whole and iteration
 * stops. Subsequent credits are NOT skipped past — even if a smaller
 * credit later in the array would fit. This keeps the policy deterministic
 * and easy to reason about: "we always credit the prefix that fits".
 *
 * Compensating rows (delta ≤ 0) do not consume cap budget. They pass
 * through freely; the cap is on positive credit volume only.
 */

type Credit = {
  delta: number;
  source: string;
  source_ref: string;
};

export function applyDailyCap<C extends Credit>(
  credits: C[],
  capRemaining: number,
): C[] {
  if (capRemaining <= 0) return [];

  const accepted: C[] = [];
  let consumed = 0;

  for (const credit of credits) {
    const cost = credit.delta > 0 ? credit.delta : 0;

    if (cost === 0) {
      // Compensating row — does not consume budget.
      accepted.push(credit);
      continue;
    }

    if (consumed + cost > capRemaining) {
      // Atomic drop: this credit cannot fit, and we stop here to keep
      // the policy "credit the prefix that fits".
      break;
    }

    accepted.push(credit);
    consumed += cost;
  }

  return accepted;
}
