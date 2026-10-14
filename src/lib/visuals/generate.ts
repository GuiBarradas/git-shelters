import {
  canonicalGithubId,
  createDomainRandom,
  GENERATOR_VERSION,
  identitySeed,
  pick,
  pickWeighted,
} from "@/lib/visuals/seed";
import {
  FRONT_LANE_Z,
  KINDS,
  LAMP_FORMS,
  MAX_PROPS,
  MIN_PROPS,
  RESERVED,
  ROOM_BOUNDS,
  SLOT_LIBRARY,
  type Box,
  type SlotDef,
} from "@/lib/visuals/slots";
import {
  ROOM_KINDS,
  type Accessory,
  type BunkerIdentity,
  type CollisionLayer,
  type Excerpt,
  type FurnitureStyle,
  type GeneratedBunker,
  type GeneratedRoom,
  type HairStyle,
  type Motif,
  type PropDescriptor,
  type ResidentAppearance,
  type RoomRef,
  type Signature,
  type TextureRecipe,
  type Vec3,
  type VisualEvolution,
  type VisualPalette,
  type VisualRoomKind,
} from "@/lib/visuals/types";

const r3 = (n: number) => Math.round(n * 1000) / 1000 + 0;

// ---------------------------------------------------------------- identity

type BasePalette = Omit<VisualPalette, "warmLight" | "emissive">;

/**
 * One harmonic family per bunker: muted rose, plum, clay or warm slate,
 * all around the established light pink concrete (#B29298).
 */
const FAMILIES: readonly BasePalette[] = [
  { concrete: "#AE8992", inset: "#675464", wall: "#514551", floor: "#5E4B55", wood: "#8A5A48", fabric: "#C27F8A" },
  { concrete: "#99829E", inset: "#5F5468", wall: "#4B4356", floor: "#574C5F", wood: "#7C5640", fabric: "#9E6E9A" },
  { concrete: "#B28A79", inset: "#6A5654", wall: "#574845", floor: "#61504B", wood: "#8E5C3C", fabric: "#C27A60" },
  { concrete: "#969397", inset: "#625A60", wall: "#4F4A4E", floor: "#5A5457", wood: "#7C5A44", fabric: "#9A8A84" },
];
const WARM_LIGHTS = ["#FFC98A", "#FFB870", "#FFD3A8", "#FFBE8C"];
const SCREENS = ["#BD93F9", "#A08CFF", "#9B7BFF", "#B38CF0"];
const STYLES: readonly FurnitureStyle[] = ["salvaged", "industrial", "domestic"];

/** Scales every channel by one factor: lighter or darker, same hue. */
function shade(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.min(255, Math.round(((n >> shift) & 255) * factor));
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0").toUpperCase()}`;
}

export function generateIdentity(githubId: string | number): BunkerIdentity {
  const id = canonicalGithubId(githubId);
  const p = createDomainRandom(id, "palette");
  const family = pick(p, FAMILIES);
  // ±5% lightness only: the hue stays inside the family. Literal order fixes the draw order.
  const tint = (field: keyof BasePalette) => shade(family[field], 0.95 + p() * 0.1);
  const palette: VisualPalette = {
    concrete: tint("concrete"),
    inset: tint("inset"),
    wall: tint("wall"),
    floor: tint("floor"),
    warmLight: pick(p, WARM_LIGHTS),
    emissive: pick(p, SCREENS),
    wood: tint("wood"),
    fabric: tint("fabric"),
  };

  const s = createDomainRandom(id, "signature")();
  const signature: Signature | null = s < 0.03 ? "aquarium" : s < 0.06 ? "cat" : s < 0.09 ? "flag" : null;

  return {
    version: GENERATOR_VERSION,
    githubId: id,
    seed: identitySeed(id),
    palette,
    wear: r3(createDomainRandom(id, "wear")()),
    furnitureStyle: pick(createDomainRandom(id, "furniture"), STYLES),
    signature,
  };
}

// ---------------------------------------------------------------- residents

