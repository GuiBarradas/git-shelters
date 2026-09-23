import { mulberry32 } from "@/lib/forks/catalog";
import { hash32 } from "@/lib/forks/load";

/**
 * The 404 Lands (design doc §3.3): seven regions on the world map. Only
 * The Outage takes settlers in the alpha; the others are drawn locked so
 * the map already shows where the game is going. Shapes are hand-placed
 * polygons in a 1000×600 map space, rendered as SVG.
 */

export type Point = [number, number];

export type Region = {
  id: string;
  name: string;
  blurb: string;
  /** Polygon in map space, clockwise. */
  shape: Point[];
  /** Where the name goes. */
  label: Point;
  /** Takes settlers now. */
  open: boolean;
};

export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 600;

export const REGIONS: readonly Region[] = [
  {
    id: "the_outage",
    name: "The Outage",
    blurb: "Total blackout. No power, no signal, nothing. The most wrecked corner of the 404, and the only one taking settlers.",
    shape: [[120, 250], [300, 215], [395, 300], [350, 425], [185, 445], [85, 360]],
    label: [230, 335],
    open: true,
  },
  {
    id: "the_static",
    name: "The Static",
    blurb: "Eternal white noise, ghost broadcasts, TVs that never settle. No signal arrives clean.",
    shape: [[80, 70], [285, 50], [330, 175], [205, 215], [95, 200]],
    label: [200, 135],
    open: false,
  },
  {
    id: "the_heap",
    name: "The Heap",
    blurb: "Memory freed and never collected. Zombie processes haunt the piles.",
    shape: [[125, 470], [330, 455], [370, 560], [185, 585], [90, 540]],
    label: [230, 520],
    open: false,
  },
  {
    id: "the_cluster",
    name: "The Cluster",
    blurb: "Data centers that escaped management. Feral servers in an ecosystem of their own.",
    shape: [[365, 85], [565, 65], [605, 200], [485, 262], [380, 225]],
    label: [485, 160],
    open: false,
  },
  {
    id: "the_mainframe",
    name: "The Mainframe",
    blurb: "Ruins of the old megaservers. Beige terminals, magnetic tape, and the things that live in them.",
    shape: [[425, 300], [605, 280], [665, 400], [565, 485], [420, 455]],
    label: [540, 385],
    open: false,
  },
  {
    id: "the_sandbox",
    name: "The Sandbox",
    blurb: "It was the safe place to test things. Now nothing here behaves twice the same way.",
    shape: [[640, 430], [840, 410], [905, 540], [725, 585], [620, 520]],
    label: [765, 495],
    open: false,
  },
  {
    id: "the_edge",
    name: "The Edge",
    blurb: "Where the maps stop. New territory, and the sense that nobody has been this far.",
    shape: [[660, 80], [905, 60], [945, 225], [825, 335], [665, 265]],
    label: [800, 190],
    open: false,
  },
];

export const REGION_BY_ID: ReadonlyMap<string, Region> = new Map(REGIONS.map((r) => [r.id, r]));

/** Ray casting: is the point inside the polygon. */
export function inside([x, y]: Point, shape: Point[]): boolean {
  let hit = false;
  for (let i = 0, j = shape.length - 1; i < shape.length; j = i++) {
    const [xi, yi] = shape[i]!;
    const [xj, yj] = shape[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/**
 * Where a bunker sits in its region: a deterministic scatter seeded by
 * the login, so the same Maintainer lands on the same spot on every
 * render and every machine, with no position stored anywhere. Samples
 * the region's bounding box until a point falls inside the polygon.
 */
export function pinFor(login: string, region: Region): Point {
  const xs = region.shape.map((p) => p[0]);
  const ys = region.shape.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const rand = mulberry32(hash32(login.toLowerCase()));
  // Keep pins off the border so the dot never overlaps the outline.
  const pad = 14;
  for (let i = 0; i < 64; i++) {
    const p: Point = [minX + pad + rand() * (maxX - minX - 2 * pad), minY + pad + rand() * (maxY - minY - 2 * pad)];
    if (inside(p, region.shape)) return [Math.round(p[0]), Math.round(p[1])];
  }
  return region.label;
}
