import { describe, expect, it } from "vitest";

import { FORK_TRAITS, forkLook, generateForkName, isForkTrait, pickTrait } from "@/lib/forks/catalog";

describe("fork catalog", () => {
  it("is deterministic: the same seed always yields the same survivor", () => {
    for (const seed of [0, 1, 42, 77, 2_147_483_646]) {
      expect(generateForkName(seed)).toBe(generateForkName(seed));
      expect(pickTrait(seed)).toBe(pickTrait(seed));
      expect(forkLook(seed)).toEqual(forkLook(seed));
    }
  });

  it("varies across seeds", () => {
    const names = new Set(Array.from({ length: 50 }, (_, i) => generateForkName(i * 7919)));
    const traits = new Set(Array.from({ length: 50 }, (_, i) => pickTrait(i * 7919)));
    expect(names.size).toBeGreaterThan(20);
    expect(traits.size).toBeGreaterThan(4);
  });

  it("names read like handles and traits are always from the catalog", () => {
    for (let i = 0; i < 30; i++) {
      expect(generateForkName(i)).toMatch(/^[A-Z][a-z]+[_-][A-Za-z0-9_]+$/);
      expect(isForkTrait(pickTrait(i))).toBe(true);
    }
  });

  it("every trait has a line to say", () => {
    for (const trait of Object.values(FORK_TRAITS)) {
      expect(trait.line.length).toBeGreaterThan(0);
      expect(trait.name.length).toBeGreaterThan(0);
    }
  });
});
