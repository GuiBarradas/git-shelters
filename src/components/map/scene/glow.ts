import type { Vec3 } from "./framing";

/** How a point light moves; the index is what the Glows shader branches on. */
export const GLOW_MODES = ["breathe", "blink", "flicker", "own", "slow", "cycle", "steady", "dust"] as const;
export type GlowMode = (typeof GLOW_MODES)[number];

/** One point of light on the map. `phase` (0..1) desyncs it from its neighbours. */
export type Glow = { at: Vec3; color: string; size: number; mode: GlowMode; phase: number };

/**
 * The prototype (three r128, no colour management) did its light maths on
 * sRGB values. Map shaders do the same maths on sRGB colours, then hand
 * this the result, which brings it to linear so the renderer (or the
 * composer's last pass) encodes it exactly once.
 */
export const SRGB_TO_LINEAR = /* glsl */ `vec3 toLinear(vec3 c) { return pow(max(c, 0.0), vec3(2.2)); }`;

/** A colour's sRGB components, as the prototype maths expects them. */
export const srgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
