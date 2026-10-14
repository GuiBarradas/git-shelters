import { describe, expect, it } from "vitest";

import { generateBunker, generateIdentity, generateRoom } from "@/lib/visuals/generate";
import { KINDS, SLOT_LIBRARY, type SlotDef } from "@/lib/visuals/slots";
import { PROP_KINDS, ROOM_KINDS, type PropDescriptor, type VisualEvolution } from "@/lib/visuals/types";

const SEEDS = Array.from({ length: 120 }, (_, i) => 31 + i * 104729);
const EVOLUTIONS: (VisualEvolution | undefined)[] = [
  undefined,
  { commitCount: 0, contributorCount: 1, recentActivity: 0 },
  { commitCount: 9000, contributorCount: 80, recentActivity: 1, dominantLanguages: [{ name: "Python", weight: 1 }] },
];

/** Independent AABB of a box rotated about Y, from the documented convention (bottom-center position). */
type Span = [number, number];
function aabb(p: PropDescriptor): { x: Span; y: Span; z: Span } {
  const c = Math.abs(Math.cos(p.rotationY));
  const s = Math.abs(Math.sin(p.rotationY));
  const hx = (c * p.size[0] + s * p.size[2]) / 2;
  const hz = (s * p.size[0] + c * p.size[2]) / 2;
  return { x: [p.position[0] - hx, p.position[0] + hx], y: [p.position[1], p.position[1] + p.size[1]], z: [p.position[2] - hz, p.position[2] + hz] };
}
const hit = (a: ReturnType<typeof aabb>, b: ReturnType<typeof aabb>) =>
  (["x", "y", "z"] as const).every((k) => a[k][1] > b[k][0] + 1e-6 && b[k][1] > a[k][0] + 1e-6);

function numbers(p: PropDescriptor): number[] {
  return [...p.position, ...p.scale, ...p.size, p.rotationY, p.variant, ...(p.texture ? [p.texture.seed] : [])];
}

