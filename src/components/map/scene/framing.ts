import { REGION_BY_ID } from "@/lib/regions/catalog";
import { toWorld, WORLD_DEPTH, WORLD_WIDTH } from "@/lib/regions/look";

/** Diorama lens and orbit limits for the 404 Lands (map brief). */
export const FOV = 28;
export const MIN_DISTANCE = 42;
export const MAX_DISTANCE = 230;
export const MIN_POLAR = 0.5;
export const MAX_POLAR = 1.2;
/** Polar angle of the home view, from straight down. */
export const HOME_POLAR = 0.9;
/** A slight turn off due south, so the plateau walls read in the home view. */
export const HOME_AZIMUTH = 0.2;
/** Distance of the "find my Repo" close-up. */
export const OWN_DISTANCE = 60;

export type Vec3 = [number, number, number];
export type Framing = { target: Vec3; distance: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Distance that fits a w×d ground box on screen, seen from {@link HOME_POLAR}. */
function fit(w: number, d: number, aspect: number): number {
  const v = Math.tan((FOV * Math.PI) / 360);
  // Ground depth is foreshortened by the tilt; 1.15 leaves room for the HUD bands.
  const raw = Math.max(w / 2 / (v * aspect), (d * Math.cos(HOME_POLAR)) / 2 / v) * 1.15;
  return clamp(raw, MIN_DISTANCE, MAX_DISTANCE);
}

/** The Outage's bounding box in world units, the portrait view's subject. */
function outageBox() {
  const pts = REGION_BY_ID.get("the_outage")!.shape.map(toWorld);
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  return { center: [(x0 + x1) / 2, (z0 + z1) / 2] as const, w: x1 - x0, d: z1 - z0 };
}

/** Home view: the whole map in landscape, The Outage centred in portrait. */
export function frameView(aspect: number): Framing {
  if (aspect >= 1) return { target: [0, 0, 0], distance: fit(WORLD_WIDTH, WORLD_DEPTH, aspect) };
  const box = outageBox();
  return { target: [box.center[0], 0, box.center[1]], distance: fit(box.w, box.d, aspect) };
}

/** Keeps the orbit target over the map table. */
export function clampTarget(x: number, z: number): [number, number] {
  return [clamp(x, -WORLD_WIDTH / 2, WORLD_WIDTH / 2), clamp(z, -WORLD_DEPTH / 2, WORLD_DEPTH / 2)];
}

/** Camera offset from its target for a distance, polar angle (from +y) and azimuth (from +z). */
export function orbitOffset(distance: number, polar: number, azimuth: number): Vec3 {
  const s = Math.sin(polar) * distance;
  return [s * Math.sin(azimuth), Math.cos(polar) * distance, s * Math.cos(azimuth)];
}
