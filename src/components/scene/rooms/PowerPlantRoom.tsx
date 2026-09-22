"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group, MeshToonMaterial } from "three";

import { palette } from "@/lib/palette";

import { RoomShell } from "./RoomShell";

/** Power Plant: the generator. A humming drum, pipes, a spinning fan, a warning beacon. */
export function PowerPlantRoom() {
  const beacon = useRef<MeshToonMaterial>(null);
  const fan = useRef<Group>(null);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    if (beacon.current) beacon.current.emissiveIntensity = 0.3 + (Math.sin(t * 5) > 0.6 ? 1.6 : 0);
    if (fan.current) fan.current.rotation.z += delta * 6;
  });

  return (
    <RoomShell light={palette.mustardWarning} lightIntensity={3}>
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
      <mesh position={[0.7, 2.1, -0.3]}>
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
      {/* control box with warning beacon */}
      <mesh position={[-1.45, 1.2, -0.9]}>
        <boxGeometry args={[0.5, 0.9, 0.35]} />
        <meshToonMaterial color={palette.outageGray} />
      </mesh>
      <mesh position={[-1.45, 1.85, -0.9]}>
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
