"use client";

import type { RoomLayout } from "@/components/scene/Fork";
import { palette } from "@/lib/palette";

import { RoomShell } from "./RoomShell";

/** Pinboard on the back wall; the room page pins the bunk roster here. */
export const PINBOARD = {
  position: [1.0, 1.95, -1.22] as [number, number, number],
  width: 1.0,
  height: 0.8,
};

/** Bunk bed along the left wall: frame footprint and mattress heights. */
// Upper bunk clears a seated Fork's head (hips at 0.58, head top near 1.65).
const BUNK = { x: -1.0, z: -0.9, length: 1.9, depth: 0.9, lower: 0.5, upper: 1.85, posts: 2.2 };

/** Pace the open floor; sit on the lower bunk from the front; check the locker. */
export const LAYOUT: RoomLayout = {
  walk: { z: 1.0, xMin: -1.3, xMax: 1.3 },
  stations: [
    {
      position: [BUNK.x + 0.3, 0, BUNK.z + BUNK.depth / 2 - 0.1],
      approach: [BUNK.x + 0.3, 0, 0.6],
      facing: 0,
      action: "sit",
      hold: 7,
      seatY: BUNK.lower + 0.08,
    },
    { position: [0.7, 0, 0.0], facing: Math.PI, action: "inspect", hold: 4 },
  ],
};

