"use client";

import { palette, type PaletteColor } from "@/lib/palette";

type CubeProps = {
  position?: [number, number, number];
  size?: number;
  color?: PaletteColor;
};

export function Cube({
  position = [0, 0, 0],
  size = 1,
  color = palette.concreteTan,
}: CubeProps) {
  return (
    <mesh position={position}>
      <boxGeometry args={[size, size, size]} />
      <meshToonMaterial color={color} />
    </mesh>
  );
}
