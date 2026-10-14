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

/**
 * Darkened tones of the palette for the 404 Lands plateaus (map brief),
 * plus the two recorded exceptions: the Cluster's cold blue (a light tone
 * of steelBlue) and the lit beacon red (a tone of fadedRed).
 */
export const mapTones = {
  /** The night sky behind the diorama. */
  mapSky: "#0c0911",
  mapFloor: "#100b16",
  /** Hemisphere sky of the night fill (a lifted inactivePlum); the ground side is bunkerBlack. */
  nightSky: "#3b2f5c",
  /** The high moon that lights the plateau walls (a pale phosphorViolet). */
  moon: "#9d8fd6",
  outageTop: "#1d1724",
  outageSide: "#110c17",
  staticTop: "#3a3445",
  staticSide: "#211c29",
  heapTop: "#2e2420",
  heapSide: "#1b1412",
  clusterTop: "#1f2733",
  clusterSide: "#131921",
  mainframeTop: "#3a3428",
  mainframeSide: "#231e17",
  sandboxSide: "#1a1420",
  edgeTop: "#4a4652",
  edgeSide: "#2b2832",
  /** Bunker hatch and antenna mast (concrete tones). */
  hatch: "#2c2733",
  mast: "#3a3445",
  /** The faint brown ember of a bunker idle for over a week (a lit oldWoodBrown). */
  ember: "#6b4630",
  /** Region props: Static antennas and CRT shells, Cluster racks, Mainframe beige, Edge obelisks. */
  antenna: "#4a4458",
  crt: "#2e2a35",
  rack: "#2a3442",
  /** A paler concreteTan for the Mainframe cabinets. */
  beige: "#b3a888",
  /** A shaded boneWhite: the Edge obelisks. */
  obelisk: "#cfc8b2",
  /** The signal-fog cloud cards over locked regions (a dim violet). */
  fogCard: "#4a3a62",
  clusterBlue: "#8fb3d9",
  beaconRed: "#e05a5a",
} as const;

export type PaletteColorName = keyof typeof palette;
export type PaletteColor = (typeof palette)[PaletteColorName];
