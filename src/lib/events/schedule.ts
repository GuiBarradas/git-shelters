/** Daily events are limited by UTC calendar day, not 24 hours after a choice. */
export function nextPacketAt(now: string): string {
  const date = new Date(now);
  date.setUTCHours(24, 0, 0, 0);
  return date.toISOString();
}