const SKINS = ["#F1C9A5", "#E0AC69", "#C68642", "#8D5524", "#5C3A21"];
const HAIRS = ["#1E1A1D", "#3B2A20", "#6B4226", "#A0522D", "#D9B38C", "#8A8A8A", "#5A3A6E"];
const SHIRTS = ["#B76E79", "#8E5A8A", "#B5674D", "#8A7A72", "#3A4A5A", "#E6DFC8", "#A14545"];
const PANTS = ["#2A2D34", "#3A4A5A", "#5C3A21", "#45414F"];
const HAIR_STYLES: readonly HairStyle[] = ["swept", "crop", "parted"];
const ACCESSORIES: ReadonlyArray<readonly [Accessory, number]> = [["none", 55], ["headlamp", 15], ["scarf", 15], ["goggles", 15]];

/**
 * A resident's look from the bunker id and the resident's own stable key
 * (its database id), never its name or its position in a list.
 */
export function generateResidentAppearance(githubId: string | number, residentStableKey: string): ResidentAppearance {
  if (typeof residentStableKey !== "string" || residentStableKey.length === 0) throw new RangeError("resident key required");
  const rand = createDomainRandom(githubId, "resident", residentStableKey);
  return {
    key: residentStableKey,
    skin: pick(rand, SKINS),
    hair: pick(rand, HAIRS),
    shirt: pick(rand, SHIRTS),
    pants: pick(rand, PANTS),
    hairStyle: pick(rand, HAIR_STYLES),
    accessory: pickWeighted(rand(), ACCESSORIES),
  };
}

// ---------------------------------------------------------------- evolution

const MOTIF_BY_LANGUAGE: Record<string, Motif> = {
  c: "systems", "c++": "systems", rust: "systems", go: "systems", zig: "systems", assembly: "systems",
  javascript: "web", typescript: "web", html: "web", css: "web", vue: "web", svelte: "web",
  python: "data", r: "data", julia: "data", "jupyter notebook": "data", sql: "data",
  java: "jvm", kotlin: "jvm", scala: "jvm", clojure: "jvm", groovy: "jvm",
  ruby: "scripting", php: "scripting", perl: "scripting", lua: "scripting", shell: "scripting",
  haskell: "functional", elixir: "functional", erlang: "functional", ocaml: "functional", "f#": "functional",
  swift: "mobile", dart: "mobile", "objective-c": "mobile",
};

interface Evolved {
  motif: Motif;
  tier: number;
  litRatio: number;
  excerpt: Excerpt | null;
}

const knownCount = (n: unknown): number | null => (typeof n === "number" && Number.isSafeInteger(n) && n >= 0 ? n : null);

/** Strips markup and control characters and caps the length. Display text only. */
export function sanitizeText(text: string, max = 48): string {
  const clean = text
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001f\u007f-\u009f<>&"'`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return Array.from(clean).slice(0, max).join("").trim();
}

function readEvolution(evo: VisualEvolution | undefined): Evolved {
  let motif: Motif = "neutral";
  let best = 0;
  for (const lang of evo?.dominantLanguages ?? []) {
    const m = typeof lang?.name === "string" ? MOTIF_BY_LANGUAGE[lang.name.toLowerCase()] : undefined;
    if (m && Number.isFinite(lang.weight) && lang.weight > best) {
      best = lang.weight;
      motif = m;
    }
  }

  const commits = knownCount(evo?.commitCount);
  const people = knownCount(evo?.contributorCount);
  const tiers = [
    commits === null ? null : commits < 10 ? 0 : commits < 100 ? 1 : commits < 1000 ? 2 : 3,
    people === null ? null : people <= 1 ? 0 : people < 5 ? 1 : people < 20 ? 2 : 3,
  ].filter((t): t is number => t !== null);
  const tier = tiers.length ? Math.max(...tiers) : 1;

  const a = evo?.recentActivity;
  const litRatio = typeof a === "number" && Number.isFinite(a) ? 0.25 + 0.75 * Math.min(1, Math.max(0, a)) : 0.5;

  const ex = evo?.excerpt;
  const text = ex && (ex.source === "commit" || ex.source === "readme") && typeof ex.text === "string" ? sanitizeText(ex.text) : "";
  return { motif, tier, litRatio, excerpt: text ? { source: ex!.source, text } : null };
}

