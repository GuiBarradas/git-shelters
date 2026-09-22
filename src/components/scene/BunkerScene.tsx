"use client";

import { OrthographicCamera } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { useLayoutEffect } from "react";

import { palette } from "@/lib/palette";
import { BUILDABLE_SLOTS, ROOM_CATALOG, type Room, type Slot } from "@/lib/rooms/catalog";

import { Cube } from "./Cube";
import { BunkerLights } from "./lights";

type BunkerSceneProps = {
  rooms: Room[];
  /** Tints the Main Branch when the player pushed code today. */
  activeToday: boolean;
  onEmptySlotClick: (slot: Slot) => void;
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

export default function BunkerScene({
  rooms,
  activeToday,
  onEmptySlotClick,
}: BunkerSceneProps) {
  const bySlot = new Map(rooms.map((room) => [room.slot, room]));

  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      style={{ background: palette.coalBlack }}
    >
      <OrthographicCamera
        makeDefault
        position={[10, 8, 10]}
        zoom={50}
        near={0.1}
        far={1000}
      />
      <CameraRig />

      <BunkerLights />

      <Cube
        position={slotPosition(0)}
        size={SLOT_SIZE}
        color={activeToday ? palette.radioactiveGreen : palette.steelBlue}
      />

      {BUILDABLE_SLOTS.map((slot) => {
        const room = bySlot.get(slot);
        return room ? (
          <Cube
            key={slot}
            position={slotPosition(slot)}
            size={SLOT_SIZE}
            color={ROOM_CATALOG[room.kind].color}
          />
        ) : (
          <Cube
            key={slot}
            position={slotPosition(slot)}
            size={SLOT_SIZE}
            color={palette.outageGray}
            opacity={0.5}
            onClick={() => onEmptySlotClick(slot)}
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
