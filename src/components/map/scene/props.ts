import { mulberry32 } from "@/lib/forks/catalog";
import { hash32 } from "@/lib/forks/load";
import { mapTones, palette } from "@/lib/palette";
import { REGION_BY_ID, REGIONS, type Region } from "@/lib/regions/catalog";
import { REGION_LOOK, toWorld } from "@/lib/regions/look";

import type { Vec3 } from "./framing";
import type { Glow } from "./glow";

/**
 * The props of every region as plain data (map brief, look.ts recipes),
 * seeded by region id so the 404 Lands look the same on every visit and
 * every machine. The scene draws all boxes in one InstancedMesh, all
 * cylinders in another, all lines in one LineSegments, and hands the
 * lights to Glows.
 */

type XZ = [number, number];
/** A unit box or cylinder placed, scaled and turned (Euler XYZ), with its colour. */
export type Solid = { at: Vec3; scale: Vec3; rot: Vec3; color: string };
/** A Sandbox cube: floats around `at` and spins at its own speed. */
export type Cube = { at: Vec3; size: number; phase: number; speed: number };
export type Line = { from: Vec3; to: Vec3; color: string };

/** A ring sweeping out over the ground: sonar, siren or ghost broadcast. */
export type Ring = { at: Vec3; color: string; period: number; radius: number; phase: number };

export type MapProps = { boxes: Solid[]; cylinders: Solid[]; lines: Line[]; cubes: Cube[]; glows: Glow[]; rings: Ring[] };

const rngFor = (id: string) => mulberry32(hash32(id));
const poly = (r: Region): XZ[] => r.shape.map((p) => toWorld(p));
const top = (id: string) => REGION_LOOK[id]!.height;

/** Even-odd point-in-polygon on the world ground plane. */
export function insideXZ([x, z]: XZ, shape: readonly XZ[]): boolean {
  let hit = false;
  for (let i = 0, j = shape.length - 1; i < shape.length; j = i++) {
    const [xi, zi] = shape[i]!;
    const [xj, zj] = shape[j]!;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
}

function bbox(shape: readonly XZ[]) {
  const xs = shape.map((p) => p[0]);
  const zs = shape.map((p) => p[1]);
  return [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)] as const;
}

/** The closest any prop may stand to a point it avoids. */
const MIN_CLEARANCE = 1.4;

/**
 * A random point at least `pad` inside the polygon and `minD` away from
 * every point in `avoid`, relaxing `minD` toward {@link MIN_CLEARANCE}
 * when the region is too crowded. Falls back to the vertex average,
 * which is inside every region of the catalog.
 */
export function sampleIn(shape: readonly XZ[], rand: () => number, pad: number, avoid: readonly XZ[] = [], minD = 0): XZ {
  const [x0, x1, z0, z1] = bbox(shape);
  for (let k = 0; k < 400; k++) {
    const p: XZ = [x0 + rand() * (x1 - x0), z0 + rand() * (z1 - z0)];
    if (!insideXZ(p, shape)) continue;
    if (pad && ![[pad, 0], [-pad, 0], [0, pad], [0, -pad]].every(([dx, dz]) => insideXZ([p[0] + dx!, p[1] + dz!], shape))) continue;
    if (avoid.some((a) => Math.hypot(a[0] - p[0], a[1] - p[1]) < minD)) continue;
    return p;
  }
  // A crowded region (many Repos) cannot keep the full distance: close in, never nearer than a hatch's clearance.
  if (minD > MIN_CLEARANCE) return sampleIn(shape, rand, pad, avoid, Math.max(MIN_CLEARANCE, minD * 0.7));
  return [shape.reduce((s, p) => s + p[0], 0) / shape.length, shape.reduce((s, p) => s + p[1], 0) / shape.length];
}

/** Where a line at x = v (or z = v) crosses into and out of the polygon, as [from, to] spans. */
function scan(shape: readonly XZ[], axis: "x" | "z", v: number): [number, number][] {
  const hits: number[] = [];
  for (let i = 0; i < shape.length; i++) {
    const [x1, z1] = shape[i]!;
    const [x2, z2] = shape[(i + 1) % shape.length]!;
    if (axis === "x" && ((x1 <= v && x2 > v) || (x2 <= v && x1 > v))) hits.push(z1 + ((v - x1) / (x2 - x1)) * (z2 - z1));
    if (axis === "z" && ((z1 <= v && z2 > v) || (z2 <= v && z1 > v))) hits.push(x1 + ((v - z1) / (z2 - z1)) * (x2 - x1));
  }
  hits.sort((a, b) => a - b);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < hits.length; i += 2) out.push([hits[i]!, hits[i + 1]!]);
  return out;
}