// ---------------------------------------------------------------- textures

const POSTER_TEXT: Record<Motif, readonly string[]> = {
  neutral: ["KEEP THE LIGHTS ON", "UPTIME IS LIFE", "STAY BELOW"],
  systems: ["NO UNSAFE BLOCKS", "MIND THE STACK", "ZERO COST"],
  web: ["SHIP IT", "WORKS ON MY MACHINE", "CLEAR THE CACHE"],
  data: ["TRUST THE DATA", "PLOT TWIST", "MEAN TIME TO COFFEE"],
  jvm: ["GARBAGE DAY", "WRITE ONCE", "FACTORY FACTORY"],
  scripting: ["ONE LINER", "#!/BIN/BUNKER", "IT RUNS"],
  functional: ["NO SIDE EFFECTS", "PURE BUNKER", "MONAD INSIDE"],
  mobile: ["TAP TO SURVIVE", "LOW BATTERY", "PORTRAIT ONLY"],
};
const NOTE_TEXT = ["TODO: fix gen", "no push friday", "back in 5", "who took my mug", "uptime > ego"];
const SCREEN_TEXT = ["$ git status", "> all quiet", "> ping ...", "$ make bunker"];

function textureFor(identity: BunkerIdentity, roomKey: string, prop: PropDescriptor, evo: Evolved): TextureRecipe | undefined {
  if (prop.kind !== "poster" && prop.kind !== "note" && prop.kind !== "rug" && prop.kind !== "monitor") return undefined;
  const t = createDomainRandom(identity.githubId, "texture", roomKey);
  const seed = Math.floor(t() * 4294967296);
  const { palette: p } = identity;
  const palettes: ReadonlyArray<[string, string, string]> = [
    [p.fabric, p.wall, p.warmLight],
    [p.wood, p.fabric, p.emissive],
    [p.inset, p.emissive, p.warmLight],
  ];
  const palette = pick(t, palettes);
  const canned = pick(t, prop.kind === "poster" ? POSTER_TEXT[evo.motif] : prop.kind === "note" ? NOTE_TEXT : SCREEN_TEXT);
  const text = prop.kind === "rug" ? "" : prop.kind === "monitor" && evo.excerpt ? evo.excerpt.text : canned;
  return { seed, motif: evo.motif, palette: [...palette], text };
}

// ---------------------------------------------------------------- rooms

const FILLABLE = new Set(["crate", "rack", "books", "aquarium", "planter", "mug", "cabinet", "bunk"]);
const CAT_COLORS = ["#1E1A1D", "#D98C3A", "#8A8A8A", "#E6DFC8"];
const ATTEMPTS = 3;

interface Placed {
  prop: PropDescriptor;
  box: Box;
}

function layerOf(def: SlotDef, kind: string): CollisionLayer {
  if (kind === "rug") return "rug";
  if (def.tag === "desktop") return "surface";
  if (def.tag === "ceiling") return "ceiling";
  if (def.tag === "wall-high" || def.tag === "wall-low") return "wall";
  return "floor";
}

/** World AABB of a box rotated about Y: the rotated footprint's extents. */
export function worldBox(position: Vec3, size: Vec3, rotationY: number): Box {
  const c = Math.abs(Math.cos(rotationY));
  const s = Math.abs(Math.sin(rotationY));
  const ex = (c * size[0] + s * size[2]) / 2;
  const ez = (s * size[0] + c * size[2]) / 2;
  return {
    min: [position[0] - ex, position[1], position[2] - ez],
    max: [position[0] + ex, position[1] + size[1], position[2] + ez],
  };
}

const EPS = 1e-6;
export function overlaps(a: Box, b: Box): boolean {
  return [0, 1, 2].every((i) => a.max[i]! > b.min[i]! + EPS && b.max[i]! > a.min[i]! + EPS);
}

