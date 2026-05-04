"use client";

import { palette } from "@/lib/palette";

export function BunkerLights() {
  return (
    <>
      <ambientLight color={palette.steelBlue} intensity={0.55} />
      <pointLight
        position={[2, 4, 2]}
        color={palette.glowYellow}
        intensity={3}
        distance={8}
        decay={2}
      />
      <directionalLight
        position={[6, 10, 4]}
        color={palette.mustardWarning}
        intensity={0.7}
      />
    </>
  );
}
