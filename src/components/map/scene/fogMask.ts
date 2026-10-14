import { mulberry32 } from "@/lib/forks/catalog";
import { inside, MAP_HEIGHT, MAP_WIDTH, REGIONS, type Point, type Region } from "@/lib/regions/catalog";

/**
 * The signal-fog mask: how strongly each spot of the map is fogged, as a
 * 500×300 red channel the fog shader reads by world (x, z). Locked regions
 * are painted at their strength and softened by a 3 px blur; open regions
 * are then cut out with a margin, so linear filtering can never pull fog
 * onto them. Built from plain arrays (no canvas), so it is the same in
 * every browser and testable in Node.
 */

export const MASK_W = 500;
export const MASK_H = 300;
const TEXEL = MAP_WIDTH / MASK_W;
const SIGMA = 3;
/** Texels this close to an open region's rim are cleared too: bilinear taps reach √2 texels. */
const OPEN_MARGIN = 1.5;

/** Mask texture coordinates of a world (x, z); the shader repeats this maths. Row 0 is map north. */
export function maskUV(x: number, z: number): [number, number] {
  return [(x * 10 + MAP_WIDTH / 2) / MAP_WIDTH, (z * 10 + MAP_HEIGHT / 2) / MAP_HEIGHT];
}

function edgeDistance([x, y]: Point, shape: readonly Point[]): number {
  let best = Infinity;
  for (let i = 0; i < shape.length; i++) {
    const [ax, ay] = shape[i]!;
    const [bx, by] = shape[(i + 1) % shape.length]!;
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
    best = Math.min(best, Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay))));
  }
  return best;
}

/** Centre of a mask texel in map space. */
const centre = (i: number, j: number): Point => [(i + 0.5) * TEXEL, (j + 0.5) * TEXEL];

type Patch = { id: string; x0: number; y0: number; w: number; h: number; data: Float32Array };

/** A locked region's blurred coverage, kept to its bounding box plus the blur's reach. */
function blurredCoverage(region: Region): Patch {
  const r = Math.ceil(SIGMA * 3);
  const xs = region.shape.map((p) => p[0] / TEXEL);
  const ys = region.shape.map((p) => p[1] / TEXEL);
  const x0 = Math.max(0, Math.floor(Math.min(...xs)) - r);
  const y0 = Math.max(0, Math.floor(Math.min(...ys)) - r);
  const w = Math.min(MASK_W, Math.ceil(Math.max(...xs)) + r) - x0;
  const h = Math.min(MASK_H, Math.ceil(Math.max(...ys)) + r) - y0;
  let data = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) data[i + j * w] = inside(centre(x0 + i, y0 + j), region.shape) ? 1 : 0;
  const kernel = Array.from({ length: 2 * r + 1 }, (_, k) => Math.exp(-((k - r) ** 2) / (2 * SIGMA * SIGMA)));
  const sum = kernel.reduce((a, b) => a + b, 0);
  for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
    const next = new Float32Array(w * h);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        let acc = 0;
        for (let k = -r; k <= r; k++) {
          const [ii, jj] = [i + k * dx, j + k * dy];
          if (ii >= 0 && ii < w && jj >= 0 && jj < h) acc += data[ii + jj * w]! * kernel[k + r]!;
        }
        next[i + j * w] = acc / sum;
      }
    }
    data = next;
  }
  return { id: region.id, x0, y0, w, h, data };
}

export type FogMask = {
  /** The texture data, one byte per texel. */
  data: Uint8Array;
  /** Repaints {@link data} for the given fog strength (0..1) of each locked region. */
  draw: (strength: Readonly<Record<string, number>>) => void;
};

/** Precomputes the blurred locked regions and the cleared open texels once; drawing is then a cheap sum. */
export function createFogMask(regions: readonly Region[] = REGIONS): FogMask {
  const patches = regions.filter((r) => !r.open).map(blurredCoverage);
  const open = regions.filter((r) => r.open);
  const cleared: number[] = [];
  for (let j = 0; j < MASK_H; j++) {
    for (let i = 0; i < MASK_W; i++) {
      const p = centre(i, j);
      if (open.some((r) => inside(p, r.shape) || edgeDistance(p, r.shape) <= OPEN_MARGIN * TEXEL)) cleared.push(i + j * MASK_W);
    }
  }
  const data = new Uint8Array(MASK_W * MASK_H);
  const sum = new Float32Array(MASK_W * MASK_H);
  return {
    data,
    draw(strength) {
      sum.fill(0);
      for (const p of patches) {
        const s = strength[p.id] ?? 1;
        if (s <= 0) continue;
        for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) sum[p.x0 + i + (p.y0 + j) * MASK_W]! += p.data[i + j * p.w]! * s;
      }
      for (let k = 0; k < sum.length; k++) data[k] = Math.round(Math.min(1, sum[k]!) * 255);
      for (const k of cleared) data[k] = 0;
    },
  };
}

/**
 * Seeded value noise (three octaves), the cloud texture behind the fog's
 * patchiness and the fog cards. Tiles, so it can be sampled with repeat.
 */
export function cloudNoise(size = 128): Uint8Array {
  const rand = mulberry32(7);
  const octaves = [4, 8, 16].map((n) => ({ n, g: Array.from({ length: n * n }, () => rand()) }));
  const value = ({ n, g }: { n: number; g: number[] }, u: number, v: number) => {
    const [fx, fy] = [u * n, v * n];
    const [ix, iy] = [Math.floor(fx), Math.floor(fy)];
    const s = (a: number, b: number) => g[(a % n) + (b % n) * n]!;
    const [sx, sy] = [fx - ix, fy - iy].map((t) => t * t * (3 - 2 * t)) as [number, number];
    return (s(ix, iy) * (1 - sx) + s(ix + 1, iy) * sx) * (1 - sy) + (s(ix, iy + 1) * (1 - sx) + s(ix + 1, iy + 1) * sx) * sy;
  };
  const out = new Uint8Array(size * size);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const [u, v] = [i / size, j / size];
      const n = value(octaves[0]!, u, v) * 0.55 + value(octaves[1]!, u, v) * 0.3 + value(octaves[2]!, u, v) * 0.15;
      out[i + j * size] = Math.max(0, Math.min(255, Math.round((n - 0.3) * 1.8 * 255)));
    }
  }
  return out;
}
