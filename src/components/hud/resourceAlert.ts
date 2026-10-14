import { ratesPerHour, type ResourceState, type Workforce } from "@/lib/economy/tick";
import { JOB_BY_ROOM } from "@/lib/forks/jobs";
import { GROUND_SLOTS, hasElevator, LOWER_SLOTS, ROOM_CATALOG, type Room, type Slot } from "@/lib/rooms/catalog";

/**
 * What is blocking the economy right now, and which room fixes it. Pure
 * presentation over existing state: the AlertBanner reads it today, the
 * scene's "blocked room" outline can read the same thing later.
 */
export type ResourceAlert = {
  /** Blackout outranks an empty pantry: without power nobody cooks anyway. */
  kind: "blackout" | "pantry";
  roomKind: "power_plant" | "cache_storage";
  role: "Engineer" | "Cook";
  /** The room to send the player to; null when none is built. */
  room: { slot: Slot; staffed: boolean } | null;
  /** Net change per hour of the empty resource (ratesPerHour): > 0 climbing back, 0 stuck, < 0 still losing. */
  ratePerHour: number;
  /** Only when no such room exists: what building one takes. */
  build: { cost: number; slot: Slot | null; missing: number | null } | null;
};

export function resourceAlert({ resources, work, rooms, forks, bytes }: {
  resources: ResourceState;
  work: Workforce;
  rooms: Room[];
  forks: ReadonlyArray<{ roomSlot: number | null }>;
  bytes: number | null;
}): ResourceAlert | null {
  const kind = resources.uptime <= 0 ? "blackout" : resources.cache <= 0 ? "pantry" : null;
  if (!kind) return null;
  const roomKind = kind === "blackout" ? "power_plant" : "cache_storage";
  const rates = ratesPerHour(work, resources.uptime > 0);

  const candidates = rooms.filter((r) => r.kind === roomKind);
  const staffed = candidates.find((r) => forks.some((f) => f.roomSlot === r.slot));
  const target = staffed ?? candidates[0];

  let build: ResourceAlert["build"] = null;
  if (!target) {
    const cost = ROOM_CATALOG[roomKind].cost;
    // Same gate as the build menu: ground floor first, lower floor only past an Elevator.
    const open = [...GROUND_SLOTS, ...(hasElevator(rooms) ? LOWER_SLOTS : [])];
    const slot = open.find((s) => !rooms.some((r) => r.slot === s)) ?? null;
    build = { cost, slot, missing: bytes === null ? null : Math.max(0, cost - bytes) };
  }

  return {
    kind,
    roomKind,
    role: kind === "blackout" ? "Engineer" : "Cook",
    room: target ? { slot: target.slot, staffed: !!staffed } : null,
    ratePerHour: kind === "blackout" ? rates.uptime : rates.cache,
    build,
  };
}

/** Producer rooms in the order a gap hurts most: no power stops the other two. */
const STAFFING_ORDER = ["power_plant", "cache_storage", "workshop"] as const;
export type StaffingTarget = { slot: Slot; kind: (typeof STAFFING_ORDER)[number]; role: string };

/**
 * The one room that should get a worker next, shared by the onboarding
 * card and the scene's "+ ASSIGN" chip so they never disagree. While an
 * alert is up only its own room counts, and only if nobody works there.
 * Otherwise an idle Fork (no room) is needed, and power comes first.
 */
export function staffingTarget({ alert, rooms, forks }: {
  alert: ResourceAlert | null;
  rooms: Room[];
  forks: ReadonlyArray<{ roomSlot: number | null }>;
}): StaffingTarget | null {
  if (alert) {
    return alert.room && !alert.room.staffed
      ? { slot: alert.room.slot, kind: alert.roomKind, role: JOB_BY_ROOM[alert.roomKind].title }
      : null;
  }
  if (!forks.some((f) => !f.roomSlot)) return null;
  for (const kind of STAFFING_ORDER) {
    const room = rooms.find((r) => r.kind === kind && !forks.some((f) => f.roomSlot === r.slot));
    if (room) return { slot: room.slot, kind, role: JOB_BY_ROOM[kind].title };
  }
  return null;
}

/** A build the player can start right now: a free slot and enough Bytes. */
export function buildableSlot(alert: ResourceAlert | null): Slot | null {
  return alert?.build?.slot != null && alert.build.missing === 0 ? alert.build.slot : null;
}
