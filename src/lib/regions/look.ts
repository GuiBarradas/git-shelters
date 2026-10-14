import { mapTones, palette } from "@/lib/palette";

import { MAP_HEIGHT, MAP_WIDTH, type Point } from "./catalog";

/**
 * How each region of the 404 Lands looks as a night diorama (map brief):
 * plateau height, top and side tones, and the recipe its props and lights
 * are built from. Content only; the scene reads it. When a region opens it
 * keeps its look and only loses the signal fog.
 */

export type PropRecipe = { kind: string; count: number; note?: string };
export type LightRecipe = { kind: string; colors: readonly string[]; note?: string };

export type RegionLook = {
  height: number;
  top: string;
  side: string;
  /** The top cycles through the palette instead of holding one tone. */
  animated?: boolean;
  props: readonly PropRecipe[];
  lights: readonly LightRecipe[];
};

export const REGION_LOOK: Readonly<Record<string, RegionLook>> = {
  the_outage: {
    height: 1.2,
    top: mapTones.outageTop,
    side: mapTones.outageSide,
    props: [
      { kind: "dead_pylon", count: 7, note: "fallen cables as catenary lines" },
      { kind: "rubble", count: 70 },
    ],
    lights: [
      { kind: "beacon_blink", colors: [mapTones.beaconRed], note: "top of every pylon" },
      { kind: "siren_ring", colors: [mapTones.beaconRed], note: "one pylon in three" },
    ],
  },
  the_static: {
    height: 1.7,
    top: mapTones.staticTop,
    side: mapTones.staticSide,
    props: [
      { kind: "antenna", count: 8 },
      { kind: "buried_crt", count: 26 },
    ],
    lights: [
      { kind: "crt_flicker", colors: [palette.boneWhite, palette.phosphorViolet] },
      { kind: "antenna_blink", colors: [palette.phosphorViolet] },
      { kind: "ghost_broadcast_ring", colors: [palette.boneWhite] },
    ],
  },
  the_heap: {
    height: 0.9,
    top: mapTones.heapTop,
    side: mapTones.heapSide,
    props: [
      { kind: "hardware_mound", count: 5 },
      {
        kind: "hardware_box",
        count: 300,
        note: "concreteTan, oldWoodBrown, steelBlue, coalBlack, a little mustardWarning",
      },
    ],
    lights: [{ kind: "failing_glow", colors: [palette.phosphorViolet], note: "a few inside the mounds" }],
  },
  the_cluster: {
    height: 1.5,
    top: mapTones.clusterTop,
    side: mapTones.clusterSide,
    props: [{ kind: "server_rack", count: 40, note: "rows on a 2.3 × 1.7 grid, gaps and about 10% toppled; the count is what the grid fits, roughly 40" }],
    lights: [{ kind: "led_blink", colors: [palette.phosphorViolet, mapTones.clusterBlue], note: "half and half" }],
  },
  the_mainframe: {
    height: 1.1,
    top: mapTones.mainframeTop,
    side: mapTones.mainframeSide,
    props: [
      { kind: "beige_cabinet", count: 22, note: "some fallen" },
      { kind: "tape_reel", count: 16 },
    ],
    lights: [{ kind: "screen_breathe", colors: [palette.phosphorViolet] }],
  },
  the_sandbox: {
    height: 1.3,
    top: palette.inactivePlum,
    side: mapTones.sandboxSide,
    animated: true,
    props: [{ kind: "floating_cube", count: 38, note: "spinning, recoloured within the palette" }],
    lights: [{ kind: "colour_cycle", colors: [palette.phosphorViolet, palette.amber, palette.mustardWarning] }],
  },
  the_edge: {
    height: 2.2,
    top: mapTones.edgeTop,
    side: mapTones.edgeSide,
    props: [
      { kind: "bone_grid", count: 1, note: "on the top, ending at the rim" },
      { kind: "obelisk", count: 6 },
    ],
    lights: [{ kind: "survey_beacon", colors: [palette.phosphorViolet] }],
  },
};

/** Height of a region's plateau top; 0 (the floor) for an unknown id. */
export const regionHeight = (id: string) => REGION_LOOK[id]?.height ?? 0;

/** World units per map unit. The 1000×600 map becomes a 100×60 table. */
export const WORLD_SCALE = 0.1;
export const WORLD_WIDTH = MAP_WIDTH * WORLD_SCALE;
export const WORLD_DEPTH = MAP_HEIGHT * WORLD_SCALE;

/** Map space (px, py) to the world ground plane (x, z); map north is world -z. */
export function toWorld([px, py]: Point): [number, number] {
  return [(px - MAP_WIDTH / 2) * WORLD_SCALE, (py - MAP_HEIGHT / 2) * WORLD_SCALE];
}

/** The inverse of {@link toWorld}. */
export function toMap([x, z]: [number, number]): Point {
  return [x / WORLD_SCALE + MAP_WIDTH / 2, z / WORLD_SCALE + MAP_HEIGHT / 2];
}
