"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Mesh, MeshToonMaterial } from "three";

import type { RoomLayout } from "@/components/scene/Fork";
import { palette } from "@/lib/palette";

import { RoomShell } from "./RoomShell";

type Props = {
  /** Brighter, restless screen while today's Daily Event is unresolved. */
  pending?: boolean;
  /** The bunker pushed code today: the whole room feels alive. */
  active?: boolean;
};

/**
 * Main Branch: the command room. A desk with the terminal whose screen
 * carries the Daily Event, a server rack with blinking LEDs, a chair.
 * The screen is exported at SCREEN so the room page can pin HTML to it.
 */
export const SCREEN = {
  // On the front face of the terminal body (body front is z = -0.5).
  position: [0.55, 1.07, -0.495] as [number, number, number],
  width: 0.98,
  height: 0.7,
};

/** Where a Fork can pace and what it can do here. Chair seat is at y = 0.42. */
export const LAYOUT: RoomLayout = {
  // The whole layout stays left of the terminal: its HTML panel is DOM and
  // paints over the canvas, so a Fork crossing the screen's area (even in
  // front of the desk) would vanish behind the text. xMax keeps a head's
  // width of clearance from the screen's left edge (x = 0.07).
  walk: { z: 1.05, xMin: -1.35, xMax: -0.2 },
  stations: [
    // Off the screen's axis: the terminal's HTML panel is DOM, always drawn
    // over the canvas, so a Fork sitting dead-centre would vanish behind it.
    { position: [-0.32, 0, 0.42], facing: Math.PI - 0.35, action: "type", hold: 7, seatY: 0.42 },
    { position: [-0.85, 0, -0.2], facing: -Math.PI / 2, action: "inspect", hold: 4 },
  ],
};

export function MainBranchRoom({ pending = false, active = false }: Props) {
  const screen = useRef<MeshToonMaterial>(null);
  const leds = useRef<Mesh[]>([]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (screen.current) {
      // CRT flicker: a slow breathe plus a fast jitter, stronger when pending.
      const base = pending ? 1.4 : 0.8;
      screen.current.emissiveIntensity = base + Math.sin(t * 2.1) * 0.15 + (Math.random() - 0.5) * 0.12;
    }
    leds.current.forEach((led, i) => {
      if (!led) return;
      const on = Math.sin(t * (1.7 + i * 0.9) + i) > 0.2;
      (led.material as MeshToonMaterial).emissiveIntensity = on ? 1.6 : 0.1;
    });
  });

  const screenColor = pending ? palette.radioactiveGreen : active ? palette.radioactiveGreen : palette.glowYellow;

  return (
    <RoomShell light={active ? palette.radioactiveGreen : palette.glowYellow} lightIntensity={active ? 5 : 3.5}>
      {/* desk: waist height for a 1.45-tall survivor */}
      <mesh position={[0.55, 0.66, -0.55]}>
        <boxGeometry args={[2.1, 0.1, 0.9]} />
        <meshToonMaterial color={palette.oldWoodBrown} />
      </mesh>
      {[-0.95, 0.95].map((x) => (
        <mesh key={x} position={[0.55 + x, 0.31, -0.55]}>
          <boxGeometry args={[0.1, 0.62, 0.7]} />
          <meshToonMaterial color={palette.oldWoodBrown} />
        </mesh>
      ))}
      {/* terminal body + screen bezel + screen */}
      <mesh position={[0.55, 1.07, -0.75]}>
        <boxGeometry args={[1.12, 0.86, 0.5]} />
        <meshToonMaterial color={palette.concreteTan} />
      </mesh>
      <mesh position={[0.55, 1.07, -0.5]}>
        <planeGeometry args={[1.06, 0.78]} />
        <meshToonMaterial color={palette.coalBlack} />
      </mesh>
      <mesh position={SCREEN.position}>
        <planeGeometry args={[SCREEN.width, SCREEN.height]} />
        <meshToonMaterial ref={screen} color="#062a0c" emissive={screenColor} emissiveIntensity={1} />
      </mesh>
      {/* keyboard */}
      <mesh position={[-0.05, 0.74, -0.25]} rotation={[0, 0.35, 0]}>
        <boxGeometry args={[0.7, 0.05, 0.24]} />
        <meshToonMaterial color={palette.coalBlack} />
      </mesh>
      {/* chair at the desk, facing the screen; the Fork sits here to type */}
      <group position={[-0.32, 0, 0.42]} rotation={[0, -0.35, 0]}>
        <mesh position={[0, 0.4, 0]}>
          <boxGeometry args={[0.5, 0.06, 0.5]} />
          <meshToonMaterial color={palette.fadedRed} />
        </mesh>
        <mesh position={[0, 0.72, 0.24]}>
          <boxGeometry args={[0.5, 0.6, 0.06]} />
          <meshToonMaterial color={palette.fadedRed} />
        </mesh>
        <mesh position={[0, 0.19, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.38, 8]} />
          <meshToonMaterial color={palette.coalBlack} />
        </mesh>
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.25, 0.25, 0.04, 12]} />
          <meshToonMaterial color={palette.coalBlack} />
        </mesh>
      </group>
      {/* server rack with LEDs */}
      <mesh position={[-1.4, 1.1, -0.9]}>
        <boxGeometry args={[0.7, 2.2, 0.7]} />
        <meshToonMaterial color="#23262b" />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          position={[-1.4 - 0.2 + (i % 2) * 0.4, 1.9 - Math.floor(i / 2) * 0.35, -0.54]}
          ref={(m) => {
            if (m) leds.current[i] = m;
          }}
        >
          <boxGeometry args={[0.08, 0.08, 0.03]} />
          <meshToonMaterial color={palette.coalBlack} emissive={i % 3 === 0 ? palette.fadedRed : palette.radioactiveGreen} emissiveIntensity={1} />
        </mesh>
      ))}
      {/* pinned map on the wall */}
      <mesh position={[-0.2, 2.2, -1.36]}>
        <planeGeometry args={[0.9, 0.6]} />
        <meshToonMaterial color={palette.boneWhite} />
      </mesh>
    </RoomShell>
  );
}
