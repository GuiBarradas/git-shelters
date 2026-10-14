import { afterEach, describe, expect, it, vi } from "vitest";

import { generateBunker, generateIdentity, generateResidentAppearance, generateRoom, sanitizeText } from "@/lib/visuals/generate";
import { canonicalGithubId, createDomainRandom } from "@/lib/visuals/seed";
import type { VisualEvolution } from "@/lib/visuals/types";

const ids = (n: number) => Array.from({ length: n }, (_, i) => 1000 + i * 7919);
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];

const RICH: VisualEvolution = {
  dominantLanguages: [{ name: "TypeScript", weight: 0.3 }, { name: "Rust", weight: 0.6 }],
  contributorCount: 40,
  commitCount: 5000,
  recentActivity: 1,
  excerpt: { source: "commit", text: "fix(gen): stop the flicker" },
};

describe("visual identity", () => {
  afterEach(() => vi.restoreAllMocks());

  it("matches the recorded recipe for a fixed id", () => {
    const bunker = generateBunker("583231", RICH, [{ slot: 0, kind: "main" }]);
    expect({ bunker, resident: generateResidentAppearance("583231", "fork-7f3a") }).toMatchSnapshot();
  });

  it("is deterministic and never touches Math.random", () => {
    vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random called");
    });
    const rooms = [{ slot: 0, kind: "main" }, { slot: 1, kind: "dorm" }, { slot: 5, kind: "workshop" }] as const;
    expect(generateBunker(42, RICH, rooms)).toEqual(generateBunker(42, RICH, rooms));
    expect(generateResidentAppearance(42, "a")).toEqual(generateResidentAppearance(42, "a"));
  });

  it("treats a numeric string and the same number as one identity", () => {
    expect(generateIdentity("583231")).toEqual(generateIdentity(583231));
    expect(canonicalGithubId(Number.MAX_SAFE_INTEGER)).toBe(String(Number.MAX_SAFE_INTEGER));
  });

  it("rejects anything that is not a positive safe integer id, including logins", () => {
    for (const bad of [0, -1, 1.5, NaN, Infinity, 2 ** 53, "0", "01", "1.0", "1e3", " 12", "-5", "", "octocat", "9007199254740993"]) {
      expect(() => generateIdentity(bad as string | number)).toThrow(RangeError);
    }
  });

  it("keeps domains independent", () => {
    const first = (domain: Parameters<typeof createDomainRandom>[1], key?: string) => createDomainRandom(77, domain, key)();
    const draws = (["palette", "wear", "furniture", "resident", "signature", "room", "texture"] as const).map((d) => first(d));
    expect(new Set(draws).size).toBe(draws.length);
    expect(first("room", "a")).not.toBe(first("room", "b"));
    expect(createDomainRandom(77, "room", "a")()).not.toBe(createDomainRandom(78, "room", "a")());
  });

  it("draws palettes from the warm curated family: amber light, violet screens, never green", () => {
    for (const id of ids(200)) {
      const { palette, wear, furnitureStyle } = generateIdentity(id);
      for (const hex of Object.values(palette)) {
        expect(hex).toMatch(/^#[0-9A-F]{6}$/);
        const [r, g, b] = rgb(hex);
        expect(g).toBeLessThanOrEqual(Math.max(r, b));
      }
      const [lr, lg, lb] = rgb(palette.warmLight);
      expect(lr >= lg && lg >= lb).toBe(true);
      const [er, eg, eb] = rgb(palette.emissive);
      expect(eb > er && er > eg).toBe(true);
      expect(wear).toBeGreaterThanOrEqual(0);
      expect(wear).toBeLessThanOrEqual(1);
      expect(["salvaged", "industrial", "domestic"]).toContain(furnitureStyle);
    }
    expect(new Set(ids(200).map((id) => generateIdentity(id).palette.wall)).size).toBeGreaterThan(20);
    expect(new Set(ids(200).map((id) => generateIdentity(id).furnitureStyle)).size).toBe(3);
  });

  it("gives about 9% of bunkers a rare signature", () => {
    const sigs = ids(3000).map((id) => generateIdentity(id).signature);
    const rate = sigs.filter((s) => s !== null).length / sigs.length;
    expect(rate).toBeGreaterThan(0.06);
    expect(rate).toBeLessThan(0.12);
    expect(new Set(sigs)).toEqual(new Set([null, "aquarium", "cat", "flag"]));
  });

  it("never lets repository data change the fixed identity or resident looks", () => {
    const quiet = generateBunker(9001, { recentActivity: 0, commitCount: 1 }, [{ slot: 0, kind: "main" }]);
    const busy = generateBunker(9001, RICH, [{ slot: 0, kind: "main" }]);
    expect(busy.identity).toEqual(quiet.identity);
    expect(busy.identity).toEqual(generateIdentity(9001));
    // Evolution only reaches rooms: furniture keeps its style variant and palette colors.
    const style = (r: typeof quiet) => r.rooms[0]!.props.find((p) => p.kind === "desk")!;
    expect(style(busy).variant).toBe(style(quiet).variant);
    expect(style(busy).color).toBe(style(quiet).color);
  });
});

