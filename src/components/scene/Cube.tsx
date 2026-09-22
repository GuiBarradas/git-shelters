"use client";

import { palette, type PaletteColor } from "@/lib/palette";

type CubeProps = {
  position?: [number, number, number];
  size?: number;
  color?: PaletteColor;
  /** 1 = solid. Anything below switches the material to transparent. */
  opacity?: number;
  onClick?: () => void;
  /** Fired with true on pointer enter, false on leave. */
  onHover?: (hovered: boolean) => void;
};

export function Cube({
  position = [0, 0, 0],
  size = 1,
  color = palette.concreteTan,
  opacity = 1,
  onClick,
  onHover,
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
      onPointerOver={(e) => {
        e.stopPropagation();
        if (onClick) document.body.style.cursor = "pointer";
        onHover?.(true);
      }}
      onPointerOut={() => {
        if (onClick) document.body.style.cursor = "auto";
        onHover?.(false);
      }}
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
