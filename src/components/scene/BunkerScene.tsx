"use client";

import { OrbitControls, OrthographicCamera } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { useLayoutEffect } from "react";

import { palette } from "@/lib/palette";
import {
  BUILDABLE_SLOTS,
  EMPTY_SLOT_BLURB,
  MAIN_BRANCH_BLURB,
  ROOM_CATALOG,
  type Room,
  type Slot,
} from "@/lib/rooms/catalog";

import { Cube } from "./Cube";
import { BunkerLights } from "./lights";

type BunkerSceneProps = {
  rooms: Room[];
  /** Tints the Main Branch when the player pushed code today. */
  activeToday: boolean;
  onEmptySlotClick: (slot: Slot) => void;
  /** In-world blurb of whatever is under the pointer, or null. */
  onHoverBlurb?: (blurb: string | null) => void;
  /** Landing mode: slow auto-orbit and drag to rotate, nothing else. */
  demo?: boolean;
};

const SLOT_SIZE = 1.4;
const SLOT_PITCH = 2;

/**
 * Slot 0 (Main Branch) leftmost, buildable slots to its right, centred on
 * the origin. The row runs along (1, 0, -1), which is perpendicular to the
 * camera's view direction from [10, 8, 10], so it reads as a horizontal
 * line on screen instead of receding into depth.
 */
function slotPosition(slot: number): [number, number, number] {
  const t = ((slot - BUILDABLE_SLOTS.length / 2) * SLOT_PITCH) / Math.SQRT2;
  return [t, 0, -t];
}

function CameraRig() {
  const camera = useThree((state) => state.camera);
  useLayoutEffect(() => {
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera]);
  return null;
}

/**
 * Isometric orthographic camera whose zoom follows the viewport width, so
 * the four-slot row fits a phone (~30) and stops growing past a laptop
 * (50). Passing zoom as a prop lets drei refresh the projection matrix.
 */
function Camera() {
  const width = useThree((state) => state.size.width);
  return (
    <OrthographicCamera
      makeDefault
      position={[10, 8, 10]}
      zoom={Math.min(50, Math.max(24, width / 13))}
      near={0.1}
      far={1000}
    />
  );
}

export default function BunkerScene({
  rooms,
  activeToday,
  onEmptySlotClick,
  onHoverBlurb,
  demo = false,
}: BunkerSceneProps) {
  const bySlot = new Map(rooms.map((room) => [room.slot, room]));
  const hover = (blurb: string) => (hovered: boolean) => onHoverBlurb?.(hovered ? blurb : null);

  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      style={{ background: palette.coalBlack }}
    >
      <Camera />
      {demo ? (
        <OrbitControls
          target={[0, 1.6, 0]}
          autoRotate
          autoRotateSpeed={0.6}
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 2.6}
        />
      ) : (
        <CameraRig />
      )}

      <BunkerLights />

      <Cube
        position={slotPosition(0)}
        size={SLOT_SIZE}
        color={activeToday ? palette.radioactiveGreen : palette.steelBlue}
        onHover={hover(MAIN_BRANCH_BLURB)}
      />

      {BUILDABLE_SLOTS.map((slot) => {
        const room = bySlot.get(slot);
        return room ? (
          <Cube
            key={slot}
            position={slotPosition(slot)}
            size={SLOT_SIZE}
            color={ROOM_CATALOG[room.kind].color}
            onHover={hover(ROOM_CATALOG[room.kind].blurb)}
          />
        ) : (
          <Cube
            key={slot}
            position={slotPosition(slot)}
            size={SLOT_SIZE}
            color={palette.outageGray}
            opacity={0.5}
            onClick={() => onEmptySlotClick(slot)}
            onHover={hover(EMPTY_SLOT_BLURB)}
          />
        );
      })}

      <EffectComposer>
        <Bloom intensity={0.4} luminanceThreshold={0.85} luminanceSmoothing={0.4} />
        <Vignette darkness={0.3} offset={0.3} eskil={false} />
      </EffectComposer>
    </Canvas>
  );
}
