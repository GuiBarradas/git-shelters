import type { PropKind, Signature, SlotTag, Vec3, VisualPalette, VisualRoomKind } from "@/lib/visuals/types";

/**
 * Room space: x in [-2, 2], y in [0, 3], z in [-1.25, 1.25] with the back
 * wall at z = -1.25. The front lane (z >= 0.8) stays clear for walking.
 */
export const ROOM_BOUNDS = { min: [-2, 0, -1.25] as Vec3, max: [2, 3, 1.25] as Vec3 };
export const FRONT_LANE_Z = 0.8;
export const MIN_PROPS = 8;
export const MAX_PROPS = 15;

export interface KindSpec {
  /** Base box (w, h, d) at scale 1. */
  size: Vec3;
  tags: readonly SlotTag[];
  /** Finite variant count; "style" means the variant is the bunker's furniture style index. */
  variants: number | "style";
  colors: ReadonlyArray<keyof VisualPalette>;
}

export const KINDS: Record<PropKind, KindSpec> = {
  lamp: { size: [0.3, 1.5, 0.3], tags: ["ceiling", "desktop", "floor", "corner", "wall-high"], variants: 4, colors: ["warmLight"] },
  monitor: { size: [1.12, 0.96, 0.38], tags: ["desktop"], variants: 2, colors: ["emissive"] },
  desk: { size: [1.9, 0.8, 1.0], tags: ["floor"], variants: "style", colors: ["wood", "inset"] },
  chair: { size: [0.45, 0.85, 0.45], tags: ["floor"], variants: "style", colors: ["fabric", "wood"] },
  rack: { size: [0.9, 1.9, 0.45], tags: ["floor", "corner"], variants: "style", colors: ["inset", "concrete"] },
  board: { size: [1.0, 0.7, 0.05], tags: ["wall-high"], variants: 2, colors: ["wood", "inset"] },
  clock: { size: [0.3, 0.3, 0.05], tags: ["wall-high"], variants: 2, colors: ["inset", "wood"] },
  mug: { size: [0.09, 0.1, 0.09], tags: ["desktop"], variants: 3, colors: ["fabric", "concrete"] },
  planter: { size: [0.35, 0.5, 0.35], tags: ["floor", "corner"], variants: 3, colors: ["fabric", "wood"] },
  crate: { size: [0.6, 0.45, 0.5], tags: ["floor", "desktop"], variants: "style", colors: ["wood", "inset"] },
  books: { size: [0.3, 0.22, 0.18], tags: ["desktop"], variants: 3, colors: ["fabric", "wall"] },
  poster: { size: [0.5, 0.7, 0.02], tags: ["wall-high", "wall-low"], variants: 4, colors: ["fabric", "wall"] },
  note: { size: [0.15, 0.15, 0.01], tags: ["wall-high", "wall-low"], variants: 3, colors: ["fabric", "wall"] },
  rug: { size: [1.6, 0.02, 1.0], tags: ["floor"], variants: 3, colors: ["fabric", "wall"] },
  pipe: { size: [3.6, 0.12, 0.12], tags: ["ceiling", "wall-high"], variants: 2, colors: ["inset", "concrete"] },
  bunk: { size: [1.9, 1.6, 0.85], tags: ["floor"], variants: "style", colors: ["wood", "inset"] },
  generator: { size: [1.2, 1.3, 0.8], tags: ["floor"], variants: 2, colors: ["inset", "concrete"] },
  workbench: { size: [1.5, 0.9, 0.65], tags: ["floor"], variants: "style", colors: ["wood", "inset"] },
  cabinet: { size: [0.6, 1.2, 0.45], tags: ["floor", "corner"], variants: "style", colors: ["inset", "wood"] },
  aquarium: { size: [0.8, 0.9, 0.4], tags: ["floor", "corner"], variants: 1, colors: ["inset"] },
  cat: { size: [0.4, 0.25, 0.2], tags: ["floor", "desktop"], variants: 3, colors: ["inset"] },
  flag: { size: [0.7, 0.5, 0.02], tags: ["wall-high"], variants: 1, colors: ["fabric"] },
};

