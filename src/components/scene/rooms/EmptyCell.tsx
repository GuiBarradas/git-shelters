"use client";

import { BuildHologram } from "./BuildHologram";
import { BufferGeometry, Float32BufferAttribute } from "three";
import type { RoomKind } from "@/lib/rooms/catalog";
import { memo } from "react";

import { palette } from "@/lib/palette";

import { RoomShell } from "./RoomShell";
import { SoftBoxGeometry } from "./Details";

/** x, y, z, size */
const RUBBLE: Array<[number, number, number, number]> = [
  [-1.1, 0.18, 0.3, 0.42],
  [-0.6, 0.12, -0.5, 0.3],
  [0.9, 0.15, 0.1, 0.36],
  [1.3, 0.1, -0.7, 0.24],
];

// Shared flat stripe geometry stays crisp even when the camera pulls back.
const tape = new BufferGeometry();
const positions: number[] = [], colors: number[] = [];
function stripe(left: number, right: number, shift: number, z: number, color: number[]) {
  const a = Math.min(1.8, left + shift), b = Math.min(1.8, right + shift);
  positions.push(left,-0.075,z, right,-0.075,z, b,0.075,z, left,-0.075,z, b,0.075,z, a,0.075,z);
  for (let vertex = 0; vertex < 6; vertex++) colors.push(...color);
}
stripe(-1.8,1.8,0,0,[0.016,0.009,0.022]);
for (let i = 0; i < 18; i++) stripe(-1.8 + i * 0.2, -1.7 + i * 0.2,0.075,0.002,[0.68,0.36,0.055]);
tape.setAttribute("position", new Float32BufferAttribute(positions,3));
tape.setAttribute("color", new Float32BufferAttribute(colors,3));

/**
 * An unbuilt cell: dark, rubble on the floor, a faint frame hinting
 * "build here". Locked (lower floor, no Elevator yet): no frame, no work
 * light, a sealed slab across the front.
 */
// Memoised: its static batch rebuilds on every render.
export const EmptyCell = memo(function EmptyCell({ highlight = false, locked = false, preview }: { highlight?: boolean; locked?: boolean; preview?: {kind: RoomKind; missingBytes: number} }) {
  if (locked) {
    return (
      <RoomShell dim>
        <mesh position={[0, 1.5, 0.9]}>
          <SoftBoxGeometry args={[3.6, 2.7, 0.16]} />
          <dioramaMaterial power={0.12} color="#1a171f" />
        </mesh>
        {[-0.9, 0.9].map((x) => (
          <mesh key={x} position={[x, 1.5, 1.0]} rotation={[0, 0, x > 0 ? 0.6 : -0.6]}>
            <boxGeometry args={[0.12, 1.6, 0.04]} />
            <dioramaMaterial power={0.12} color={palette.violetDim} emissive={palette.violetDim} emissiveIntensity={highlight ? 0.5 : 0.15} />
          </mesh>
        ))}
      </RoomShell>
    );
  }
  return (
    <RoomShell dim>
      {/* cold work light so the rubble reads even before anyone builds */}
      {RUBBLE.map(([x, y, z, s], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0.2 * i, 0.5 * i, 0]}>
          <dodecahedronGeometry args={[s * 0.65, 0]} />
          <dioramaMaterial power={0.3} color="#77707e" />
        </mesh>
      ))}
      <mesh geometry={tape} dispose={null} position={[0,0.75,0.85]}><meshBasicMaterial vertexColors /></mesh>
      <BuildHologram kind={preview?.kind} missingBytes={preview?.missingBytes} highlight={highlight} />
    </RoomShell>
  );
});
