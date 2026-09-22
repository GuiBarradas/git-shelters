"use client";

import { palette } from "@/lib/palette";

import { RoomShell } from "./RoomShell";

/** Cache Storage: the kitchen and pantry. Shelves, crates, a water barrel. */
export function CacheStorageRoom() {
  const crates: Array<[number, number, number, string, number]> = [
    // x, y, z, colour, size
    [-1.35, 0.3, -0.5, palette.oldWoodBrown, 0.6],
    [-0.7, 0.28, -0.6, palette.mustardWarning, 0.56],
    [-1.05, 0.88, -0.55, palette.oldWoodBrown, 0.5],
    [1.2, 1.63, -1.0, palette.concreteTan, 0.4],
    [0.5, 1.63, -1.0, palette.mustardWarning, 0.4],
    [1.5, 2.13, -1.0, palette.oldWoodBrown, 0.36],
    [0.75, 2.13, -1.0, palette.boneWhite, 0.3],
  ];

  return (
    <RoomShell light={palette.mustardWarning} lightIntensity={3.5}>
      {/* two wall shelves */}
      {[1.4, 1.9].map((y) => (
        <mesh key={y} position={[0.9, y, -1.05]}>
          <boxGeometry args={[2.0, 0.06, 0.6]} />
          <meshToonMaterial color={palette.oldWoodBrown} />
        </mesh>
      ))}
      {crates.map(([x, y, z, color, size], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0, (i % 3) * 0.15, 0]}>
          <boxGeometry args={[size, size, size]} />
          <meshToonMaterial color={color} />
        </mesh>
      ))}
      {/* water barrel */}
      <mesh position={[1.3, 0.5, 0.3]}>
        <cylinderGeometry args={[0.38, 0.38, 1.0, 14]} />
        <meshToonMaterial color={palette.steelBlue} />
      </mesh>
      <mesh position={[1.3, 1.02, 0.3]}>
        <cylinderGeometry args={[0.4, 0.4, 0.06, 14]} />
        <meshToonMaterial color={palette.concreteTan} />
      </mesh>
      {/* prep table with a kettle */}
      <mesh position={[0, 0.5, 0.6]}>
        <boxGeometry args={[1.3, 0.08, 0.7]} />
        <meshToonMaterial color={palette.concreteTan} />
      </mesh>
      <mesh position={[-0.3, 0.68, 0.6]}>
        <cylinderGeometry args={[0.14, 0.17, 0.26, 12]} />
        <meshToonMaterial color={palette.boneWhite} />
      </mesh>
    </RoomShell>
  );
}