const inside = (b: Box) =>
  [0, 1, 2].every((i) => b.min[i]! >= ROOM_BOUNDS.min[i]! - EPS && b.max[i]! <= ROOM_BOUNDS.max[i]! + EPS) &&
  b.max[2] <= FRONT_LANE_Z + EPS;

/** Every random draw for one slot, read from its own stream in a fixed order. */
function planSlot(identity: BunkerIdentity, roomKey: string, def: SlotDef) {
  const rand = createDomainRandom(identity.githubId, "room", roomKey);
  return {
    def,
    roomKey,
    include: rand(),
    kind: pickWeighted(rand(), def.kinds),
    variantRoll: rand(),
    colorRoll: rand(),
    litRoll: rand(),
    fillRoll: rand(),
    attempts: Array.from({ length: ATTEMPTS }, () => [rand(), rand(), rand(), rand()] as const),
  };
}
type Plan = ReturnType<typeof planSlot>;

function tryPlace(plan: Plan, identity: BunkerIdentity, kind: VisualRoomKind, roomSlot: number, evo: Evolved, placed: Placed[]): boolean {
  const { def } = plan;
  const spec = KINDS[plan.kind];
  if (!spec.tags.includes(def.tag)) throw new Error(`slot ${kind}/${def.id}: ${plan.kind} cannot mount on ${def.tag}`);
  const lampForm = plan.kind === "lamp" ? LAMP_FORMS[def.tag] : undefined;
  const support = def.on ? placed.find((p) => p.prop.slot === def.on) : undefined;
  if (def.on && !support) return false;

  const layer = layerOf(def, plan.kind);
  const wallMounted = layer === "wall";
  const variant =
    lampForm?.variant ??
    (spec.variants === "style" ? STYLES.indexOf(identity.furnitureStyle) : Math.floor(plan.variantRoll * spec.variants));
  const color =
    plan.kind === "cat" ? CAT_COLORS[Math.floor(plan.colorRoll * CAT_COLORS.length)]! : identity.palette[spec.colors[Math.floor(plan.colorRoll * spec.colors.length)]!];
  const lit = ["lamp", "monitor", "rack", "generator", "aquarium"].includes(plan.kind) && (def.light === true || plan.litRoll < evo.litRatio);
  const filled = FILLABLE.has(plan.kind) && plan.fillRoll < 0.35 + 0.15 * evo.tier;

  // Jittered tries first, then the authored pose as the deterministic fallback.
  for (const roll of [...plan.attempts, [0.5, 0.5, 0.5, 0.5] as const]) {
    const [jx, jz, js, jr] = roll;
    const s = 1 + (def.scale ?? 0.08) * (2 * js - 1);
    const scale: Vec3 = plan.kind === "rug" ? [r3(s), 1, r3(s)] : [r3(s), r3(s), r3(s)];
    const base = def.size ?? lampForm?.size ?? spec.size;
    const size: Vec3 = [r3(base[0] * scale[0]), r3(base[1] * scale[1]), r3(base[2] * scale[2])];
    let rot = wallMounted ? 0 : (def.rot?.[0] ?? 0) + (def.rot?.[1] ?? 0) * (2 * jr - 1);
    let x = def.x + (def.jitter?.[0] ?? 0) * (2 * jx - 1);
    let z = (def.z ?? 0) + (def.jitter?.[1] ?? 0) * (2 * jz - 1);
    let y = def.y ?? 0;

    if (support) {
      const sp = support.prop;
      const a = sp.rotationY;
      [x, z] = [sp.position[0] + x * Math.cos(a) + z * Math.sin(a), sp.position[2] - x * Math.sin(a) + z * Math.cos(a)];
      y = sp.position[1] + sp.size[1];
      rot += a;
    } else {
      const probe = worldBox([0, 0, 0], size, rot);
      if (def.side) x = def.side * (ROOM_BOUNDS.max[0] - probe.max[0]);
      if (def.z === undefined) z = ROOM_BOUNDS.min[2] - probe.min[2];
      if (def.tag === "ceiling") y = ROOM_BOUNDS.max[1] - size[1];
    }

    const position: Vec3 = [r3(x), r3(y), r3(z)];
    const rotationY = r3(rot);
    const box = worldBox(position, size, rotationY);
    if (!inside(box)) continue;
    if (support) {
      // Mounted props must rest on the support's top, overhanging at most 5 cm.
      const sb = support.box;
      if (box.min[0] < sb.min[0] - 0.05 || box.max[0] > sb.max[0] + 0.05 || box.min[2] < sb.min[2] - 0.05 || box.max[2] > sb.max[2] + 0.05) continue;
    }
    if (layer !== "rug" && !def.seat && RESERVED[kind].some((r) => overlaps(box, r))) continue;
    const blocked = placed.some(
      (p) => p !== support && (p.prop.layer === "rug") === (layer === "rug") && overlaps(box, p.box),
    );
    if (blocked) continue;

    const prop: PropDescriptor = {
      id: `${roomSlot}:${def.id}`,
      slot: def.id,
      tag: def.tag,
      layer,
      kind: plan.kind,
      ...(support ? { support: support.prop.slot } : {}),
      position,
      scale,
      rotationY,
      size,
      color,
      variant,
      state: { lit, filled },
    };
    const texture = textureFor(identity, plan.roomKey, prop, evo);
    placed.push({ prop: texture ? { ...prop, texture } : prop, box });
    return true;
  }
  return false;
}

