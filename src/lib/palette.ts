export const palette = {
  outageGray: "#2A2D34",
  concreteTan: "#8B7E5A",
  /** Poured concrete of the shell: cool, slightly violet, never yellow. */
  concrete: "#45414F",
  /** Warm lamp light: amber-white, so wood and skin stay warm without going mustard. */
  lampWarm: "#FFC98A",
  /** Phosphor of the terminals, LEDs and UI: the Repo's own light. */
  phosphorViolet: "#BD93F9",
  /** Dim violet for borders, glows and idle tint. */
  violetDim: "#8D46A3",
  /** Warm lamps, calls to action and warnings. */
  amber: "#E67E22",
  /** Page and panel background. */
  bunkerBlack: "#0B0713",
  /** Unbuilt cells and inactive blocks. */
  inactivePlum: "#2D2235",
  mustardWarning: "#D4A24C",
  oldWoodBrown: "#5C3A21",
  coalBlack: "#0F0F0F",
  boneWhite: "#E6DFC8",
  fadedRed: "#A14545",
  steelBlue: "#3A4A5A",
  glowYellow: "#FFD66B",
} as const;

export type PaletteColorName = keyof typeof palette;
export type PaletteColor = (typeof palette)[PaletteColorName];
