/**
 * Scene time for every animated map material: one uniform object that
 * all their shaders share, advanced once per frame by WorldMap3D. Reduced
 * motion slows it (map brief) instead of freezing it, so lights still
 * tell activity apart. One map is mounted at a time.
 */
export const mapTime = { value: 0 };
export const REDUCED_MOTION_SPEED = 0.35;
