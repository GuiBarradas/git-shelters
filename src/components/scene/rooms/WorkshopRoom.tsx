"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { MeshToonMaterial } from "three";

import type { RoomLayout } from "@/components/scene/Fork";
import { palette } from "@/lib/palette";

import { RoomShell } from "./RoomShell";

/** Chalkboard over the bench; the room page pins the stock count here. */
export const CHALKBOARD = {
  // The shell's back wall face is at z = -1.25; anything deeper is inside it.
  position: [0.95, 1.95, -1.22] as [number, number, number],
  width: 1.0,
  height: 0.8,
};

/** Pace the open floor; work at the bench; count the crates. */
export const LAYOUT: RoomLayout = {
  walk: { z: 1.15, xMin: -1.3, xMax: 1.3 },
  stations: [
    { position: [-0.7, 0, 0.3], facing: Math.PI, action: "work", hold: 6 },
    { position: [1.1, 0, 0.2], facing: Math.PI, action: "inspect", hold: 4 },
  ],
};

/** Workshop: a workbench with a vice, a pegboard of tools, crates of Payload, a welding flicker. */
export function WorkshopRoom({ powered = true }: { powered?: boolean }) {
  const spark = useRef<MeshToonMaterial>(null);

  useFrame(({ clock }) => {
    if (!spark.current) return;
    const t = clock.elapsedTime;
    spark.current.emissiveIntensity = powered && Math.sin(t * 17) * Math.sin(t * 3.1) > 0.7 ? 2.5 : 0;
  });

  const tools: Array<[number, number, number, number]> = [
    // x, y, width, height on the pegboard
    [-1.5, 2.1, 0.08, 0.5],
    [-1.3, 2.05, 0.2, 0.12],
    [-1.05, 2.15, 0.08, 0.4],
    [-0.85, 2.0, 0.24, 0.1],
    [-0.6, 2.1, 0.1, 0.36],
  ];

  return (
    <RoomShell light={palette.glowYellow} lightIntensity={3.2} powered={powered}>
      {/* pegboard */}
      <mesh position={[-1.05, 2.05, -1.22]}>
        <boxGeometry args={[1.5, 0.9, 0.04]} />
        <meshToonMaterial color={palette.concreteTan} />
      </mesh>
      {tools.map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, -1.19]}>
          <boxGeometry args={[w, h, 0.04]} />
          <meshToonMaterial color={i % 2 ? palette.steelBlue : palette.coalBlack} />
        </mesh>
      ))}
      {/* workbench: top, legs, a vice, a spark */}
      <mesh position={[-0.7, 0.8, -0.35]}>
        <boxGeometry args={[1.8, 0.1, 0.8]} />
        <meshToonMaterial color={palette.oldWoodBrown} />
      </mesh>
      {[-1.5, 0.1].map((x) =>
        [-0.7, 0.0].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.38, z]}>
            <boxGeometry args={[0.1, 0.76, 0.1]} />
            <meshToonMaterial color={palette.coalBlack} />
          </mesh>
        )),
      )}
      <mesh position={[-0.2, 0.98, -0.45]}>
        <boxGeometry args={[0.3, 0.26, 0.22]} />
        <meshToonMaterial color={palette.steelBlue} />
      </mesh>
      <mesh position={[-0.9, 0.93, -0.3]}>
        <boxGeometry args={[0.16, 0.16, 0.16]} />
        <meshToonMaterial ref={spark} color={palette.coalBlack} emissive={palette.glowYellow} emissiveIntensity={0} />
      </mesh>
      {/* crates of Payload, stencilled red */}
      {(
        [
          [1.0, 0.25, -0.8, 0.5],
          [1.55, 0.25, -0.75, 0.5],
          [1.27, 0.75, -0.78, 0.5],
        ] as Array<[number, number, number, number]>
      ).map(([x, y, z, s], i) => (
        <group key={i} position={[x, y, z]}>
          <mesh>
            <boxGeometry args={[s, s, s]} />
            <meshToonMaterial color={palette.oldWoodBrown} />
          </mesh>
          <mesh position={[0, 0, s / 2 + 0.005]}>
            <planeGeometry args={[s * 0.5, s * 0.22]} />
            <meshToonMaterial color={palette.fadedRed} />
          </mesh>
        </group>
      ))}
      {/* chalkboard: slate and frame */}
      <mesh position={[CHALKBOARD.position[0], CHALKBOARD.position[1], CHALKBOARD.position[2] - 0.01]}>
        <boxGeometry args={[CHALKBOARD.width + 0.12, CHALKBOARD.height + 0.12, 0.04]} />
        <meshToonMaterial color={palette.oldWoodBrown} />
      </mesh>
      <mesh position={CHALKBOARD.position}>
        <planeGeometry args={[CHALKBOARD.width, CHALKBOARD.height]} />
        <meshToonMaterial color={palette.coalBlack} />
      </mesh>
    </RoomShell>
  );
}