export function generateRoom(
  identity: BunkerIdentity,
  kind: VisualRoomKind,
  stableRoomSlot: number,
  evolution?: VisualEvolution,
): GeneratedRoom {
  if (!(ROOM_KINDS as readonly string[]).includes(kind)) throw new RangeError(`unknown room kind: ${String(kind)}`);
  if (!Number.isSafeInteger(stableRoomSlot) || stableRoomSlot < 0) throw new RangeError(`invalid room slot: ${stableRoomSlot}`);
  const evo = readEvolution(evolution);
  const chanceBoost = 0.1 * (evo.tier - 1);

  const defs = SLOT_LIBRARY[kind].filter((d) => !d.signature || d.signature === identity.signature);
  const mandatory = defs.filter((d) => d.chance === undefined || d.signature);
  const optional = defs.filter((d) => d.chance !== undefined && !d.signature);
  const plan = (d: SlotDef) => planSlot(identity, `${stableRoomSlot}/${kind}/${d.id}`, d);

  const placed: Placed[] = [];
  for (const def of mandatory) {
    if (!tryPlace(plan(def), identity, kind, stableRoomSlot, evo, placed)) throw new Error(`slot ${kind}/${def.id}: fixture does not fit`);
  }
  const skipped: Plan[] = [];
  for (const def of optional) {
    if (placed.length >= MAX_PROPS) break;
    const p = plan(def);
    if (p.include < def.chance! + chanceBoost) tryPlace(p, identity, kind, stableRoomSlot, evo, placed);
    else skipped.push(p);
  }
  // Too sparse: top up from the skipped decorations, still in library order.
  for (const p of skipped) {
    if (placed.length >= MIN_PROPS) break;
    tryPlace(p, identity, kind, stableRoomSlot, evo, placed);
  }

  return { slot: stableRoomSlot, kind, motif: evo.motif, tier: evo.tier, props: placed.map((p) => p.prop) };
}

/**
 * The whole bunker: identity plus the rooms that actually stand. Without
 * `actualRooms` only the Main Branch (slot 0) is drawn; this layer never
 * decides what a player has unlocked.
 */
export function generateBunker(
  githubId: string | number,
  evolution?: VisualEvolution,
  actualRooms: readonly RoomRef[] = [{ slot: 0, kind: "main" }],
): GeneratedBunker {
  const identity = generateIdentity(githubId);
  const slots = new Set(actualRooms.map((r) => r.slot));
  if (slots.size !== actualRooms.length) throw new RangeError("duplicate room slot");
  const rooms = [...actualRooms]
    .sort((a, b) => a.slot - b.slot)
    .map((r) => generateRoom(identity, r.kind, r.slot, evolution));
  return { identity, rooms };
}