describe("generated rooms", () => {
  it("holds every invariant for every room kind over many seeds", () => {
    const kindsSeen = new Set<string>();
    for (const seed of SEEDS) {
      const identity = generateIdentity(seed);
      for (const kind of ROOM_KINDS) {
        for (const evo of EVOLUTIONS) {
          const { props } = generateRoom(identity, kind, 3, evo);
          const label = `${seed}/${kind}`;
          expect(props.length, label).toBeGreaterThanOrEqual(8);
          expect(props.length, label).toBeLessThanOrEqual(15);
          expect(new Set(props.map((p) => p.id)).size, label).toBe(props.length);
          expect(props.some((p) => p.kind === "lamp" && p.state.lit), label).toBe(true);
          if (kind !== "main") {
            const board = props.find(p => p.slot === "board");
            expect(board?.size[0], `${label} readable panel width`).toBeGreaterThanOrEqual(kind === "elevator" ? 0.85 : 1.17);
            expect(board?.size[1], `${label} readable panel height`).toBeGreaterThanOrEqual(kind === "elevator" ? 0.65 : 0.99);
          }

          for (const p of props) {
            kindsSeen.add(p.kind);
            expect(numbers(p).every(Number.isFinite), label).toBe(true);
            expect(KINDS[p.kind].tags, `${label} ${p.id}`).toContain(p.tag);
            expect(p.color).toMatch(/^#[0-9A-F]{6}$/);
            for (const s of p.scale) expect(s >= 0.9 && s <= 1.1, `${label} ${p.id} scale`).toBe(true);
            expect(Math.abs(p.rotationY)).toBeLessThanOrEqual(Math.PI + 0.6);
            if (p.layer === "wall") expect(p.rotationY).toBe(0);

            const box = aabb(p);
            expect(box.x[0] >= -2 - 1e-6 && box.x[1] <= 2 + 1e-6, `${label} ${p.id} x`).toBe(true);
            expect(box.y[0] >= 0 && box.y[1] <= 3 + 1e-6, `${label} ${p.id} y`).toBe(true);
            expect(box.z[0] >= -1.25 - 1e-6, `${label} ${p.id} back`).toBe(true);
            expect(box.z[1], `${label} ${p.id} lane`).toBeLessThanOrEqual(0.8 + 1e-6);

            if (p.layer === "surface") {
              const support = props.find((s) => s.slot === p.support);
              expect(support, `${label} ${p.id} support`).toBeDefined();
              expect(p.position[1]).toBeCloseTo(support!.position[1] + support!.size[1], 3);
            }
          }

          // Same layer group (rugs vs rugs, everything else vs everything else) never overlaps,
          // except a prop resting on its own support.
          for (const a of props) {
            for (const b of props) {
              if (a === b || a.support === b.slot || b.support === a.slot) continue;
              if ((a.kind === "rug") !== (b.kind === "rug")) continue;
              expect(hit(aabb(a), aabb(b)), `${label} ${a.id} x ${b.id}`).toBe(false);
            }
          }
        }
      }
    }
    // The library exercises the whole prop vocabulary (signatures are covered below).
    const common = PROP_KINDS.filter((k) => k !== "aquarium" && k !== "cat" && k !== "flag");
    for (const kind of common) expect(kindsSeen.has(kind), kind).toBe(true);
  }, 60_000);

  it("pins the Main Branch desk set and keeps the resident's lane clear", () => {
    const lane = { x: [-0.65, 0.05], y: [0, 2], z: [0, 0.8] } as { x: Span; y: Span; z: Span };
    for (const seed of SEEDS) {
      const { props } = generateRoom(generateIdentity(seed), "main", 0);
      const get = (slot: string) => props.find((p) => p.slot === slot)!;
      expect(get("desk")).toMatchObject({ position: [0.6, 0, -0.55], size: [1.9, 0.8, 1], rotationY: 0 });
      expect(get("monitor")).toMatchObject({ position: [0.6, 0.8, -0.63], size: [1.12, 0.96, 0.38], rotationY: 0 });
      expect(get("chair")).toMatchObject({ position: [-0.32, 0, 0.28], size: [0.52, 1.02, 0.5], rotationY: 2.792 });
      expect(get("desk-lamp").state.lit).toBe(true);
      expect(get("rack")).toMatchObject({ position: [-1.45, 0, -1], size: [0.75, 2.05, 0.5] });
      for (const p of props) {
        if (p.kind !== "rug" && p.slot !== "chair") expect(hit(aabb(p), lane), `${seed} ${p.id}`).toBe(false);
      }
    }
  });

  it("puts each room's hero piece in place", () => {
    const hero = { main: "desk", power_plant: "generator", dorm: "bunk", workshop: "workbench", cache_storage: "rack", elevator: "lamp" } as const;
    for (const seed of SEEDS.slice(0, 20)) {
      for (const kind of ROOM_KINDS) {
        expect(generateRoom(generateIdentity(seed), kind, 1).props.some((p) => p.kind === hero[kind])).toBe(true);
      }
    }
  });

  it("places the bunker signature in the Main Branch", () => {
    const withSig = SEEDS.concat(Array.from({ length: 400 }, (_, i) => 900_000 + i)).map(generateIdentity).filter((i) => i.signature);
    expect(withSig.length).toBeGreaterThan(0);
    for (const identity of withSig) {
      expect(generateRoom(identity, "main", 0).props.some((p) => p.kind === identity.signature)).toBe(true);
    }
  });

  it("keeps room results when rooms are added or reordered", () => {
    const before = generateBunker(777, undefined, [{ slot: 0, kind: "main" }, { slot: 2, kind: "dorm" }]);
    const after = generateBunker(777, undefined, [
      { slot: 6, kind: "workshop" },
      { slot: 2, kind: "dorm" },
      { slot: 1, kind: "power_plant" },
      { slot: 0, kind: "main" },
    ]);
    expect(after.rooms.map((r) => r.slot)).toEqual([0, 1, 2, 6]);
    expect(after.rooms.find((r) => r.slot === 0)).toEqual(before.rooms[0]);
    expect(after.rooms.find((r) => r.slot === 2)).toEqual(before.rooms[1]);
    // Two rooms of the same kind in different slots are not clones.
    expect(generateRoom(after.identity, "dorm", 3).props).not.toEqual(generateRoom(after.identity, "dorm", 4).props);
    expect(() => generateBunker(777, undefined, [{ slot: 1, kind: "dorm" }, { slot: 1, kind: "main" }])).toThrow(RangeError);
  });

  it("does not move existing props when a new slot joins the library", () => {
    const library = SLOT_LIBRARY.cache_storage as SlotDef[];
    const extra: SlotDef = { id: "test-extra", tag: "wall-low", kinds: [["note", 1]], x: 0.55, y: 0.55, chance: 1 };
    let added = 0;
    for (const seed of SEEDS.slice(0, 40)) {
      const identity = generateIdentity(seed);
      const before = generateRoom(identity, "cache_storage", 1).props;
      library.push(extra);
      try {
        const after = generateRoom(identity, "cache_storage", 1).props;
        if (after.some((p) => p.slot === "test-extra")) added++;
        for (const p of after) {
          const old = before.find((o) => o.id === p.id);
          if (old) expect(p).toEqual(old);
        }
      } finally {
        library.pop();
      }
    }
    expect(added).toBeGreaterThan(0);
  });
});