/** Dorm: a bunk bed, a footlocker, a pinboard. Two more beds for the Repo. */
export function DormRoom({ powered = true }: { powered?: boolean }) {
  const posts: Array<[number, number]> = [
    [BUNK.x - BUNK.length / 2 + 0.05, BUNK.z - BUNK.depth / 2 + 0.05],
    [BUNK.x + BUNK.length / 2 - 0.05, BUNK.z - BUNK.depth / 2 + 0.05],
    [BUNK.x - BUNK.length / 2 + 0.05, BUNK.z + BUNK.depth / 2 - 0.05],
    [BUNK.x + BUNK.length / 2 - 0.05, BUNK.z + BUNK.depth / 2 - 0.05],
  ];

  return (
    <RoomShell light={palette.lampWarm} lightIntensity={4.5} powered={powered}>
      {/* bunk posts */}
      {posts.map(([x, z], i) => (
        <mesh key={i} position={[x, BUNK.posts / 2, z]}>
          <boxGeometry args={[0.1, BUNK.posts, 0.1]} />
          <meshToonMaterial color={palette.oldWoodBrown} />
        </mesh>
      ))}
      {/* two bunks: slat frame, mattress, blanket, pillow */}
      {[BUNK.lower, BUNK.upper].map((y, i) => (
        <group key={y} position={[BUNK.x, y, BUNK.z]}>
          <mesh position={[0, -0.06, 0]}>
            <boxGeometry args={[BUNK.length, 0.08, BUNK.depth]} />
            <meshToonMaterial color={palette.oldWoodBrown} />
          </mesh>
          <mesh position={[0, 0.04, 0]}>
            <boxGeometry args={[BUNK.length - 0.14, 0.12, BUNK.depth - 0.14]} />
            <meshToonMaterial color={palette.boneWhite} />
          </mesh>
          <mesh position={[0.25, 0.11, 0]}>
            <boxGeometry args={[BUNK.length - 0.7, 0.05, BUNK.depth - 0.2]} />
            <meshToonMaterial color={i === 0 ? palette.steelBlue : palette.fadedRed} />
          </mesh>
          <mesh position={[-BUNK.length / 2 + 0.35, 0.13, 0]}>
            <boxGeometry args={[0.4, 0.1, 0.5]} />
            <meshToonMaterial color={palette.boneWhite} />
          </mesh>
        </group>
      ))}
      {/* ladder on the open end */}
      {[0.6, 0.95, 1.3, 1.65].map((y) => (
        <mesh key={y} position={[BUNK.x + BUNK.length / 2 + 0.08, y, BUNK.z + 0.1]}>
          <boxGeometry args={[0.06, 0.05, 0.5]} />
          <meshToonMaterial color={palette.concreteTan} />
        </mesh>
      ))}
      {/* footlocker */}
      <mesh position={[0.7, 0.24, -0.85]}>
        <boxGeometry args={[0.8, 0.48, 0.5]} />
        <meshToonMaterial color={palette.steelBlue} />
      </mesh>
      <mesh position={[0.7, 0.5, -0.85]}>
        <boxGeometry args={[0.84, 0.05, 0.54]} />
        <meshToonMaterial color={palette.oldWoodBrown} />
      </mesh>
      {/* pinboard: cork, frame, a couple of pinned notes */}
      <mesh position={[PINBOARD.position[0], PINBOARD.position[1], PINBOARD.position[2] - 0.01]}>
        <boxGeometry args={[PINBOARD.width + 0.12, PINBOARD.height + 0.12, 0.04]} />
        <meshToonMaterial color={palette.oldWoodBrown} />
      </mesh>
      <mesh position={PINBOARD.position}>
        <planeGeometry args={[PINBOARD.width, PINBOARD.height]} />
        <meshToonMaterial color={palette.concreteTan} />
      </mesh>
      {/* refinement pass: a rug, a nightstand with its own lamp, boots, a clothes line, two posters */}
      <mesh position={[-0.3, 0.005, 0.35]}>
        <boxGeometry args={[2.2, 0.01, 1.1]} />
        <meshToonMaterial color="#4a2a3a" />
      </mesh>
      <group position={[1.55, 0, -0.9]}>
        <mesh position={[0, 0.3, 0]}>
          <boxGeometry args={[0.45, 0.6, 0.45]} />
          <meshToonMaterial color={palette.oldWoodBrown} />
        </mesh>
        <mesh position={[0, 0.75, 0]}>
          <cylinderGeometry args={[0.05, 0.08, 0.3, 8]} />
          <meshToonMaterial color={palette.coalBlack} />
        </mesh>
        <mesh position={[0, 0.98, 0]}>
          <coneGeometry args={[0.16, 0.16, 10, 1, true]} />
          <meshToonMaterial color={palette.boneWhite} emissive={palette.amber} emissiveIntensity={powered ? 0.7 : 0} side={2} />
        </mesh>
        <pointLight position={[0, 0.9, 0.2]} color={palette.amber} intensity={powered ? 1.2 : 0} distance={2.2} decay={2} />
      </group>
      {[-1.7, -1.5].map((x) => (
        <mesh key={x} position={[x, 0.09, 0.05]}>
          <boxGeometry args={[0.14, 0.18, 0.28]} />
          <meshToonMaterial color={palette.oldWoodBrown} />
        </mesh>
      ))}
      <mesh position={[0.7, 2.45, -0.6]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.01, 0.01, 2.2, 6]} />
        <meshToonMaterial color={palette.boneWhite} />
      </mesh>
      {([[0.1, palette.steelBlue], [0.75, palette.fadedRed], [1.35, palette.boneWhite]] as Array<[number, string]>).map(([x, c], i) => (
        <mesh key={i} position={[x, 2.15, -0.6]}>
          <boxGeometry args={[0.36, 0.5, 0.04]} />
          <meshToonMaterial color={c} />
        </mesh>
      ))}
      <mesh position={[-1.4, 2.35, -1.22]}>
        <planeGeometry args={[0.5, 0.7]} />
        <meshToonMaterial color={palette.inactivePlum} />
      </mesh>
      <mesh position={[-1.4, 2.35, -1.21]}>
        <planeGeometry args={[0.3, 0.3]} />
        <meshToonMaterial color={palette.phosphorViolet} emissive={palette.phosphorViolet} emissiveIntensity={0.4} />
      </mesh>
    </RoomShell>
  );
}
