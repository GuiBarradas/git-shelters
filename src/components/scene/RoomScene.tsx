"use client";

import { Html, OrthographicCamera } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useLayoutEffect, type ReactNode } from "react";

import { palette } from "@/lib/palette";
import type { RoomKind } from "@/lib/rooms/catalog";

import { BuiltRoom, CELL, MainBranchRoom, SCREEN } from "./rooms";

/** CSS pixels per world unit in drei's transform mode (measured, camera-independent). */
const CSS3D_PX = 40;
/** CSS pixels per world unit we author the terminal panel at. */
const PANEL_PX = 300;

type RoomSceneProps = {
  /** null = the Main Branch. */
  kind: RoomKind | null;
  activeToday: boolean;
  eventPending: boolean;
  /** Rendered on the terminal screen (Main Branch only). */
  screen?: ReactNode;
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

export default function RoomScene({ kind, activeToday, eventPending, screen }: RoomSceneProps) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      style={{ background: palette.coalBlack }}
    >
      <Camera />
      <ambientLight color={palette.boneWhite} intensity={0.55} />
      <directionalLight position={[6, 10, 8]} color={palette.boneWhite} intensity={0.45} />

      {kind === null ? (
        <>
          <MainBranchRoom active={activeToday} pending={eventPending} />
          {screen && (
            // CSS3D panel glued to the monitor face, so the card is "on" the PC.
            <Html
              transform
              position={[SCREEN.position[0], SCREEN.position[1], SCREEN.position[2] + 0.012]}
              // drei's CSS3D layer maps 1 world unit to CSS3D_PX css pixels (measured);
              // author the panel at PANEL_PX per unit for legible text, then scale down.
              scale={CSS3D_PX / PANEL_PX}
              style={{ width: `${SCREEN.width * PANEL_PX}px`, height: `${SCREEN.height * PANEL_PX}px` }}
            >
              {screen}
            </Html>
          )}
        </>
      ) : (
        <BuiltRoom kind={kind} />
      )}
    </Canvas>
  );
}