describe("residents", () => {
  it("keeps each resident's look when others are added or reordered", () => {
    const before = ["r-1", "r-2"].map((k) => generateResidentAppearance(555, k));
    const after = ["r-9", "r-2", "r-3", "r-1"].map((k) => generateResidentAppearance(555, k));
    expect(after.find((r) => r.key === "r-1")).toEqual(before[0]);
    expect(after.find((r) => r.key === "r-2")).toEqual(before[1]);
  });

  it("stays inside the quantized chibi wardrobe and still varies", () => {
    const looks = Array.from({ length: 300 }, (_, i) => generateResidentAppearance(321, `fork-${i}`));
    for (const look of looks) {
      expect(["swept", "crop", "parted"]).toContain(look.hairStyle);
      expect(["none", "headlamp", "scarf", "goggles"]).toContain(look.accessory);
      for (const hex of [look.skin, look.hair, look.shirt, look.pants]) expect(hex).toMatch(/^#[0-9A-F]{6}$/);
    }
    expect(new Set(looks.map((l) => l.accessory)).size).toBe(4);
    expect(new Set(looks.map((l) => l.shirt)).size).toBeGreaterThan(4);
    expect(looks.filter((l) => l.accessory === "none").length).toBeGreaterThan(looks.length / 3);
    expect(() => generateResidentAppearance(321, "")).toThrow(RangeError);
  });
});

describe("evolution", () => {
  const identity = generateIdentity(4242);

  it("reads unknown data as neutral instead of inventing counts", () => {
    const room = generateRoom(identity, "main", 0);
    expect(room.motif).toBe("neutral");
    expect(room.tier).toBe(1);
    expect(generateRoom(identity, "main", 0, { commitCount: -3, contributorCount: 1.5, recentActivity: NaN })).toEqual(room);
  });

  it("themes by the heaviest known language and scales richness with history", () => {
    expect(generateRoom(identity, "main", 0, RICH).motif).toBe("systems");
    expect(generateRoom(identity, "main", 0, { dominantLanguages: [{ name: "Brainfuck", weight: 1 }] }).motif).toBe("neutral");
    expect(generateRoom(identity, "main", 0, { commitCount: 3 }).tier).toBe(0);
    expect(generateRoom(identity, "main", 0, RICH).tier).toBe(3);

    const total = (evo: VisualEvolution) =>
      ids(100).reduce((sum, id) => sum + generateRoom(generateIdentity(id), "workshop", 1, evo).props.length, 0);
    expect(total({ commitCount: 5000 })).toBeGreaterThan(total({ commitCount: 1 }));
  });

  it("lights more lamps when the repository is active", () => {
    const lit = (recentActivity: number) =>
      ids(100).reduce(
        (sum, id) => sum + generateRoom(generateIdentity(id), "main", 0, { recentActivity }).props.filter((p) => p.state.lit).length,
        0,
      );
    expect(lit(1)).toBeGreaterThan(lit(0));
  });

  it("cleans excerpts and lets them change only the screen text", () => {
    const dirty = "<b>fix</b>\u0000 the\n\tgen <script>alert(1)</script> " + "x".repeat(200);
    const text = sanitizeText(dirty);
    expect(text).not.toMatch(/[<>\u0000-\u001f]/);
    expect(text.length).toBeLessThanOrEqual(48);
    expect(text.startsWith("fix the gen")).toBe(true);

    const a = generateRoom(identity, "main", 0, { excerpt: { source: "commit", text: "first" } });
    const b = generateRoom(identity, "main", 0, { excerpt: { source: "readme", text: dirty } });
    const monitor = (r: typeof a) => r.props.find((p) => p.kind === "monitor")!;
    expect(monitor(a).texture!.text).toBe("first");
    expect(monitor(b).texture!.text).toBe(text);
    const strip = (r: typeof a) => r.props.map((p) => (p.kind === "monitor" ? { ...p, texture: { ...p.texture!, text: "" } } : p));
    expect(strip(a)).toEqual(strip(b));
  });
});