const pick = <T>(rand: () => number, list: readonly T[]): T => list[Math.floor(rand() * list.length)]!;

/** Mixes two hex colours: lines are opaque, so a faint line is a blend toward its ground. */
function blend(a: string, b: string, t: number): string {
  const [na, nb] = [parseInt(a.slice(1), 16), parseInt(b.slice(1), 16)];
  const ch = (n: number, s: number) => (n >> s) & 255;
  const mix = (s: number) => Math.round(ch(na, s) + (ch(nb, s) - ch(na, s)) * t);
  return `#${((mix(16) << 16) | (mix(8) << 8) | mix(0)).toString(16).padStart(6, "0")}`;
}

/**
 * Builds every region's props. `bunkers` are the world (x, z) of the
 * Repos in The Outage: pylons and rubble keep clear of them, so no
 * player is ever buried.
 */
export function mapProps(bunkers: readonly XZ[]): MapProps {
  const out: MapProps = { boxes: [], cylinders: [], lines: [], cubes: [], glows: [], rings: [] };
  const glow = (at: Vec3, color: string, size: number, mode: Glow["mode"], phase: number) => out.glows.push({ at, color, size, mode, phase });

  // The Outage: blackout, dead power lines with red beacons. The only warm light is the players'.
  {
    const id = "the_outage", shape = poly(REGION_BY_ID.get(id)!), y = top(id), rand = rngFor(id);
    const pylons: XZ[] = [];
    for (let i = 0; i < 7; i++) pylons.push(sampleIn(shape, rand, 1.5, [...bunkers, ...pylons], 4));
    pylons.sort((a, b) => a[0] - b[0]);
    const h = pylons.map(() => 5 + rand() * 2.2);
    pylons.forEach(([x, z], i) => {
      out.boxes.push({ at: [x, y + h[i]! / 2, z], scale: [0.22, h[i]!, 0.22], rot: [0, rand() * 3, (rand() - 0.5) * 0.08], color: mapTones.hatch });
      out.boxes.push({ at: [x, y + h[i]! * 0.86, z], scale: [2.2, 0.14, 0.14], rot: [0, rand() * 3, 0], color: mapTones.hatch });
      glow([x, y + h[i]! + 0.2, z], mapTones.beaconRed, 1.7, "blink", rand());
      // One pylon in three still wails: a siren sweep on the ground.
      if (i % 3 === 0) out.rings.push({ at: [x, y + 0.06, z], color: palette.fadedRed, period: 5.5 + rand() * 2, radius: 7, phase: rand() });
    });
    // Two sagging cables between neighbouring pylons.
    for (let i = 0; i + 1 < pylons.length; i++) {
      const [[ax, az], [bx, bz]] = [pylons[i]!, pylons[i + 1]!];
      const [ay, by] = [y + h[i]! * 0.86, y + h[i + 1]! * 0.86];
      for (const off of [-0.27, 0.27]) {
        let prev: Vec3 | null = null;
        for (let k = 0; k <= 14; k++) {
          const t = k / 14;
          const cur: Vec3 = [ax + (bx - ax) * t, ay + (by - ay) * t - Math.sin(Math.PI * t) * 1.4, az + (bz - az) * t + off];
          if (prev) out.lines.push({ from: prev, to: cur, color: mapTones.mast });
          prev = cur;
        }
      }
    }
    for (let i = 0; i < 70; i++) {
      const [x, z] = sampleIn(shape, rand, 0.6, bunkers, 1.4);
      const s = 0.25 + rand() * 0.7;
      out.boxes.push({
        at: [x, y + s * 0.3, z], scale: [s, s * (0.5 + rand() * 0.6), s * (0.7 + rand() * 0.6)],
        rot: [rand() * 0.4, rand() * 3, rand() * 0.4], color: rand() < 0.5 ? palette.inactivePlum : mapTones.sandboxSide,
      });
    }
  }

  // The Static: antennas and half-buried CRTs still showing a picture.
  {
    const id = "the_static", shape = poly(REGION_BY_ID.get(id)!), y = top(id), rand = rngFor(id);
    const spots: XZ[] = [];
    for (let i = 0; i < 8; i++) {
      const p = sampleIn(shape, rand, 1.2, spots, 3);
      spots.push(p);
      const h = 4 + rand() * 5;
      out.cylinders.push({ at: [p[0], y + h / 2, p[1]], scale: [0.2, h, 0.2], rot: [0, 0, 0], color: mapTones.antenna });
      glow([p[0], y + h + 0.15, p[1]], palette.boneWhite, 1.6, "blink", rand());
      // A ghost broadcast from one antenna in three.
      if (i % 3 === 0) out.rings.push({ at: [p[0], y + 0.05, p[1]], color: palette.boneWhite, period: 6 + rand() * 3, radius: 8, phase: rand() });
    }
    for (let i = 0; i < 26; i++) {
      const [x, z] = sampleIn(shape, rand, 0.8, spots, 1.2);
      const [ry, tilt] = [rand() * 6.28, (rand() - 0.5) * 0.6];
      out.boxes.push({ at: [x, y + 0.22, z], scale: [0.95, 0.75, 0.75], rot: [tilt, ry, 0], color: mapTones.crt });
      glow([x + Math.sin(ry) * 0.42, y + 0.35, z + Math.cos(ry) * 0.42], rand() < 0.6 ? palette.boneWhite : palette.phosphorViolet, 1.4, "flicker", rand());
    }
  }

  // The Heap: five mounds of hardware nobody collected.
  {
    const id = "the_heap", shape = poly(REGION_BY_ID.get(id)!), y = top(id), rand = rngFor(id);
    const piles = Array.from({ length: 5 }, () => sampleIn(shape, rand, 2));
    const colors = [palette.concreteTan, palette.concreteTan, palette.oldWoodBrown, palette.oldWoodBrown, palette.steelBlue, palette.coalBlack, palette.mustardWarning];
    for (let i = 0; i < 300; i++) {
      const [cx, cz] = pick(rand, piles);
      const [ang, d] = [rand() * 6.28, Math.pow(rand(), 0.7) * 2.8];
      const s = 0.2 + rand() * 0.5;
      out.boxes.push({
        at: [cx + Math.cos(ang) * d, y + (1 - d / 2.8) * (1.6 + rand() * 0.8) + s * 0.4, cz + Math.sin(ang) * d],
        scale: [s * (0.8 + rand()), s * (0.4 + rand() * 0.6), s], rot: [rand() * 0.8, rand() * 6.28, rand() * 0.8], color: pick(rand, colors),
      });
    }
    for (const [x, z] of piles) glow([x + (rand() - 0.5), y + 1.6, z + (rand() - 0.5)], palette.phosphorViolet, 1.3, "flicker", rand());
  }

  // The Cluster: feral server rows on a grid, a few toppled, cold LEDs.
  {
    const id = "the_cluster", shape = poly(REGION_BY_ID.get(id)!), y = top(id), rand = rngFor(id);
    const [x0, x1, z0, z1] = bbox(shape);
    for (let x = x0 + 1.4; x < x1 - 1; x += 2.3) {
      for (let z = z0 + 1.2; z < z1 - 1; z += 1.7) {
        if (![[x, z], [x + 0.9, z + 0.6], [x - 0.9, z - 0.6]].every((p) => insideXZ(p as XZ, shape))) continue;
        if (rand() < 0.18) continue;
        const [rx, h, fallen] = [x + (rand() - 0.5) * 0.3, 2.2 + rand() * 2.2, rand() < 0.1];
        if (fallen) {
          out.boxes.push({ at: [rx, y + 0.45, z], scale: [1.5, h, 0.9], rot: [0, 0.3, Math.PI / 2], color: mapTones.rack });
          continue;
        }
        out.boxes.push({ at: [rx, y + h / 2, z], scale: [1.5, h, 0.9], rot: [0, (rand() - 0.5) * 0.12, 0], color: mapTones.rack });
        for (let i = 0; i < 3; i++) {
          glow([rx - 0.45 + i * 0.45, y + 0.6 + rand() * (h - 1), z + 0.47], rand() < 0.5 ? mapTones.clusterBlue : palette.phosphorViolet, 0.95, rand() < 0.5 ? "blink" : "slow", rand());
        }
      }
    }
  }

  // The Mainframe: beige cabinets, some fallen, tape reels, slow violet screens.
  {
    const id = "the_mainframe", shape = poly(REGION_BY_ID.get(id)!), y = top(id), rand = rngFor(id);
    const spots: XZ[] = [];
    for (let i = 0; i < 22; i++) {
      const p = sampleIn(shape, rand, 1, spots, 1.8);
      spots.push(p);
      const [fallen, ry] = [rand() < 0.25, rand() * 6.28];
      const color = rand() < 0.5 ? palette.concreteTan : mapTones.beige;
      out.boxes.push(fallen
        ? { at: [p[0], y + 0.42, p[1]], scale: [1.2, 2.4, 0.8], rot: [0, ry, Math.PI / 2], color }
        : { at: [p[0], y + 1.2, p[1]], scale: [1.2, 2.4, 0.8], rot: [0, ry, (rand() - 0.5) * 0.15], color });
      if (!fallen && rand() < 0.5) glow([p[0] + Math.sin(ry) * 0.42, y + 1.6, p[1] + Math.cos(ry) * 0.42], palette.phosphorViolet, 1.2, "slow", rand());
    }
    for (let i = 0; i < 16; i++) {
      const [x, z] = sampleIn(shape, rand, 0.8, spots, 1.2);
      out.cylinders.push({ at: [x, y + 0.5, z], scale: [1, 0.12, 1], rot: [Math.PI / 2, rand() * 6.28, 0], color: mapTones.heapTop });
    }
  }

  // The Sandbox: nothing behaves twice. Cubes float and recolour; a quarter carry a cycling glow.
  {
    const id = "the_sandbox", shape = poly(REGION_BY_ID.get(id)!), y = top(id), rand = rngFor(id);
    for (let i = 0; i < 38; i++) {
      const [x, z] = sampleIn(shape, rand, 0.8);
      const cube: Cube = { at: [x, y + 0.8 + rand() * 2.6, z], size: 0.35 + rand() * 0.8, phase: rand() * 6.28, speed: 0.4 + rand() * 0.8 };
      out.cubes.push(cube);
      if (i % 4 === 0) glow(cube.at, palette.phosphorViolet, 1.8, "cycle", rand());
    }
  }

  // The Edge: a clean frontier. The bone survey grid stops at the rim; six obelisks and one survey light.
  {
    const id = "the_edge", shape = poly(REGION_BY_ID.get(id)!), y = top(id) + 0.03, rand = rngFor(id);
    const [x0, x1, z0, z1] = bbox(shape);
    const color = blend(mapTones.edgeTop, palette.boneWhite, 0.16);
    for (let x = Math.ceil(x0); x <= x1; x += 1.5) for (const [a, b] of scan(shape, "x", x)) out.lines.push({ from: [x, y, a + 0.4], to: [x, y, b - 0.4], color });
    for (let z = Math.ceil(z0); z <= z1; z += 1.5) for (const [a, b] of scan(shape, "z", z)) out.lines.push({ from: [a + 0.4, y, z], to: [b - 0.4, y, z], color });
    for (let i = 0; i < 6; i++) {
      const [x, z] = sampleIn(shape, rand, 2);
      const h = 2 + rand() * 4;
      out.boxes.push({ at: [x, y + h / 2, z], scale: [0.4, h, 0.4], rot: [0, 0, 0], color: mapTones.obelisk });
    }
    const [bx, bz] = sampleIn(shape, rand, 3);
    glow([bx, y + 0.4, bz], palette.phosphorViolet, 1.4, "blink", 0.3);
  }

  return out;
}

