"use client";

import type { RoomLayout } from "@/components/scene/Fork";
import { palette } from "@/lib/palette";

import { RoomShell } from "./RoomShell";

/** Clipboard on the back wall; the room page pins the ledger manifest here. */
export const CLIPBOARD = {
  position: [-1.0, 1.95, -1.36] as [number, number, number],
  width: 1.0,
  height: 0.8,
};

/** Pace in front of the prep table; work at it; check the shelves. */
export const LAYOUT: RoomLayout = {
  walk: { z: 1.15, xMin: -1.2, xMax: 0.7 },
  stations: [
    { position: [0, 0, 0.55], facing: Math.PI, action: "work", hold: 6 },
    { position: [1.0, 0, -0.35], facing: Math.PI, action: "inspect", hold: 4 },
  ],
};

/** Cache Storage: the kitchen and pantry. Shelves, crates, a water barrel. */
export function CacheStorageRoom({ powered = true }: { powered?: boolean }) {
  const crates: Array<[number, number, number, string, number]> = [
    // x, y, z, colour, size
    [-1.35, 0.3, -0.5, palette.oldWoodBrown, 0.6],
    [-0.7, 0.28, -0.6, palette.steelBlue, 0.56],
    [-1.05, 0.88, -0.55, palette.oldWoodBrown, 0.5],
    [1.2, 1.63, -1.0, palette.concreteTan, 0.4],
    [0.5, 1.63, -1.0, palette.oldWoodBrown, 0.4],
    [1.5, 2.13, -1.0, palette.oldWoodBrown, 0.36],
    [0.75, 2.13, -1.0, palette.boneWhite, 0.3],
  ];

  return (
    <RoomShell light={palette.lampWarm} lightIntensity={4.5} powered={powered}>
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
      <mesh position={[1.5, 0.5, 0.3]}>
        <cylinderGeometry args={[0.38, 0.38, 1.0, 14]} />
        <meshToonMaterial color={palette.steelBlue} />
      </mesh>
      <mesh position={[1.5, 1.02, 0.3]}>
        <cylinderGeometry args={[0.4, 0.4, 0.06, 14]} />
        <meshToonMaterial color={palette.concreteTan} />
      </mesh>
      {/* clipboard: board, clip, paper */}
      <mesh position={[CLIPBOARD.position[0], CLIPBOARD.position[1], CLIPBOARD.position[2] - 0.01]}>
        <boxGeometry args={[CLIPBOARD.width + 0.1, CLIPBOARD.height + 0.14, 0.03]} />
        <meshToonMaterial color={palette.oldWoodBrown} />
      </mesh>
      <mesh position={[CLIPBOARD.position[0], CLIPBOARD.position[1] + CLIPBOARD.height / 2 + 0.03, CLIPBOARD.position[2] + 0.02]}>
        <boxGeometry args={[0.3, 0.08, 0.05]} />
        <meshToonMaterial color={palette.coalBlack} />
      </mesh>
      <mesh position={CLIPBOARD.position}>
        <planeGeometry args={[CLIPBOARD.width, CLIPBOARD.height]} />
        <meshToonMaterial color={palette.boneWhite} />
      </mesh>
      {/* prep table with a kettle */}
      <mesh position={[0, 0.66, 0.1]}>
        <boxGeometry args={[1.3, 0.08, 0.6]} />
        <meshToonMaterial color={palette.concreteTan} />
      </mesh>
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} position={[x, 0.31, 0.1]}>
          <boxGeometry args={[0.08, 0.62, 0.5]} />
          <meshToonMaterial color={palette.concreteTan} />
        </mesh>
      ))}
      <mesh position={[-0.3, 0.84, 0.1]}>
        <cylinderGeometry args={[0.14, 0.17, 0.26, 12]} />
        <meshToonMaterial color={palette.boneWhite} />
      </mesh>
    </RoomShell>
  );
}