/** Lamps change form with their mount: the variant is the form. */
export const LAMP_FORMS: Partial<Record<SlotTag, { variant: number; size: Vec3 }>> = {
  ceiling: { variant: 0, size: [0.35, 0.4, 0.35] },
  desktop: { variant: 1, size: [0.18, 0.35, 0.18] },
  floor: { variant: 2, size: [0.3, 1.5, 0.3] },
  corner: { variant: 2, size: [0.3, 1.5, 0.3] },
  "wall-high": { variant: 3, size: [0.2, 0.25, 0.15] },
};

export interface SlotDef {
  id: string;
  tag: SlotTag;
  kinds: ReadonlyArray<readonly [PropKind, number]>;
  /** Room x, or local x on the support for desktop slots. */
  x: number;
  /** Bottom y for wall slots; floor is 0, ceiling and desktop are derived. */
  y?: number;
  /** Omitted: flush against the back wall. Local z for desktop slots. */
  z?: number;
  /** Flush against the left (-1) or right (1) wall instead of using x. */
  side?: -1 | 1;
  /** Position jitter amplitude (x, z). */
  jitter?: readonly [number, number];
  /** Base rotation and jitter amplitude, radians. Wall props never rotate. */
  rot?: readonly [number, number];
  /** Uniform scale amplitude around 1. Default 0.08. */
  scale?: number;
  /** Base chance for decorative slots; omitted means mandatory fixture. */
  chance?: number;
  /** Supporting slot id for desktop slots. */
  on?: string;
  /** Primary light: always lit, so no room goes dark. */
  light?: true;
  /** Placed only (and always) when the bunker carries this signature. */
  signature?: Signature;
  /** Base box for this slot only, overriding the kind's (and the lamp form's). */
  size?: Vec3;
  /** The resident's own seat: the one fixture allowed inside the reserved lane. */
  seat?: true;
}

export interface Box {
  min: Vec3;
  max: Vec3;
}

const one = (kind: PropKind) => [[kind, 1]] as const;
const CHAIR_ROT = [Math.PI, 0.35] as const;

/**
 * Authored per room: mandatory fixtures (hero piece + a primary light)
 * first, then decorative slots in priority order. New slots go at the end
 * so they can only lose a collision, never displace an existing prop.
 */
