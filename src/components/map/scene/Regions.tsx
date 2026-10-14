"use client";

import { Grid, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { type MeshLambertMaterial, SRGBColorSpace } from "three";

import { mapTones, palette } from "@/lib/palette";
import { REGIONS, type Region } from "@/lib/regions/catalog";
import { REGION_LOOK, toWorld, WORLD_DEPTH, WORLD_WIDTH } from "@/lib/regions/look";

import { mapTime } from "./clock";
import { plateauGeometry } from "./plateau";

/** One plateau and its rim: solid when open, dashed when locked. */
function Plateau({ region, onSelect }: { region: Region; onSelect: (region: Region) => void }) {
  const geometry = useMemo(() => plateauGeometry(region), [region]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const look = REGION_LOOK[region.id]!;
  const topMaterial = useRef<MeshLambertMaterial>(null);
  // The Sandbox top never holds one tone: it drifts in hue and light around the plum.
  useFrame(() => {
    if (!look.animated || !topMaterial.current) return;
    const t = mapTime.value;
    topMaterial.current.color.setHSL(0.75 + 0.05 * Math.sin(t * 0.2), 0.22, 0.13 + 0.03 * Math.sin(t * 0.33), SRGBColorSpace);
  });
  const rim = useMemo(() => {
    const pts = region.shape.map((p) => {
      const [x, z] = toWorld(p);
      return [x, look.height + 0.03, z] as [number, number, number];
    });
    return [...pts, pts[0]!];
  }, [region, look.height]);
  return (
    <group>
      <mesh
        geometry={geometry}
        onClick={(e) => {
          e.stopPropagation();
          // A pan that ends over a plateau is not a click on it.
          if (e.delta > 8) return;
          onSelect(region);
        }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { document.body.style.cursor = "auto"; }}
      >
        <meshLambertMaterial ref={topMaterial} attach="material-0" color={look.top} />
        <meshLambertMaterial attach="material-1" color={look.side} />
      </mesh>
      {region.open ? (
        <Line points={rim} color={palette.phosphorViolet} lineWidth={1.6} />
      ) : (
        <Line points={rim} color={palette.violetDim} lineWidth={1.2} dashed dashSize={0.9} gapSize={0.6} />
      )}
    </group>
  );
}

/** The night table: a dark floor with a faint grid, and the seven plateaus on it. */
export function Regions({ onSelect }: { onSelect: (region: Region) => void }) {
  useEffect(() => () => { document.body.style.cursor = "auto"; }, []);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02}>
        <planeGeometry args={[WORLD_WIDTH * 1.8, WORLD_DEPTH * 2.2]} />
        <meshBasicMaterial color={mapTones.mapFloor} />
      </mesh>
      <Grid
        position-y={0.005}
        args={[WORLD_WIDTH * 1.8, WORLD_DEPTH * 2.2]}
        cellSize={2}
        cellThickness={0.5}
        cellColor={palette.inactivePlum}
        sectionSize={10}
        sectionThickness={0.9}
        sectionColor={palette.inactivePlum}
        fadeDistance={260}
        fadeStrength={1.5}
      />
      {REGIONS.map((r) => <Plateau key={r.id} region={r} onSelect={onSelect} />)}
    </group>
  );
}
