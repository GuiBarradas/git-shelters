"use client";

import { palette } from "@/lib/palette";

export function BunkerLights() {
  return (
    <>
      <ambientLight color={palette.boneWhite} intensity={1.1} />
      <pointLight
        position={[2, 4, 2]}
        color={palette.glowYellow}
        intensity={6}
        distance={10}
        decay={2}
      />
      <directionalLight
        position={[6, 10, 4]}
        color={palette.mustardWarning}
        intensity={1.6}
      />
    </>
  );
}
