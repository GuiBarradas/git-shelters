"use client";

import { palette, type PaletteColor } from "@/lib/palette";

type CubeProps = {
  position?: [number, number, number];
  size?: number;
  color?: PaletteColor;
  /** 1 = solid. Anything below switches the material to transparent. */
  opacity?: number;
  onClick?: () => void;
};

export function Cube({
  position = [0, 0, 0],
  size = 1,
  color = palette.concreteTan,
  opacity = 1,
  onClick,
}: CubeProps) {
  return (
    <mesh
      position={position}
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation();
              onClick();
            }
          : undefined
      }
      onPointerOver={
        onClick ? () => (document.body.style.cursor = "pointer") : undefined
      }
      onPointerOut={
        onClick ? () => (document.body.style.cursor = "auto") : undefined
      }
    >
      <boxGeometry args={[size, size, size]} />
      <meshToonMaterial
        color={color}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  );
}
