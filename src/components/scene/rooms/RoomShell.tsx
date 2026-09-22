"use client";

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
};

/**
 * A bunker cell seen in cross-section, Fallout Shelter style: floor slab,
 * back wall, ceiling beam and two pillars, open at the front so the
 * camera looks straight into the room. Everything is primitive geometry
 * in the fixed palette, per the design rule of zero external models.
 *
 * Origin is the centre of the floor; props are placed with y = 0 on it.
 */
export function RoomShell({
  children,
  light = palette.glowYellow,
  lightIntensity = 5,
  tone = palette.outageGray,
  dim = false,
}: RoomShellProps) {
  const { w, h, d } = CELL;
  const wall = dim ? "#1a1c20" : tone;
  const t = 0.25; // slab / wall thickness

  return (
    <group>
      {/* floor */}
      <mesh position={[0, -t / 2, 0]} receiveShadow>
        <boxGeometry args={[w, t, d]} />
        <meshToonMaterial color={dim ? "#16171a" : palette.steelBlue} />
      </mesh>
      {/* back wall */}
      <mesh position={[0, h / 2, -d / 2 + t / 2]}>
        <boxGeometry args={[w, h, t]} />
        <meshToonMaterial color={wall} />
      </mesh>
      {/* ceiling beam */}
      <mesh position={[0, h + t / 2, 0]}>
        <boxGeometry args={[w + t, t, d]} />
        <meshToonMaterial color={dim ? "#1a1c20" : palette.concreteTan} />
      </mesh>
      {/* pillars */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * (w + t)) / 2, h / 2, 0]}>
          <boxGeometry args={[t, h + t, d]} />
          <meshToonMaterial color={dim ? "#1a1c20" : palette.concreteTan} />
        </mesh>
      ))}
      {/* hanging lamp + its light */}
      {!dim && (
        <>
          <mesh position={[0, h - 0.15, 0.2]}>
            <cylinderGeometry args={[0.28, 0.16, 0.14, 12]} />
            <meshToonMaterial color={palette.boneWhite} emissive={light} emissiveIntensity={0.9} />
          </mesh>
          <pointLight position={[0, h - 0.5, 0.6]} color={light} intensity={lightIntensity} distance={7.5} decay={2} />
        </>
      )}
      {children}
    </group>
  );
}
