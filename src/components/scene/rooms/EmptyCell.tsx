"use client";

import { palette } from "@/lib/palette";

import { RoomShell } from "./RoomShell";

/** x, y, z, size */
const RUBBLE: Array<[number, number, number, number]> = [
  [-1.1, 0.18, 0.3, 0.42],
  [-0.6, 0.12, -0.5, 0.3],
  [0.9, 0.15, 0.1, 0.36],
  [1.3, 0.1, -0.7, 0.24],
];

/** An unbuilt cell: dark, rubble on the floor, a faint frame hinting "build here". */
export function EmptyCell({ highlight = false }: { highlight?: boolean }) {
  return (
    <RoomShell dim>
      {/* cold work light so the rubble reads even before anyone builds */}
      <pointLight position={[0, 2.4, 0.8]} color={palette.steelBlue} intensity={highlight ? 3 : 1.4} distance={6} decay={2} />
      {RUBBLE.map(([x, y, z, s], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0.2 * i, 0.5 * i, 0]}>
          <boxGeometry args={[s, s, s]} />
          <meshToonMaterial color="#33363c" />
        </mesh>
      ))}
      {/* build frame */}
      <mesh position={[0, 1.5, 0.3]}>
        <boxGeometry args={[2.6, 2.2, 1.6]} />
        <meshToonMaterial
          color={palette.phosphorViolet}
          transparent
          opacity={highlight ? 0.26 : 0.12}
          emissive={palette.phosphorViolet}
          emissiveIntensity={highlight ? 0.6 : 0.18}
        />
      </mesh>
    </RoomShell>
  );
}
