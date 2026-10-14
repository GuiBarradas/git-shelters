"use client";

import { Html } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { type ReactNode } from "react";

import type { Fork as ForkData } from "@/lib/forks/catalog";
import { palette } from "@/lib/palette";
import type { RoomKind } from "@/lib/rooms/catalog";

import { DioramaCamera } from "./DioramaCamera";
import { QualityControl, SceneEffects, useQuality } from "./SceneQuality";
import { SceneInstances } from "./SceneInstances";
import type { GeneratedBunker } from "@/lib/visuals/types";
import { OptionalBunkerVisuals, ProceduralRoom, proceduralLayout, proceduralPanel } from "./procedural/ProceduralRoom";
import { Fork } from "./Fork";
import { CloseUpLighting, RoomOccupants } from "./rooms/Details";
import { BuiltRoom, CELL, MainBranchRoom, panelAnchor, roomLayout } from "./rooms";

/** CSS pixels per world unit in drei's transform mode (measured, camera-independent). */
const CSS3D_PX = 40;
/** CSS pixels per world unit we author the terminal panel at. */
const PANEL_PX = 300;

type RoomSceneProps = {
  /** null = the Main Branch. */
  kind: RoomKind | null;
  visuals?: GeneratedBunker | null;
  slot?: number;
  activeToday: boolean;
  eventPending: boolean;
  /** Rendered on the room's read-out surface: terminal, clipboard or gauge. */
  panel?: ReactNode;
  forks?: ForkData[];
  onForkClick?: (fork: ForkData) => void;
  onForkHover?: (fork: ForkData | null) => void;
  powered?: boolean;
};

export default function RoomScene({
  kind,
  activeToday,
  eventPending,
  panel,
  forks = [],
  onForkClick,
  onForkHover,
  powered = true,
  visuals,
  slot = 0,
}: RoomSceneProps) {
  const quality = useQuality();
  const visualRoom = visuals?.rooms.find(r => r.slot === slot);
  const anchor = visualRoom ? proceduralPanel(visualRoom) : panelAnchor(kind);
  return (
    <>
    <QualityControl value={quality} />
    <Canvas
      dpr={quality === "high" ? 1.5 : 1}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      style={{ background: "radial-gradient(ellipse, #211529, #0c0911 75%)" }}
    >
      <DioramaCamera width={CELL.w + 1.2} height={CELL.h + 1.1} center={[0,1.5,0]} />
      <hemisphereLight args={["#b1a2d1", "#5b3d36", powered ? 0.5 : 0.2]} />
      <directionalLight position={[6, 10, 8]} color={palette.boneWhite} intensity={powered ? 1.1 : 0.2} />

      <OptionalBunkerVisuals bunker={visuals}><SceneInstances>
      <CloseUpLighting.Provider value={true}>
        <RoomOccupants.Provider value={forks.length}>
          {visualRoom ? <ProceduralRoom room={visualRoom} powered={powered} /> : kind === null ? (
            <MainBranchRoom active={activeToday} pending={eventPending} powered={powered} />
          ) : (
            <BuiltRoom kind={kind} powered={powered} />
          )}
        </RoomOccupants.Provider>
      </CloseUpLighting.Provider>
      {forks.map((f, i) => (
        <Fork key={f.id} fork={f} powered={powered} stationIndex={i} layout={visualRoom ? proceduralLayout(visualRoom) : roomLayout(kind)} onClick={onForkClick} onHover={onForkHover} />
      ))}
      </SceneInstances></OptionalBunkerVisuals>
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
      <SceneEffects quality={quality} closeUp />
    </Canvas>
    </>
  );
}
