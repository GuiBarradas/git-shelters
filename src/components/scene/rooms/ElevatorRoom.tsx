"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { MeshToonMaterial } from "three";

import type { RoomLayout } from "@/components/scene/Fork";
import { palette } from "@/lib/palette";

import { CELL, RoomShell } from "./RoomShell";

/** Call panel beside the doors; the room page pins the floor read-out here. */
export const CALL_PANEL = {
  position: [1.15, 1.6, -1.22] as [number, number, number],
  width: 0.7,
  height: 0.5,
};

/** Wait in front of the doors; check the panel. */
export const LAYOUT: RoomLayout = {
  walk: { z: 1.1, xMin: -1.3, xMax: 0.6 },
  stations: [
    { position: [-0.4, 0, 0.55], facing: Math.PI, action: "inspect", hold: 5 },
    { position: [0.85, 0, 0.1], facing: Math.PI, action: "inspect", hold: 3 },
  ],
};

/**
 * Elevator: a shaft cut through the back wall, two steel doors, a floor
 * indicator that ticks, and a cage frame going down. The car itself is
 * not animated; the shaft is what unlocks the floor below.
 */
export function ElevatorRoom({ powered = true }: { powered?: boolean }) {
  const indicator = useRef<MeshToonMaterial>(null);
  useFrame(({ clock }) => {
    if (!indicator.current) return;
    indicator.current.emissiveIntensity = powered ? 0.6 + (Math.sin(clock.elapsedTime * 1.5) > 0.5 ? 0.8 : 0) : 0;
  });

  const doorW = 0.62;
  return (
    <RoomShell light={palette.lampWarm} lightIntensity={4} powered={powered}>
      {/* shaft opening: a dark recess in the back wall, framed in steel */}
      <mesh position={[-0.4, 1.25, -1.2]}>
        <boxGeometry args={[1.5, 2.5, 0.12]} />
        <meshToonMaterial color={palette.coalBlack} />
      </mesh>
      <mesh position={[-0.4, 2.55, -1.15]}>
        <boxGeometry args={[1.7, 0.12, 0.2]} />
        <meshToonMaterial color={palette.steelBlue} />
      </mesh>
      {[-1.2, 0.4].map((x) => (
        <mesh key={x} position={[x, 1.25, -1.15]}>
          <boxGeometry args={[0.12, 2.6, 0.2]} />
          <meshToonMaterial color={palette.steelBlue} />
        </mesh>
      ))}
      {/* two doors, ajar */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[-0.4 + side * (doorW / 2 + 0.06), 1.2, -1.1]}>
          <boxGeometry args={[doorW, 2.4, 0.06]} />
          <meshToonMaterial color={palette.concrete} />
        </mesh>
      ))}
      {/* cage going down through the floor slab */}
      {[-1.05, 0.25].map((x) => (
        <mesh key={x} position={[x, -0.6, -1.15]}>
          <boxGeometry args={[0.08, 1.2, 0.08]} />
          <meshToonMaterial color={palette.steelBlue} />
        </mesh>
      ))}
      {/* floor indicator over the doors */}
      <mesh position={[-0.4, 2.75, -1.1]}>
        <boxGeometry args={[0.5, 0.16, 0.06]} />
        <meshToonMaterial ref={indicator} color={palette.coalBlack} emissive={palette.amber} emissiveIntensity={0.6} />
      </mesh>
      {/* call panel: plate and the button */}
      <mesh position={[CALL_PANEL.position[0], CALL_PANEL.position[1], CALL_PANEL.position[2] - 0.01]}>
        <boxGeometry args={[CALL_PANEL.width + 0.1, CALL_PANEL.height + 0.1, 0.04]} />
        <meshToonMaterial color={palette.steelBlue} />
      </mesh>
      <mesh position={[CALL_PANEL.position[0], CALL_PANEL.position[1] - CALL_PANEL.height / 2 - 0.16, -1.2]}>
        <cylinderGeometry args={[0.06, 0.06, 0.05, 10]} />
        <meshToonMaterial color={palette.coalBlack} emissive={palette.phosphorViolet} emissiveIntensity={powered ? 0.9 : 0} />
      </mesh>
      {/* a floor grate in front of the doors */}
      <mesh position={[-0.4, 0.01, 0.2]}>
        <boxGeometry args={[1.6, 0.02, 1.0]} />
        <meshToonMaterial color={palette.steelBlue} />
      </mesh>
      {/* keep the wall height constant for the shaft frame */}
      <group position={[0, CELL.h, 0]} />
      {/* refinement pass: a caged shaft light, warning sign, floor stencil, a bench, extinguisher, shaft cables */}
      <group position={[-0.4, 2.85, -0.9]}>
        <mesh>
          <cylinderGeometry args={[0.1, 0.12, 0.18, 8, 1, true]} />
          <meshToonMaterial color={palette.coalBlack} wireframe />
        </mesh>
        <mesh position={[0, -0.02, 0]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshToonMaterial color={palette.boneWhite} emissive={palette.amber} emissiveIntensity={powered ? 1.1 : 0} />
        </mesh>
        <pointLight position={[0, -0.15, 0.2]} color={palette.amber} intensity={powered ? 1.4 : 0} distance={2.6} decay={2} />
      </group>
      <mesh position={[1.15, 2.35, -1.22]}>
        <planeGeometry args={[0.6, 0.36]} />
        <meshToonMaterial color={palette.amber} />
      </mesh>
      <mesh position={[1.15, 2.35, -1.21]}>
        <planeGeometry args={[0.42, 0.05]} />
        <meshToonMaterial color={palette.coalBlack} />
      </mesh>
      <mesh position={[-0.4, 0.012, 0.85]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.16, 0.22, 16]} />
        <meshToonMaterial color={palette.amber} />
      </mesh>
      <group position={[1.4, 0, 0.4]}>
        <mesh position={[0, 0.28, 0]}>
          <boxGeometry args={[0.7, 0.06, 0.3]} />
          <meshToonMaterial color={palette.oldWoodBrown} />
        </mesh>
        {[-0.28, 0.28].map((x) => (
          <mesh key={x} position={[x, 0.13, 0]}>
            <boxGeometry args={[0.06, 0.26, 0.26]} />
            <meshToonMaterial color={palette.steelBlue} />
          </mesh>
        ))}
      </group>
      <group position={[1.75, 0.95, -1.12]}>
        <mesh>
          <cylinderGeometry args={[0.08, 0.08, 0.46, 10]} />
          <meshToonMaterial color={palette.fadedRed} />
        </mesh>
        <mesh position={[0, 0.28, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.1, 8]} />
          <meshToonMaterial color={palette.coalBlack} />
        </mesh>
      </group>
      {[-0.85, 0.05].map((x) => (
        <mesh key={x} position={[x, 1.5, -1.19]}>
          <boxGeometry args={[0.02, 3.0, 0.02]} />
          <meshToonMaterial color="#1c1e22" />
        </mesh>
      ))}
    </RoomShell>
  );
}
