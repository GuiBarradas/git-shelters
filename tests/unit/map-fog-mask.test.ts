// @vitest-environment node
import { describe, expect, it } from "vitest";

import { cloudNoise, createFogMask, MASK_H, MASK_W, maskUV } from "@/components/map/scene/fogMask";
import { inside, REGIONS, type Point, type Region } from "@/lib/regions/catalog";
import { toWorld } from "@/lib/regions/look";

/** What the GPU reads: LinearFilter with clamp-to-edge, texel centres at (i + 0.5) / size. */
function sample(data: Uint8Array, u: number, v: number): number {
  const [x, y] = [u * MASK_W - 0.5, v * MASK_H - 0.5];
  const [x0, y0] = [Math.floor(x), Math.floor(y)];
  const [tx, ty] = [x - x0, y - y0];
  const at = (i: number, j: number) => data[Math.min(MASK_W - 1, Math.max(0, i)) + Math.min(MASK_H - 1, Math.max(0, j)) * MASK_W]!;
  return (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty;
}

/** Map-space points on and inside a polygon: a dense grid, every vertex, and points along every edge. */
function pointsOf(region: Region): Point[] {
  const xs = region.shape.map((p) => p[0]);
  const ys = region.shape.map((p) => p[1]);
  const pts: Point[] = [...region.shape];
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += 1.7) for (let y = Math.min(...ys); y <= Math.max(...ys); y += 1.7) if (inside([x, y], region.shape)) pts.push([x, y]);
  region.shape.forEach(([ax, ay], i) => {
    const [bx, by] = region.shape[(i + 1) % region.shape.length]!;
    for (let t = 0; t <= 1; t += 0.01) pts.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
  });
  return pts;
}

const mask = createFogMask();
const atMap = ([x, y]: Point) => sample(mask.data, ...maskUV(...toWorld([x, y])));

describe("signal fog mask", () => {
  it("never fogs an open region, inside or on its rim, at any strength", () => {
    const open = REGIONS.filter((r) => r.open);
    expect(open.length).toBeGreaterThan(0);
    for (const strength of [1, 0.42]) {
      mask.draw(Object.fromEntries(REGIONS.map((r) => [r.id, strength])));
      for (const region of open) for (const p of pointsOf(region)) expect(atMap(p), `${region.id} ${p}`).toBe(0);
    }
  });

  it("keeps a shared border clean: a locked region touching an open one never fogs past the rim", () => {
    const square = (x: number, open: boolean): Region => ({
      id: `r${x}`, name: "", blurb: "", label: [x + 100, 300], open, shape: [[x, 200], [x + 200, 200], [x + 200, 400], [x, 400]],
    });
    const [locked, open] = [square(200, false), square(400, true)];
    const touching = createFogMask([locked, open]);
    touching.draw({ [locked.id]: 1 });
    for (const p of pointsOf(open)) expect(sample(touching.data, p[0] / 1000, p[1] / 600), `${p}`).toBe(0);
    // The locked side still reaches full strength away from the rim.
    expect(sample(touching.data, 0.3, 0.5)).toBeGreaterThan(250);
  });

  it("fogs each locked region at its own strength, and lets hover thin one alone", () => {
    const locked = REGIONS.filter((r) => !r.open);
    const strengths = Object.fromEntries(locked.map((r) => [r.id, 1]));
    mask.draw(strengths);
    for (const r of locked) expect(atMap(r.label), r.id).toBeGreaterThan(250);
    const [peeked, other] = [locked[0]!, locked[1]!];
    mask.draw({ ...strengths, [peeked.id]: 0.42 });
    expect(atMap(peeked.label) / 255).toBeCloseTo(0.42, 1);
    expect(atMap(other.label)).toBeGreaterThan(250);
    mask.draw(Object.fromEntries(locked.map((r) => [r.id, 0])));
    expect(mask.data.every((v) => v === 0)).toBe(true);
  });

  it("maps the world onto the texture with map north on row 0, as the shader does", () => {
    expect(maskUV(...toWorld([0, 0]))).toEqual([0, 0]);
    expect(maskUV(...toWorld([1000, 600]))).toEqual([1, 1]);
    expect(maskUV(...toWorld([250, 450]))).toEqual([0.25, 0.75]);
  });
});

describe("cloud noise", () => {
  it("is seeded, tiles, and spans dark to light", () => {
    const a = cloudNoise(64);
    expect(cloudNoise(64)).toEqual(a);
    expect(Math.min(...a)).toBe(0);
    expect(Math.max(...a)).toBeGreaterThan(128);
    // The last column meets the first smoothly: no hard seam when the texture repeats.
    const seam = Array.from({ length: 64 }, (_, j) => Math.abs(a[63 + j * 64]! - a[j * 64]!));
    expect(Math.max(...seam)).toBeLessThan(60);
  });
});
