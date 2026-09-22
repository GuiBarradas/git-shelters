"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group, MeshToonMaterial } from "three";

import type { RoomLayout } from "@/components/scene/Fork";
import { palette } from "@/lib/palette";

import { RoomShell } from "./RoomShell";

/** Gauge face on the control cabinet; the room page pins the uptime read-out here. */
export const GAUGE = {
  position: [-1.32, 1.35, -0.6] as [number, number, number],
  width: 0.9,
  height: 0.62,
};

/** Pace in front of the drum; read the gauge; watch the fan. */
export const LAYOUT: RoomLayout = {
  walk: { z: 1.15, xMin: -0.6, xMax: 1.4 },
  stations: [
    { position: [-1.0, 0, 0.0], facing: -Math.PI / 2, action: "inspect", hold: 5 },
    { position: [0.9, 0, 1.05], facing: Math.PI, action: "inspect", hold: 3 },
  ],
};

/** Power Plant: the generator. A humming drum, pipes, a spinning fan, a warning beacon. */
export function PowerPlantRoom({ powered = true }: { powered?: boolean }) {
  const beacon = useRef<MeshToonMaterial>(null);
  const fan = useRef<Group>(null);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    if (beacon.current) beacon.current.emissiveIntensity = 0.3 + (Math.sin(t * 5) > 0.6 ? 1.6 : 0);
    if (fan.current) fan.current.rotation.z += delta * 6;
  });

  return (
    <RoomShell light={palette.mustardWarning} lightIntensity={3} powered={powered}>
      {/* generator drum on a plinth */}
      <mesh position={[0, 0.15, -0.3]}>
        <boxGeometry args={[2.4, 0.3, 1.4]} />
        <meshToonMaterial color={palette.concreteTan} />
      </mesh>
      <mesh position={[0, 0.95, -0.3]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.62, 0.62, 2.0, 18]} />
        <meshToonMaterial color={palette.steelBlue} />
      </mesh>
      {[-1.02, 1.02].map((x) => (
        <mesh key={x} position={[x, 0.95, -0.3]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.66, 0.66, 0.08, 18]} />
          <meshToonMaterial color={palette.coalBlack} />
        </mesh>
      ))}
      {/* exhaust pipe up into the ceiling */}
      <mesh position={[0.9, 2.1, -0.3]}>
        <cylinderGeometry args={[0.16, 0.16, 1.9, 10]} />
        <meshToonMaterial color={palette.outageGray} />
      </mesh>
      {/* fan grille on the front of the drum */}
      <group ref={fan} position={[0, 0.95, 0.42]}>
        {[0, Math.PI / 3, (2 * Math.PI) / 3].map((r) => (
          <mesh key={r} rotation={[0, 0, r]}>
            <boxGeometry args={[0.9, 0.1, 0.03]} />
            <meshToonMaterial color={palette.boneWhite} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 0.95, 0.4]}>
        <torusGeometry args={[0.5, 0.04, 8, 24]} />
        <meshToonMaterial color={palette.coalBlack} />
      </mesh>
      {/* control cabinet with gauge face and warning beacon */}
      <mesh position={[-1.32, 1.1, -0.9]}>
        <boxGeometry args={[1.05, 2.2, 0.55]} />
        <meshToonMaterial color={palette.outageGray} />
      </mesh>
      <mesh position={GAUGE.position}>
        <planeGeometry args={[GAUGE.width, GAUGE.height]} />
        <meshToonMaterial color="#0b0b0b" emissive={palette.glowYellow} emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[-1.32, 2.35, -0.9]}>
        <sphereGeometry args={[0.13, 12, 12]} />
        <meshToonMaterial ref={beacon} color={palette.fadedRed} emissive={palette.fadedRed} emissiveIntensity={0.5} />
      </mesh>
      {/* cable run along the floor */}
      <mesh position={[-0.6, 0.04, 0.75]} rotation={[0, 0.3, 0]}>
        <boxGeometry args={[2.2, 0.06, 0.08]} />
        <meshToonMaterial color={palette.coalBlack} />
      </mesh>
    </RoomShell>
  );
}