export const SLOT_LIBRARY: Record<VisualRoomKind, readonly SlotDef[]> = {
  // The desk set is pinned (no jitter, scale or turn) so the seated resident's
  // hands meet the keyboard and the HTML screen panel lines up with the monitor.
  main: [
    { id: "desk", tag: "floor", kinds: one("desk"), x: 0.6, z: -0.55, scale: 0 },
    { id: "monitor", tag: "desktop", kinds: one("monitor"), on: "desk", x: 0, z: -0.08, scale: 0, light: true },
    { id: "desk-lamp", tag: "desktop", kinds: one("lamp"), on: "desk", x: 0.7, z: -0.1, size: [0.2, 0.5, 0.2], light: true },
    { id: "chair", tag: "floor", kinds: one("chair"), x: -0.32, z: 0.28, rot: [Math.PI - 0.35, 0], scale: 0, size: [0.52, 1.02, 0.5], seat: true },
    { id: "ceiling-lamp", tag: "ceiling", kinds: one("lamp"), x: -0.2, z: -0.2 },
    { id: "rack", tag: "floor", kinds: one("rack"), x: -1.45, scale: 0, size: [0.75, 2.05, 0.5] },
    { id: "board", tag: "wall-high", kinds: one("board"), x: 0, y: 2.12 },
    { id: "sig-aquarium", tag: "floor", kinds: one("aquarium"), x: -1.35, z: 0.35, signature: "aquarium" },
    { id: "sig-cat", tag: "floor", kinds: one("cat"), x: -1.3, z: 0.4, rot: [0, 0.6], signature: "cat" },
    { id: "sig-flag", tag: "wall-high", kinds: one("flag"), x: -1.45, y: 2.35, scale: 0, signature: "flag" },
    { id: "desk-item", tag: "desktop", kinds: [["mug", 2], ["books", 1]], on: "desk", x: -0.7, z: 0.1, rot: [0, 0.3], chance: 0.6 },
    { id: "rug", tag: "floor", kinds: one("rug"), x: 0.4, z: 0.1, jitter: [0.1, 0.05], rot: [0, 0.06], chance: 0.5 },
    { id: "poster", tag: "wall-high", kinds: one("poster"), x: -0.78, y: 1.15, chance: 0.6 },
    { id: "note", tag: "wall-low", kinds: one("note"), x: -0.2, y: 1.0, jitter: [0.05, 0], chance: 0.5 },
    { id: "clock", tag: "wall-high", kinds: one("clock"), x: 1.6, y: 2.35, chance: 0.4 },
    { id: "planter", tag: "floor", kinds: one("planter"), x: 1.7, z: 0.5, chance: 0.4 },
    { id: "pipe", tag: "ceiling", kinds: one("pipe"), x: 0, z: -1.1, scale: 0, chance: 0.5 },
    { id: "sconce", tag: "wall-high", kinds: one("lamp"), x: 1.0, y: 2.15, chance: 0.4 },
    { id: "floor-lamp", tag: "corner", kinds: one("lamp"), x: 0, side: 1, chance: 0.3 },
  ],
  power_plant: [
    { id: "generator", tag: "floor", kinds: one("generator"), x: -0.9, jitter: [0.1, 0], rot: [0, 0.04] },
    { id: "ceiling-lamp", tag: "ceiling", kinds: one("lamp"), x: 0.4, z: -0.2, light: true },
    { id: "pipe", tag: "ceiling", kinds: one("pipe"), x: 0, z: -1.1, scale: 0 },
    { id: "board", tag: "wall-high", kinds: one("board"), x: 1.1, y: 1.85, size: [1.18, 1, 0.06], scale: 0 },
    { id: "wall-pipe", tag: "wall-high", kinds: one("pipe"), x: 0, y: 2.45, scale: 0, chance: 0.6 },
    { id: "cabinet", tag: "corner", kinds: [["cabinet", 2], ["rack", 1]], x: 0, side: 1, chance: 0.5 },
    { id: "cabinet-mid", tag: "floor", kinds: one("cabinet"), x: 0.45, chance: 0.4 },
    { id: "clock", tag: "wall-high", kinds: one("clock"), x: -0.9, y: 1.6, jitter: [0.1, 0], chance: 0.5 },
    { id: "crate", tag: "floor", kinds: one("crate"), x: 0.6, z: 0.25, jitter: [0.15, 0.1], rot: [0, 0.3], chance: 0.5 },
    { id: "crate-2", tag: "floor", kinds: one("crate"), x: 1.45, z: 0.35, jitter: [0.05, 0.05], rot: [0, 0.3], chance: 0.4 },
    { id: "sconce", tag: "wall-high", kinds: one("lamp"), x: 0.1, y: 1.9, chance: 0.5 },
    { id: "note", tag: "wall-low", kinds: one("note"), x: 0.25, y: 1.0, chance: 0.4 },
    { id: "poster", tag: "wall-high", kinds: one("poster"), x: -1.7, y: 1.55, chance: 0.5 },
    { id: "planter", tag: "floor", kinds: one("planter"), x: -1.7, z: 0.45, chance: 0.3 },
    { id: "floor-lamp", tag: "floor", kinds: one("lamp"), x: 0, jitter: [0.05, 0], chance: 0.3 },
  ],
  dorm: [
    { id: "bunk", tag: "floor", kinds: one("bunk"), x: -1.0, scale: 0.03 },
    { id: "ceiling-lamp", tag: "ceiling", kinds: one("lamp"), x: 0.5, z: -0.1, light: true },
    { id: "rug", tag: "floor", kinds: one("rug"), x: 0.5, z: 0.1, jitter: [0.2, 0.08], rot: [0, 0.08] },
    { id: "board", tag: "wall-high", kinds: one("board"), x: 1.0, y: 1.85, size: [1.18, 1, 0.06], scale: 0 },
    { id: "bunk-2", tag: "floor", kinds: one("bunk"), x: 1.0, scale: 0.03, chance: 0.45 },
    { id: "cabinet", tag: "corner", kinds: one("cabinet"), x: 0, side: 1, chance: 0.6 },
    { id: "cabinet-top", tag: "desktop", kinds: [["books", 2], ["lamp", 1]], on: "cabinet", x: 0, z: 0, rot: [0, 0.3], chance: 0.5 },
    { id: "crate", tag: "floor", kinds: one("crate"), x: 0.95, z: 0.35, jitter: [0.1, 0.05], rot: [0, 0.3], chance: 0.4 },
    { id: "planter", tag: "floor", kinds: one("planter"), x: -1.75, z: 0.45, chance: 0.4 },
    { id: "clock", tag: "wall-high", kinds: one("clock"), x: -1.0, y: 2.1, jitter: [0.1, 0], chance: 0.5 },
    { id: "poster-2", tag: "wall-high", kinds: one("poster"), x: -1.6, y: 1.75, chance: 0.4 },
    { id: "note", tag: "wall-low", kinds: one("note"), x: 0, y: 1.0, chance: 0.4 },
    { id: "sconce", tag: "wall-high", kinds: one("lamp"), x: 0, y: 1.9, chance: 0.4 },
    { id: "chair", tag: "floor", kinds: one("chair"), x: 1.55, z: 0.3, rot: [0, 0.5], chance: 0.4 },
    { id: "pipe", tag: "ceiling", kinds: one("pipe"), x: 0, z: -1.1, scale: 0, chance: 0.5 },
  ],
  workshop: [
    { id: "workbench", tag: "floor", kinds: one("workbench"), x: -0.7, jitter: [0.1, 0], rot: [0, 0.03] },
    { id: "bench-lamp", tag: "desktop", kinds: one("lamp"), on: "workbench", x: 0.55, z: -0.1, light: true },
    { id: "board", tag: "wall-high", kinds: one("board"), x: 0.95, y: 1.85, size: [1.18, 1, 0.06], scale: 0 },
    { id: "crate", tag: "floor", kinds: one("crate"), x: 0.9, jitter: [0.05, 0] },
    { id: "ceiling-lamp", tag: "ceiling", kinds: one("lamp"), x: 0.5, z: -0.1, chance: 0.7 },
    { id: "cabinet", tag: "corner", kinds: [["cabinet", 2], ["rack", 1]], x: 0, side: 1, chance: 0.5 },
    { id: "chair", tag: "floor", kinds: one("chair"), x: -0.7, z: 0.05, jitter: [0.1, 0.05], rot: CHAIR_ROT, chance: 0.6 },
    { id: "bench-books", tag: "desktop", kinds: [["books", 2], ["mug", 1]], on: "workbench", x: -0.45, z: 0.05, rot: [0, 0.3], chance: 0.5 },
    { id: "bench-mug", tag: "desktop", kinds: one("mug"), on: "workbench", x: 0.15, z: 0.15, chance: 0.4 },
    { id: "crate-2", tag: "floor", kinds: one("crate"), x: 1.05, z: 0.3, jitter: [0.05, 0.05], rot: [0, 0.3], chance: 0.45 },
    { id: "crate-top", tag: "desktop", kinds: [["crate", 1], ["books", 1]], on: "crate", x: 0, z: 0, rot: [0, 0.15], scale: 0, chance: 0.4 },
    { id: "poster", tag: "wall-high", kinds: one("poster"), x: 0.9, y: 1.2, chance: 0.5 },
    { id: "clock", tag: "wall-high", kinds: one("clock"), x: 0.2, y: 2.2, chance: 0.4 },
    { id: "pipe", tag: "ceiling", kinds: one("pipe"), x: 0, z: -1.1, scale: 0, chance: 0.6 },
    { id: "note", tag: "wall-low", kinds: one("note"), x: 0.4, y: 1.0, chance: 0.4 },
    { id: "sconce", tag: "wall-high", kinds: one("lamp"), x: 1.7, y: 2.0, chance: 0.4 },
    { id: "rug", tag: "floor", kinds: one("rug"), x: 0.3, z: 0.15, jitter: [0.1, 0.05], rot: [0, 0.06], chance: 0.3 },
  ],
  cache_storage: [
    { id: "rack", tag: "corner", kinds: one("rack"), x: -1.4, jitter: [0.05, 0], rot: [0, 0.04] },
    { id: "rack-2", tag: "floor", kinds: one("rack"), x: -0.3, jitter: [0.05, 0], rot: [0, 0.04] },
    { id: "ceiling-lamp", tag: "ceiling", kinds: one("lamp"), x: 0.6, z: -0.1, light: true },
    { id: "crate", tag: "floor", kinds: one("crate"), x: 1.0, jitter: [0.03, 0] },
    { id: "crate-top", tag: "desktop", kinds: [["crate", 2], ["books", 1]], on: "crate", x: 0, z: 0, rot: [0, 0.15], scale: 0, chance: 0.5 },
    { id: "crate-2", tag: "floor", kinds: one("crate"), x: 1.0, z: 0.25, jitter: [0.1, 0.05], rot: [0, 0.3], chance: 0.6 },
    { id: "crate-3", tag: "floor", kinds: one("crate"), x: -1.45, z: 0.3, jitter: [0.05, 0.05], rot: [0, 0.3], chance: 0.5 },
    { id: "cabinet", tag: "corner", kinds: one("cabinet"), x: 0, side: 1, chance: 0.5 },
    { id: "board", tag: "wall-high", kinds: one("board"), x: 1.0, y: 1.85, size: [1.18, 1, 0.06], scale: 0 },
    { id: "clock", tag: "wall-high", kinds: one("clock"), x: 0.75, y: 2.2, chance: 0.5 },
    { id: "note", tag: "wall-low", kinds: one("note"), x: 0.55, y: 1.0, chance: 0.5 },
    { id: "pipe", tag: "ceiling", kinds: one("pipe"), x: 0, z: -1.1, scale: 0, chance: 0.6 },
    { id: "sconce", tag: "wall-high", kinds: one("lamp"), x: -0.9, y: 2.3, chance: 0.4 },
    { id: "planter", tag: "floor", kinds: one("planter"), x: 0.35, z: 0.45, chance: 0.4 },
  ],
  elevator: [
    { id: "ceiling-lamp", tag: "ceiling", kinds: one("lamp"), x: 0, z: 0.1, light: true },
    { id: "call-light", tag: "wall-high", kinds: one("lamp"), x: -1.05, y: 1.9 },
    { id: "cabinet", tag: "corner", kinds: one("cabinet"), x: 0, side: -1 },
    { id: "crate", tag: "floor", kinds: one("crate"), x: 1.35, jitter: [0.05, 0] },
    { id: "board", tag: "wall-high", kinds: one("board"), x: 1.35, y: 1.85, size: [0.88, 0.66, 0.06], scale: 0 },
    { id: "pipe", tag: "ceiling", kinds: one("pipe"), x: 0, z: -1.1, scale: 0 },
    { id: "call-light-2", tag: "wall-high", kinds: one("lamp"), x: 0.95, y: 1.95, chance: 0.5 },
    { id: "clock", tag: "wall-high", kinds: one("clock"), x: -1.5, y: 2.25, chance: 0.5 },
    { id: "note", tag: "wall-low", kinds: one("note"), x: -1.1, y: 1.05, chance: 0.5 },
    { id: "crate-2", tag: "floor", kinds: one("crate"), x: 1.35, z: 0.3, jitter: [0.05, 0.05], rot: [0, 0.3], chance: 0.5 },
    { id: "crate-top", tag: "desktop", kinds: [["crate", 1], ["books", 1]], on: "crate", x: 0, z: 0, rot: [0, 0.15], scale: 0, chance: 0.4 },
    { id: "planter", tag: "floor", kinds: one("planter"), x: -1.2, z: 0.45, chance: 0.4 },
    { id: "chair", tag: "floor", kinds: one("chair"), x: -1.2, z: -0.25, rot: [0, 0.5], chance: 0.4 },
    { id: "rug", tag: "floor", kinds: one("rug"), x: 0, z: 0.2, scale: 0, chance: 0.4 },
  ],
};

/** Hero areas no prop may enter (rugs and seats excepted): where residents stand and doors open. */
export const RESERVED: Record<VisualRoomKind, readonly Box[]> = {
  main: [{ min: [-0.65, 0, 0], max: [0.05, 2, FRONT_LANE_Z] }],
  power_plant: [{ min: [-1.5, 0, -0.3], max: [-0.3, 2, FRONT_LANE_Z] }],
  dorm: [{ min: [-0.3, 0, 0.1], max: [0.3, 2, FRONT_LANE_Z] }],
  workshop: [{ min: [0, 0, 0], max: [0.6, 2, FRONT_LANE_Z] }],
  cache_storage: [{ min: [-1, 0, 0], max: [0, 2, FRONT_LANE_Z] }],
  elevator: [{ min: [-0.75, 0, -1.25], max: [0.75, 2.5, FRONT_LANE_Z] }],
};
