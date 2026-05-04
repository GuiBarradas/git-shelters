export const palette = {
  outageGray: "#2A2D34",
  concreteTan: "#8B7E5A",
  radioactiveGreen: "#7FFF6A",
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
