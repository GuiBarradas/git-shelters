import { describe, expect, it } from "vitest";

import { buildableSlot, resourceAlert } from "@/components/hud/resourceAlert";
import { workforce } from "@/lib/economy/resources";
import { RATES } from "@/lib/economy/tick";
import type { Fork } from "@/lib/forks/catalog";
import { ROOM_CATALOG, type Room } from "@/lib/rooms/catalog";

const fork = (roomSlot: number | null) => ({ roomSlot }) as Fork;
const alertFor = (resources: { cache: number; uptime: number; payload?: number }, rooms: Room[], forks: Fork[], bytes: number | null = 500) =>
  resourceAlert({ resources: { payload: 0, ...resources }, work: workforce(forks, rooms), rooms, forks, bytes });

describe("resource alert", () => {
  it("stays quiet while there is power and food", () => {
    expect(alertFor({ cache: 10, uptime: 40 }, [], [])).toBeNull();
  });

  it("ranks a blackout above an empty pantry", () => {
    const alert = alertFor({ cache: 0, uptime: 0 }, [{ slot: 2, kind: "power_plant" }, { slot: 1, kind: "cache_storage" }], [fork(null)]);
    expect(alert).toMatchObject({ kind: "blackout", roomKind: "power_plant", role: "Engineer", room: { slot: 2, staffed: false } });
  });

  it("points at the right kind of room, not the first unstaffed one", () => {
    // An unstaffed Workshop in slot 1 must not be picked for a pantry alert.
    const rooms: Room[] = [{ slot: 1, kind: "workshop" }, { slot: 2, kind: "power_plant" }, { slot: 3, kind: "cache_storage" }];
    const alert = alertFor({ cache: 0, uptime: 50 }, rooms, [fork(2)]);
    expect(alert).toMatchObject({ kind: "pantry", roomKind: "cache_storage", role: "Cook", room: { slot: 3, staffed: false } });
  });

  it("does not claim a missing worker when the room is staffed", () => {
    const rooms: Room[] = [{ slot: 1, kind: "power_plant" }, { slot: 2, kind: "power_plant" }];
    const alert = alertFor({ cache: 10, uptime: 0 }, rooms, [fork(2)]);
    expect(alert?.room).toEqual({ slot: 2, staffed: true });
    expect(alert?.ratePerHour).toBe(RATES.engineerPerHour - RATES.drainPerHour);
  });

  it("reports the kitchen's net rate: exactly even, or still losing", () => {
    const crew = (n: number) => [fork(1), ...Array.from({ length: n - 1 }, () => fork(null))];
    const kitchen: Room[] = [{ slot: 1, kind: "cache_storage" }];
    // One Cook makes 6 an hour: six mouths break even, eight lose 2.
    expect(alertFor({ cache: 0, uptime: 50 }, kitchen, crew(6))).toMatchObject({ room: { slot: 1, staffed: true }, ratePerHour: 0 });
    expect(alertFor({ cache: 0, uptime: 50 }, kitchen, crew(8))).toMatchObject({ room: { slot: 1, staffed: true }, ratePerHour: -2 });
  });

  it("offers the catalog cost and the first free ground slot when nothing is built", () => {
    const alert = alertFor({ cache: 10, uptime: 0 }, [{ slot: 1, kind: "dorm" }], [fork(null)]);
    expect(alert?.room).toBeNull();
    expect(alert?.build).toEqual({ cost: ROOM_CATALOG.power_plant.cost, slot: 2, missing: 0 });
    expect(buildableSlot(alert)).toBe(2);
  });

  it("only reaches the lower floor past an Elevator", () => {
    const full: Room[] = [
      { slot: 1, kind: "dorm" }, { slot: 2, kind: "dorm" }, { slot: 3, kind: "workshop" }, { slot: 4, kind: "dorm" },
    ];
    expect(alertFor({ cache: 10, uptime: 0 }, full, [])?.build?.slot).toBeNull();
    expect(buildableSlot(alertFor({ cache: 10, uptime: 0 }, full, []))).toBeNull();
    const withLift: Room[] = [...full.slice(0, 3), { slot: 4, kind: "elevator" }];
    expect(alertFor({ cache: 10, uptime: 0 }, withLift, [])?.build?.slot).toBe(5);
  });

  it("has no action when the player cannot afford it or the balance is unknown", () => {
    const short = alertFor({ cache: 0, uptime: 50 }, [], [], 20);
    expect(short?.build).toMatchObject({ slot: 1, missing: ROOM_CATALOG.cache_storage.cost - 20 });
    expect(buildableSlot(short)).toBeNull();
    expect(buildableSlot(alertFor({ cache: 0, uptime: 50 }, [], [], null))).toBeNull();
  });
});
