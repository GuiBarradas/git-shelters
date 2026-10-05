import {
  cacheCap,
  payloadCap,
  poweredHours,
  RATES,
  type ResourceState,
  simulate,
  type TickResult,
  type Workforce,
} from "@/lib/economy/tick";

/**
 * "If you walk away now": the same simulation the catch-up runs, pointed
 * forward. Pure, so the UI can show it next to the current numbers
 * without touching the stored state.
 */
export const FORECAST_HOURS = 8;

export type ForecastWarning =
  /** Cooks will make more than the shelves hold, net of what the crew eats. */
  | "cache_full"
  /** The rack will be full and the tinkerers keep packing. */
  | "payload_full"
  /** A Cache Storage stands with nobody cooking in it. */
  | "no_cooks"
  /** A Power Plant stands with nobody running it. */
  | "no_engineers"
  /** A Workshop stands with nobody at the bench. */
  | "no_tinkerers";

export type Forecast = TickResult & {
  /** End minus start, per resource. */
  delta: ResourceState;
  warnings: ForecastWarning[];
};

export function forecast(state: ResourceState, work: Workforce, hours = FORECAST_HOURS): Forecast {
  const after = simulate(state, work, hours);
  const warnings: ForecastWarning[] = [];

  // Only what is actually made counts as wasted: in the dark nothing is.
  const lit = poweredHours(state, work, hours);
  const h = Math.min(RATES.maxHours, Math.max(0, hours));
  const cooked = work.cooks * RATES.cookPerHour * lit;
  const packed = work.tinkerers * RATES.tinkerPerHour * lit;
  if (cooked > 0 && state.cache + cooked - work.forks * RATES.eatPerHour * h > cacheCap(work.cacheStorages)) {
    warnings.push("cache_full");
  }
  if (packed > 0 && state.payload + packed > payloadCap(work.workshops)) warnings.push("payload_full");
  if (work.cacheStorages > 0 && work.cooks === 0) warnings.push("no_cooks");
  if (work.powerPlants > 0 && work.engineers === 0) warnings.push("no_engineers");
  if (work.workshops > 0 && work.tinkerers === 0) warnings.push("no_tinkerers");

  return {
    ...after,
    delta: {
      cache: after.cache - state.cache,
      uptime: after.uptime - state.uptime,
      payload: after.payload - state.payload,
    },
    warnings,
  };
}
