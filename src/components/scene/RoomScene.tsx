"use client";

import { Html, OrthographicCamera } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useLayoutEffect, type ReactNode } from "react";

import type { Fork as ForkData } from "@/lib/forks/catalog";
import { palette } from "@/lib/palette";
import type { RoomKind } from "@/lib/rooms/catalog";

import { Fork } from "./Fork";
import { BuiltRoom, CELL, MainBranchRoom, panelAnchor } from "./rooms";

/** CSS pixels per world unit in drei's transform mode (measured, camera-independent). */
const CSS3D_PX = 40;
/** CSS pixels per world unit we author the terminal panel at. */
const PANEL_PX = 300;

type RoomSceneProps = {
  /** null = the Main Branch. */
  kind: RoomKind | null;
  activeToday: boolean;
  eventPending: boolean;
  /** Rendered on the room's read-out surface: terminal, clipboard or gauge. */
  panel?: ReactNode;
  forks?: ForkData[];
  onForkClick?: (fork: ForkData) => void;
  onForkHover?: (fork: ForkData | null) => void;
};

/** Closer, more frontal camera than the overview: one cell fills the view. */
function Camera() {
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);
  const camera = useThree((state) => state.camera);
  // Fill the view with the cell (about 90% of the height) so the terminal
  // text is legible; the pillars may crop, the room is what matters.
  const zoom = Math.min(260, Math.max(60, Math.min(width / (CELL.w + 0.8), height / (CELL.h + 0.5))));
  useLayoutEffect(() => {
    camera.lookAt(0.2, CELL.h / 2 + 0.05, 0);
    camera.updateProjectionMatrix();
  }, [camera, zoom]);
  return (
    <OrthographicCamera makeDefault position={[2.2, 3.6, 16]} zoom={zoom} near={0.1} far={100} />
  );
}

export default function RoomScene({
  kind,
  activeToday,
  eventPending,
  panel,
  forks = [],
  onForkClick,
  onForkHover,
}: RoomSceneProps) {
  const anchor = panelAnchor(kind);
  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      style={{ background: palette.coalBlack }}
    >
      <Camera />
      <ambientLight color={palette.boneWhite} intensity={0.55} />
      <directionalLight position={[6, 10, 8]} color={palette.boneWhite} intensity={0.45} />

      {kind === null ? <MainBranchRoom active={activeToday} pending={eventPending} /> : <BuiltRoom kind={kind} />}
      {forks.map((f) => (
        <group key={f.id} position={[0, 0, 1.1]}>
          <Fork fork={f} range={1.4} onClick={onForkClick} onHover={onForkHover} />
        </group>
      ))}
      {panel && (
        // CSS3D panel glued to the room's read-out surface (monitor, clipboard, gauge).
        <Html
          transform
          position={[anchor.position[0], anchor.position[1], anchor.position[2] + 0.012]}
          // drei's CSS3D layer maps 1 world unit to CSS3D_PX css pixels (measured);
          // author the panel at PANEL_PX per unit for legible text, then scale down.
          scale={CSS3D_PX / PANEL_PX}
          style={{ width: `${anchor.width * PANEL_PX}px`, height: `${anchor.height * PANEL_PX}px` }}
        >
          {panel}
        </Html>
      )}
    </Canvas>
  );
}
