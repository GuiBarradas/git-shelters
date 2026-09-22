/**
 * The bunker's resource simulation (design doc §4, §5, §10.3.1).
 *
 * Pure: no clock, no I/O. The caller passes the stored state, who works
 * where, and how much time passed; it gets the new state back. Running
 * it once for 3 hours or 36 times for 5 minutes must agree, so every
 * rate is linear and the caps are applied at the end.
 *
 * Units: Cache is meals in store; Uptime is a 0..100 charge; Payload is
 * rounds packed for the day the crawlers come.
 */

export type ResourceState = { cache: number; uptime: number; payload: number };

export type Workforce = {
  /** Forks assigned to a Cache Storage. */
  cooks: number;
  /** Forks assigned to a Power Plant. */
  engineers: number;
  /** Forks assigned to a Workshop. */
  tinkerers: number;
  /** Every survivor, working or not. They all eat. */
  forks: number;
  /** Built Cache Storages; each adds shelf space. */
  cacheStorages: number;
  /** Built Power Plants; with none, nothing charges. */
  powerPlants: number;
  /** Built Workshops; each holds a rack of Payload. */
  workshops: number;
};

export const RATES = {
  /** Meals one cook puts on the shelf per hour. */
  cookPerHour: 6,
  /** Meals one survivor eats per hour. */
  eatPerHour: 1,
  /** Uptime one engineer adds per hour. */
  engineerPerHour: 25,
  /** Uptime the bunker burns per hour just existing. */
  drainPerHour: 8,
  /** Rounds one tinkerer packs per hour. Nothing spends them yet. */
  tinkerPerHour: 2,
  /** Rack space per Workshop; with none, nothing is stored. */
  payloadCapPerWorkshop: 30,
  /** Shelf space per Cache Storage, plus a pantry in the Main Branch. */
  cacheCapBase: 40,
  cacheCapPerStorage: 120,
  uptimeCap: 100,
  /** Longest absence the simulation will account for, in hours. */
  maxHours: 24 * 7,
} as const;

export type TickResult = ResourceState & {
  /** Nobody could eat for part of the window. */
  starved: boolean;
  /** The charge hit zero during the window. */
  blackout: boolean;
};

export function cacheCap(cacheStorages: number): number {
  return RATES.cacheCapBase + RATES.cacheCapPerStorage * cacheStorages;
}

export function payloadCap(workshops: number): number {
  return RATES.payloadCapPerWorkshop * workshops;
}

export function simulate(state: ResourceState, work: Workforce, hours: number): TickResult {
  const h = Math.min(RATES.maxHours, Math.max(0, hours));

  // Kitchens only cook when the lights are on; a dead plant still drains.
  const powered = state.uptime > 0 || (work.engineers > 0 && work.powerPlants > 0);

  const cooked = powered ? work.cooks * RATES.cookPerHour * h : 0;
  const eaten = work.forks * RATES.eatPerHour * h;
  const rawCache = state.cache + cooked - eaten;
  const cache = Math.min(cacheCap(work.cacheStorages), Math.max(0, rawCache));

  const charged = work.powerPlants > 0 ? work.engineers * RATES.engineerPerHour * h : 0;
  const rawUptime = state.uptime + charged - RATES.drainPerHour * h;
  const uptime = Math.min(RATES.uptimeCap, Math.max(0, rawUptime));

  // The bench needs light too; rounds keep once packed.
  const packed = powered ? work.tinkerers * RATES.tinkerPerHour * h : 0;
  const payload = Math.min(payloadCap(work.workshops), Math.max(0, state.payload + packed));

  return {
    cache: Math.round(cache),
    uptime: Math.round(uptime),
    payload: Math.round(payload),
    starved: rawCache < 0,
    blackout: rawUptime <= 0,
  };
}

export function hoursBetween(fromIso: string, to: Date): number {
  return Math.max(0, (to.getTime() - Date.parse(fromIso)) / 3_600_000);
}
