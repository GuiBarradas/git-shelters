/**
 * Pure byte-credit function.
 *
 * Given a previous timestamp, a current timestamp, and a rate descriptor,
 * returns how many bytes should be credited to the player. The function is
 * pure — no I/O, no time read, no Supabase, no GitHub. Side effects are the
 * caller's job (writing `byte_transactions` rows with idempotency, etc.).
 */

export type ByteEvent = {
  /** When the byte-generating event occurred (e.g. a GitHub commit timestamp). */
  occurredAt: Date;
  /** How many bytes the event is worth, after upstream filters. */
  bytes: number;
  /**
   * Stable, dedupable reference for the source row.
   * Used by the caller to populate `byte_transactions(source, source_ref)`
   * and benefit from the unique-constraint dedup at insert time.
   */
  sourceRef: string;
};

export type CreditRates = {
  /**
   * Passive byte rate per minute. 0 in the GitHub-driven Path A.
   * A future anonymous-mode (Path C) sets this > 0.
   */
  passiveBytesPerMinute: number;
  /** Discrete byte-generating events that occurred in (lastSeenAt, now]. */
  events: ByteEvent[];
};

export type CreditResult = {
  /** Total bytes the caller should credit (passive + event-based). */
  totalBytes: number;
  /** Bytes attributable to the passive idle rate. */
  passiveBytes: number;
  /** Bytes attributable to discrete events. */
  eventBytes: number;
  /**
   * The discrete events that contributed to the credit.
   * The caller writes one `byte_transactions` row per event using `sourceRef`.
   */
  events: ByteEvent[];
};

const MS_PER_MINUTE = 60_000;

export function creditBytes(
  lastSeenAt: Date,
  now: Date,
  rates: CreditRates,
): CreditResult {
  // Clamp elapsed time to a non-negative value: if the client's clock or DB
  // is skewed and lastSeenAt is in the future, we never want to credit
  // negative passive bytes (which would silently drain the player's balance).
  // Discrete events still credit normally — they carry their own timestamp.
  const elapsedMinutes = Math.max(
    0,
    (now.getTime() - lastSeenAt.getTime()) / MS_PER_MINUTE,
  );
  const passiveBytes = elapsedMinutes * rates.passiveBytesPerMinute;
  const eventBytes = rates.events.reduce((sum, event) => sum + event.bytes, 0);

  return {
    totalBytes: passiveBytes + eventBytes,
    passiveBytes,
    eventBytes,
    events: rates.events,
  };
}
