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
      {RUBBLE.map(([x, y, z, s], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0.2 * i, 0.5 * i, 0]}>
          <boxGeometry args={[s, s, s]} />
          <meshToonMaterial color="#26282d" />
        </mesh>
      ))}
      {/* build frame */}
      <mesh position={[0, 1.5, 0.3]}>
        <boxGeometry args={[2.6, 2.2, 1.6]} />
        <meshToonMaterial
          color={palette.radioactiveGreen}
          transparent
          opacity={highlight ? 0.22 : 0.07}
          emissive={palette.radioactiveGreen}
          emissiveIntensity={highlight ? 0.4 : 0.05}
        />
      </mesh>
    </RoomShell>
  );
}