/** True over a region that has signal: lights there stay sharp in front of the fog. */
export function inOpenRegion([x, , z]: Vec3): boolean {
  return REGIONS.some((r) => r.open && insideXZ([x, z], poly(r)));
}

/** A billboard cloud of the signal fog. `seed` (0..1) sets its drift and turn. */
export type FogCard = { at: Vec3; size: number; seed: number };

/** Eight cloud cards over every locked region, none over open ground. */
export function fogCards(): FogCard[] {
  const rand = rngFor("signal_fog_cards");
  return REGIONS.filter((r) => !r.open).flatMap((r) => {
    const shape = poly(r);
    return Array.from({ length: 8 }, (): FogCard => {
      const [x, z] = sampleIn(shape, rand, 2.6);
      return { at: [x, top(r.id) + 0.8 + rand() * 2.4, z], size: 4.5 + rand() * 4, seed: rand() };
    });
  });
}

/** Dust motes drifting up over the whole table, lit violet and, now and then, lamp-warm. */
export function dust(count = 420): Glow[] {
  const rand = rngFor("dust");
  return Array.from({ length: count }, (): Glow => ({
    at: [-55 + rand() * 110, rand() * 14, -35 + rand() * 70],
    color: rand() < 0.8 ? palette.phosphorViolet : palette.lampWarm,
    size: 0.16 + rand() * 0.14,
    mode: "dust",
    phase: rand(),
  }));
}
