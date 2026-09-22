"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Mesh, MeshToonMaterial } from "three";

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
  // On the front face of the terminal body (body front is z = -0.345).
  position: [0.55, 0.98, -0.34] as [number, number, number],
  width: 1.17,
  height: 0.76,
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
      {/* desk */}
      <mesh position={[0.55, 0.4, -0.3]}>
        <boxGeometry args={[2.1, 0.12, 1]} />
        <meshToonMaterial color={palette.oldWoodBrown} />
      </mesh>
      {[-0.9, 0.9].map((x) => (
        <mesh key={x} position={[0.55 + x, 0.17, -0.3]}>
          <boxGeometry args={[0.1, 0.34, 0.8]} />
          <meshToonMaterial color={palette.oldWoodBrown} />
        </mesh>
      ))}
      {/* terminal body + screen bezel + screen */}
      <mesh position={[0.55, 0.95, -0.62]}>
        <boxGeometry args={[1.35, 1.0, 0.55]} />
        <meshToonMaterial color={palette.concreteTan} />
      </mesh>
      <mesh position={[0.55, 0.98, -0.345]}>
        <planeGeometry args={[1.27, 0.84]} />
        <meshToonMaterial color={palette.coalBlack} />
      </mesh>
      <mesh position={SCREEN.position}>
        <planeGeometry args={[SCREEN.width, SCREEN.height]} />
        <meshToonMaterial ref={screen} color="#062a0c" emissive={screenColor} emissiveIntensity={1} />
      </mesh>
      {/* keyboard */}
      <mesh position={[0.55, 0.49, 0.05]}>
        <boxGeometry args={[0.9, 0.06, 0.3]} />
        <meshToonMaterial color={palette.coalBlack} />
      </mesh>
      {/* chair, pushed back and to the side so it never hides the screen */}
      <group position={[1.35, 0, 0.55]} rotation={[0, -0.6, 0]}>
        <mesh position={[0, 0.28, 0]}>
          <boxGeometry args={[0.55, 0.1, 0.55]} />
          <meshToonMaterial color={palette.fadedRed} />
        </mesh>
        <mesh position={[0, 0.6, -0.26]}>
          <boxGeometry args={[0.55, 0.55, 0.08]} />
          <meshToonMaterial color={palette.fadedRed} />
        </mesh>
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.24, 8]} />
          <meshToonMaterial color={palette.coalBlack} />
        </mesh>
      </group>
      {/* server rack with LEDs */}
      <mesh position={[-1.35, 1.1, -0.7]}>
        <boxGeometry args={[0.7, 2.2, 0.7]} />
        <meshToonMaterial color="#23262b" />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          position={[-1.35 - 0.2 + (i % 2) * 0.4, 1.9 - Math.floor(i / 2) * 0.35, -0.34]}
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
