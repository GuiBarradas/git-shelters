import { describe, expect, it } from "vitest";

import { palette } from "@/lib/palette";

const HEX = /^#[0-9A-Fa-f]{6}$/;

describe("palette", () => {
  it("exposes exactly 16 colors", () => {
    expect(Object.keys(palette)).toHaveLength(16);
  });

  it("declares every named color of the bunker palette", () => {
    expect(Object.keys(palette).sort()).toEqual(
      [
        "amber",
        "boneWhite",
        "bunkerBlack",
        "coalBlack",
        "concrete",
        "concreteTan",
        "fadedRed",
        "glowYellow",
        "inactivePlum",
        "lampWarm",
        "mustardWarning",
        "oldWoodBrown",
        "outageGray",
        "phosphorViolet",
        "steelBlue",
        "violetDim",
      ].sort(),
    );
  });

  it("uses 6-digit hex values for every color", () => {
    for (const [name, value] of Object.entries(palette)) {
      expect(value, `${name} = ${value}`).toMatch(HEX);
    }
  });

  it("has no duplicate colors", () => {
    const values = Object.values(palette);
    expect(new Set(values).size).toBe(values.length);
  });
});
