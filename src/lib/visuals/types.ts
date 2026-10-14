/**
 * Serializable shapes of the visual recipe. Everything here is plain JSON:
 * the server can render it into a page payload and the browser can rebuild
 * the same bunker from it without re-running the generator.
 */

export const ROOM_KINDS = ["main", "cache_storage", "power_plant", "dorm", "elevator", "workshop"] as const;
export type VisualRoomKind = (typeof ROOM_KINDS)[number];

export const SLOT_TAGS = ["wall-high", "wall-low", "desktop", "floor", "corner", "ceiling"] as const;
export type SlotTag = (typeof SLOT_TAGS)[number];

export const PROP_KINDS = [
  "lamp", "monitor", "desk", "chair", "rack", "board", "clock", "mug", "planter", "crate", "books",
  "poster", "note", "rug", "pipe", "bunk", "generator", "workbench", "cabinet", "aquarium", "cat", "flag",
] as const;
export type PropKind = (typeof PROP_KINDS)[number];

export type VisualDomain = "palette" | "wear" | "furniture" | "resident" | "signature" | "room" | "texture";
export type FurnitureStyle = "salvaged" | "industrial" | "domestic";
export type Signature = "aquarium" | "cat" | "flag";
export type HairStyle = "swept" | "crop" | "parted";
export type Accessory = "none" | "headlamp" | "scarf" | "goggles";
export type Motif = "neutral" | "systems" | "web" | "data" | "jvm" | "scripting" | "functional" | "mobile";

/** floor: stands on the floor; rug: flat under furniture; wall: hung on the back wall; ceiling: hangs; surface: sits on a supporting prop. */
export type CollisionLayer = "floor" | "rug" | "wall" | "ceiling" | "surface";

export type Vec3 = [number, number, number];

export interface VisualPalette {
  concrete: string;
  inset: string;
  wall: string;
  floor: string;
  warmLight: string;
  emissive: string;
  wood: string;
  fabric: string;
}

export interface BunkerIdentity {
  version: number;
  githubId: string;
  seed: number;
  palette: VisualPalette;
  wear: number;
  furnitureStyle: FurnitureStyle;
  signature: Signature | null;
}

export interface ResidentAppearance {
  key: string;
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  hairStyle: HairStyle;
  accessory: Accessory;
}

export interface Excerpt {
  source: "commit" | "readme";
  text: string;
}

/**
 * Optional, generic repository data the caller may supply (language mix,
 * counts, a commit or README excerpt). Every field is optional; missing or
 * invalid ones read as unknown, never as zero, and nothing is fabricated.
 */
export interface VisualEvolution {
  dominantLanguages?: ReadonlyArray<{ name: string; weight: number }>;
  contributorCount?: number | null;
  commitCount?: number | null;
  recentActivity?: number | null;
  excerpt?: Excerpt | null;
}

export interface TextureRecipe {
  seed: number;
  motif: Motif;
  palette: [string, string, string];
  text: string;
}

/**
 * One prop. `position` is the bottom-center of its box in room space,
 * `size` is the box in the prop's own axes (base size × scale), and
 * `rotationY` turns it about its vertical axis (Three.js convention).
 */
export interface PropDescriptor {
  id: string;
  slot: string;
  tag: SlotTag;
  layer: CollisionLayer;
  kind: PropKind;
  /** Slot id of the prop this one rests on (layer "surface"). */
  support?: string;
  position: Vec3;
  scale: Vec3;
  rotationY: number;
  size: Vec3;
  color: string;
  variant: number;
  state: { lit: boolean; filled: boolean };
  texture?: TextureRecipe;
}

export interface RoomRef {
  slot: number;
  kind: VisualRoomKind;
}

export interface GeneratedRoom extends RoomRef {
  motif: Motif;
  /** Decorative richness 0..3; 1 when the repository data is unknown. */
  tier: number;
  props: PropDescriptor[];
}

export interface GeneratedBunker {
  identity: BunkerIdentity;
  rooms: GeneratedRoom[];
}
