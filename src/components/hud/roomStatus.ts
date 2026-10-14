import { RATES, ratesPerHour, type ResourceState, type Workforce } from "@/lib/economy/tick";
import { BEDS_PER_DORM } from "@/lib/forks/catalog";
import { JOB_BY_ROOM } from "@/lib/forks/jobs";
import { LOCKED_SLOT_BLURB, ROOM_CATALOG, type RoomKind } from "@/lib/rooms/catalog";

/** What the scene's hover card says about one cell. Lines that have nothing true to say are null. */
export type RoomStatus = {
  title: string;
  /** Who works here, by name. No capacity: the game has none. */
  workers: string | null;
  /** This room's own gross output per hour (same rates and power rule as the simulation). */
  rate: string | null;
  /** Bunker-wide context, kept apart from the room's own number. */
  note: string | null;
  action: string | null;
};

const MIN_ROOM_COST = Math.min(...Object.values(ROOM_CATALOG).map((r) => r.cost));

/** This room alone, with `n` of its workers and nobody else eating. */
function alone(kind: RoomKind, n: number): Workforce {
  return {
    cooks: kind === "cache_storage" ? n : 0,
    engineers: kind === "power_plant" ? n : 0,
    tinkerers: kind === "workshop" ? n : 0,
    forks: 0,
    cacheStorages: kind === "cache_storage" ? 1 : 0,
    powerPlants: kind === "power_plant" ? 1 : 0,
    workshops: kind === "workshop" ? 1 : 0,
  };
}

/**
 * What this room adds per hour: ratesPerHour of the room alone minus the
 * same room with nobody in it. The difference cancels the bunker-wide
 * drain and appetite, which the card shows on their own line.
 */
export function roomGross(kind: RoomKind, n: number, powered: boolean): ResourceState {
  const staffed = ratesPerHour(alone(kind, n), powered);
  const empty = ratesPerHour(alone(kind, 0), powered);
  return { cache: staffed.cache - empty.cache, uptime: staffed.uptime - empty.uptime, payload: staffed.payload - empty.payload };
}

function crew(title: string, names: string[]): string {
  if (names.length === 0) return `no ${title}`;
  const label = names.length === 1 ? title : `${names.length} ${title.endsWith("ing") ? title : `${title}s`}`;
  return `${label} · ${names.join(", ")}`;
}

/**
 * `kind` null with `slot` 0 is the Main Branch; null elsewhere is an empty
 * cell, `locked` when it sits below a missing Elevator. `here` are the
 * Forks standing in this cell; `crewSize` is everyone in the bunker.
 */
export function roomStatus({ slot, kind, here, crewSize, powered, locked = false }: {
  slot: number;
  kind: RoomKind | null;
  here: ReadonlyArray<{ name: string }>;
  crewSize: number;
  powered: boolean;
  locked?: boolean;
}): RoomStatus {
  const names = here.map((f) => f.name);
  if (slot === 0) {
    return {
      title: "Main Branch",
      workers: names.length ? `${names.length} off shift · ${names.join(", ")}` : "nobody off shift",
      rate: null,
      note: null,
      action: "> click to enter",
    };
  }
  if (kind === null) {
    return locked
      ? { title: "Lower floor", workers: null, rate: null, note: LOCKED_SLOT_BLURB, action: null }
      : { title: "Empty slot", workers: null, rate: null, note: null, action: `+ BUILD · rooms from ${MIN_ROOM_COST} B` };
  }

  const gross = roomGross(kind, names.length, powered);
  const dark = powered ? "" : " · no power";
  let rate: string | null = null;
  let note: string | null = null;
  switch (kind) {
    case "cache_storage":
      // Kitchens only cook with the lights on (ratesPerHour's power rule).
      rate = `+${gross.cache} meals/h${dark}`;
      note = `crew eats ${crewSize * RATES.eatPerHour}/h, whole bunker`;
      break;
    case "power_plant":
      // Engineers charge even in a blackout; that is how the lights come back.
      rate = `+${gross.uptime}%/h charge`;
      note = `bunker drain −${RATES.drainPerHour}%/h`;
      break;
    case "workshop":
      rate = `+${gross.payload} rounds/h${dark}`;
      break;
    case "dorm":
      note = `${BEDS_PER_DORM} beds`;
      break;
    case "elevator":
      break;
  }
  return { title: ROOM_CATALOG[kind].name, workers: crew(JOB_BY_ROOM[kind].title, names), rate, note, action: "> click to enter" };
}
