"use client";

import { useTexture } from "@react-three/drei";
import { PlaneGeometry, SRGBColorSpace } from "three";

// Two triangles per mark, one shared texture and material configuration per room.
const tiles = Array.from({ length: 8 }, (_, tile) => {
  const geometry = new PlaneGeometry(1, 1);
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (tile % 4 + uv.getX(i)) / 4, (1 - Math.floor(tile / 4) + uv.getY(i)) / 2);
  }
  return geometry;
});

export function SurfaceDetail({ tile, position, size, floor = false, powered = true }: {
  tile: number; position: [number, number, number]; size: [number, number]; floor?: boolean; powered?: boolean;
}) {
  const map = useTexture("/textures/shelter-details.svg", texture => { texture.colorSpace = SRGBColorSpace; });
  return <mesh geometry={tiles[tile]} dispose={null} position={position} scale={[...size, 1]} rotation={floor ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}>
    <dioramaMaterial power={powered ? 1 : 0.06} map={map} alphaTest={0.4} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
  </mesh>;
}
