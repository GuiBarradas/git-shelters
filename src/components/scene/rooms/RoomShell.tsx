"use client";

import { Sparkles } from "@react-three/drei";
import type { ReactNode } from "react";

import { palette } from "@/lib/palette";

/** Interior footprint every room is built inside: 4 wide, 3 tall, 3 deep. */
export const CELL = { w: 4, h: 3, d: 3 } as const;

type RoomShellProps = {
  children?: ReactNode;
  /** Warm interior light colour; omit for a dead (unpowered) cell. */
  light?: string;
  lightIntensity?: number;
  /** Concrete tint for the walls. */
  tone?: string;
  dim?: boolean;
  /** False in a blackout: the lamp is a dying ember. */
  powered?: boolean;
};

/**
 * A bunker cell seen in cross-section, like a dollhouse cut open: floor slab,
 * back wall, ceiling beam and two pillars, open at the front so the
 * camera looks straight into the room. Everything is primitive geometry
 * in the fixed palette, per the design rule of zero external models.
 *
 * Origin is the centre of the floor; props are placed with y = 0 on it.
 */
export function RoomShell({
  children,
  light = palette.glowYellow,
  lightIntensity = 6,
  tone = "#34303C",
  dim = false,
  powered = true,
}: RoomShellProps) {
  const lamp = powered ? lightIntensity : lightIntensity * 0.12;
  const lampGlow = powered ? 0.9 : 0.15;
  const { w, h, d } = CELL;
  const wall = dim ? "#24272c" : tone;
  const t = 0.25; // slab / wall thickness

  return (
    <group>
      {/* floor */}
      <mesh position={[0, -t / 2, 0]} receiveShadow>
        <boxGeometry args={[w, t, d]} />
        <meshToonMaterial color={dim ? "#1d1f24" : palette.steelBlue} />
      </mesh>
      {/* back wall */}
      <mesh position={[0, h / 2, -d / 2 + t / 2]}>
        <boxGeometry args={[w, h, t]} />
        <meshToonMaterial color={wall} />
      </mesh>
      {/* ceiling beam */}
      <mesh position={[0, h + t / 2, 0]}>
        <boxGeometry args={[w + t, t, d]} />
        <meshToonMaterial color={dim ? "#2a2d33" : palette.concrete} />
      </mesh>
      {/* pillars */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * (w + t)) / 2, h / 2, 0]}>
          <boxGeometry args={[t, h + t, d]} />
          <meshToonMaterial color={dim ? "#2a2d33" : palette.concrete} />
        </mesh>
      ))}
      {/* hanging lamp + its light */}
      {!dim && (
        <>
          <mesh position={[0, h - 0.15, 0.2]}>
            <cylinderGeometry args={[0.28, 0.16, 0.14, 12]} />
            <meshToonMaterial color={palette.boneWhite} emissive={light} emissiveIntensity={lampGlow} />
          </mesh>
          <pointLight position={[0, h - 0.5, 0.6]} color={light} intensity={lamp} distance={7.5} decay={2} />
          {/* dust drifting through the lamp light: the cheapest "this place is lived in" */}
          <Sparkles
            count={14}
            position={[0, h / 2, 0.3]}
            scale={[w - 0.6, h - 0.6, d - 0.8]}
            size={1.6}
            speed={0.25}
            opacity={0.35}
            color={light}
            noise={0.4}
          />
        </>
      )}
      {children}
    </group>
  );
}
