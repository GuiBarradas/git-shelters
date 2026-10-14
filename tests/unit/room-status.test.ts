import { describe, expect, it } from "vitest";

import { roomGross, roomStatus } from "@/components/hud/roomStatus";
import { RATES, ratesPerHour } from "@/lib/economy/tick";
import { LOCKED_SLOT_BLURB, ROOM_CATALOG } from "@/lib/rooms/catalog";

const crew = (...names: string[]) => names.map((name) => ({ name }));

describe("room hover card", () => {
  it("names the workers without inventing a capacity", () => {
    const one = roomStatus({ slot: 2, kind: "power_plant", here: crew("Rafa"), crewSize: 3, powered: true });
    expect(one.title).toBe("Power Plant");
    expect(one.workers).toBe("Engineer · Rafa");
    expect(JSON.stringify(one)).not.toMatch(/\d\/\d/);
    expect(roomStatus({ slot: 1, kind: "cache_storage", here: crew("Ada", "Sol"), crewSize: 3, powered: true }).workers).toBe("2 Cooks · Ada, Sol");
    expect(roomStatus({ slot: 3, kind: "workshop", here: [], crewSize: 3, powered: true }).workers).toBe("no Tinkerer");
  });

  it("keeps the room's own output apart from the bunker drain", () => {
    const plant = roomStatus({ slot: 2, kind: "power_plant", here: crew("Rafa"), crewSize: 2, powered: true });
    expect(plant.rate).toBe(`+${RATES.engineerPerHour}%/h charge`);
    expect(plant.note).toBe(`bunker drain −${RATES.drainPerHour}%/h`);
    const kitchen = roomStatus({ slot: 1, kind: "cache_storage", here: crew("Ada"), crewSize: 4, powered: true });
    expect(kitchen.rate).toBe(`+${RATES.cookPerHour} meals/h`);
    expect(kitchen.note).toBe(`crew eats ${4 * RATES.eatPerHour}/h, whole bunker`);
  });

  it("reads its numbers from ratesPerHour, net of the empty room's baseline", () => {
    // Three Engineers in the only Power Plant, nobody else: the bunker's net is gross minus drain.
    const work = { cooks: 0, engineers: 3, tinkerers: 0, forks: 3, cacheStorages: 0, powerPlants: 1, workshops: 0 };
    expect(roomGross("power_plant", 3, true).uptime).toBe(ratesPerHour(work, true).uptime + RATES.drainPerHour);
    // Two Cooks, nobody eating: gross food is the whole cache rate.
    const kitchen = { ...work, engineers: 0, cooks: 2, forks: 0, cacheStorages: 1, powerPlants: 0 };
    expect(roomGross("cache_storage", 2, true).cache).toBe(ratesPerHour(kitchen, true).cache);
    expect(roomStatus({ slot: 1, kind: "cache_storage", here: crew("Ada", "Sol"), crewSize: 2, powered: true }).rate)
      .toBe(`+${ratesPerHour(kitchen, true).cache} meals/h`);
  });

  it("is honest about dormant rooms", () => {
    expect(roomStatus({ slot: 1, kind: "cache_storage", here: crew("Ada"), crewSize: 1, powered: false }).rate).toBe("+0 meals/h · no power");
    expect(roomStatus({ slot: 3, kind: "workshop", here: [], crewSize: 1, powered: true }).rate).toBe("+0 rounds/h");
    // Engineers still charge in a blackout: that is how the lights come back.
    expect(roomStatus({ slot: 2, kind: "power_plant", here: [], crewSize: 1, powered: false }).rate).toBe("+0%/h charge");
  });

  it("prices empty cells from the catalog and explains locked ones", () => {
    const min = Math.min(...Object.values(ROOM_CATALOG).map((r) => r.cost));
    expect(roomStatus({ slot: 4, kind: null, here: [], crewSize: 1, powered: true }).action).toBe(`+ BUILD · rooms from ${min} B`);
    const locked = roomStatus({ slot: 6, kind: null, here: [], crewSize: 1, powered: true, locked: true });
    expect(locked.note).toBe(LOCKED_SLOT_BLURB);
    expect(locked.action).toBeNull();
  });

  it("lists who is off shift on the Main Branch", () => {
    expect(roomStatus({ slot: 0, kind: null, here: crew("Hex"), crewSize: 2, powered: true }).workers).toBe("1 off shift · Hex");
  });
});
