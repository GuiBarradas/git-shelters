"use client";

import { useRoomPhase } from "./AmbientLife";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group, MeshStandardMaterial } from "three";

import type { RoomLayout } from "@/components/scene/Fork";
import { palette } from "@/lib/palette";

import { SurfaceDetail } from "./SurfaceDetail";
import { RoomShell } from "./RoomShell";
import { LIVE, SoftBoxGeometry } from "./Details";

/** Gauge face on the control cabinet; the room page pins the uptime read-out here. */
export const GAUGE = {
  // High on the cabinet: the DOM read-out paints over the canvas, so it
  // must clear a Fork's head (top near y 1.45) standing at the gauge.
  // Left of the drum's end (x = -1.0) so the DOM read-out never paints over it.
  position: [-1.5, 1.78, -0.6] as [number, number, number],
  width: 0.8,
  height: 0.6,
};

/** Pace in front of the drum; read the gauge; watch the fan. */
export const LAYOUT: RoomLayout = {
  walk: { z: 1.15, xMin: -1.5, xMax: 1.4 },
  stations: [
    // Read the gauge from beside the plinth, not on it.
    { position: [-1.5, 0, -0.2], facing: Math.PI, action: "crank", hold: 18 },
    { position: [0.9, 0, 1.05], facing: Math.PI, action: "inspect", hold: 3 },
  ],
};

/** Power Plant: the generator. A humming drum, pipes, a spinning fan, a warning beacon. */
export function PowerPlantRoom({ powered = true }: { powered?: boolean }) {
  const { root, offset } = useRoomPhase();
  const beacon = useRef<MeshStandardMaterial>(null);
  const fan = useRef<Group>(null);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime + offset();
    if (beacon.current) beacon.current.emissiveIntensity = powered ? 0.3 + (Math.sin(t * 5) > 0.6 ? 1.6 : 0) : 0;
    if (fan.current && powered) { fan.current.rotation.z += delta * 3; fan.current.position.y = 0.95 + Math.sin(t * 27) * 0.003; }
  });

  return (
    <group ref={root}><RoomShell tone="#394654" light={palette.lampWarm} lightIntensity={4} powered={powered}>
      <SurfaceDetail powered={powered} tile={0} position={[1.3, 1.9, -1.23]} size={[0.65, 0.8]} />
      <SurfaceDetail powered={powered} tile={5} position={[0, 0.17, 0.405]} size={[2.2, 0.24]} />
      {/* generator drum on a plinth */}
      <mesh position={[0, 0.15, -0.3]}>
        <SoftBoxGeometry args={[2.4, 0.3, 1.4]} />
        <dioramaMaterial power={powered ? 1 : 0.06} color={palette.concreteTan} />
      </mesh>
      <mesh position={[0, 0.95, -0.3]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.62, 0.62, 2.0, 18]} />
        <dioramaMaterial power={powered ? 1 : 0.06} color={palette.steelBlue} />
      </mesh>
      {[-1.02, 1.02].map((x) => (
        <mesh key={x} position={[x, 0.95, -0.3]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.66, 0.66, 0.08, 18]} />
          <dioramaMaterial power={powered ? 1 : 0.06} color={palette.coalBlack} />
        </mesh>
      ))}
      {/* exhaust pipe up into the ceiling */}
      {[-0.72, 0.72].map(x => <mesh key={x} position={[x, 0.95, -0.3]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.63, 0.065, 6, 16]} /><dioramaMaterial power={powered ? 1 : 0.06} color={palette.concreteTan} />
      </mesh>)}
      <mesh position={[0.9, 2.1, -0.3]}>
        <cylinderGeometry args={[0.16, 0.16, 1.9, 10]} />
        <dioramaMaterial power={powered ? 1 : 0.06} color={palette.outageGray} />
      </mesh>
      {/* fan grille on the front of the drum */}
      <group ref={fan} position={[0, 0.95, 0.42]} userData={LIVE}>
        {[0, Math.PI / 3, (2 * Math.PI) / 3].map((r) => (
          <mesh key={r} rotation={[0, 0, r]}>
            <SoftBoxGeometry args={[0.9, 0.1, 0.03]} />
            <dioramaMaterial power={powered ? 1 : 0.06} color={palette.boneWhite} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 0.95, 0.4]}>
        <torusGeometry args={[0.5, 0.04, 8, 24]} />
        <dioramaMaterial power={powered ? 1 : 0.06} color={palette.coalBlack} />
      </mesh>
      {/* control cabinet with gauge face and warning beacon */}
      <mesh position={[0, 0.95, 0.44]}>
        <torusGeometry args={[0.54, 0.018, 4, 24]} /><dioramaMaterial power={powered ? 1 : 0.06} color={palette.violetDim} emissive={palette.phosphorViolet} emissiveIntensity={powered ? 0.8 : 0} />
      </mesh>
      <mesh position={[0, 0.95, 0.46]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 0.07, 12]} /><dioramaMaterial power={powered ? 1 : 0.06} color={palette.concreteTan} />
      </mesh>
      <mesh position={[-1.5, 1.1, -0.9]}>
        <SoftBoxGeometry args={[0.9, 2.2, 0.55]} />
        <dioramaMaterial power={powered ? 1 : 0.06} color={palette.outageGray} />
      </mesh>
      <mesh position={GAUGE.position}>
        <planeGeometry args={[GAUGE.width, GAUGE.height]} />
        <dioramaMaterial power={powered ? 1 : 0.06} color="#0b0b0b" emissive={palette.glowYellow} emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[-1.5, 2.35, -0.9]} userData={LIVE}>
        <sphereGeometry args={[0.13, 12, 12]} />
        <dioramaMaterial power={powered ? 1 : 0.06} ref={beacon} color={palette.fadedRed} emissive={palette.fadedRed} emissiveIntensity={0.5} />
      </mesh>
      {/* refinement pass: hazard stripes, a steam pipe with a valve, a caged bulb, an oil stain, a cable coil, a sign */}
      <mesh position={[1.3, 2.0, -0.9]}>
        <cylinderGeometry args={[0.07, 0.07, 2.0, 10]} />
        <dioramaMaterial power={powered ? 1 : 0.06} color={palette.concrete} />
      </mesh>
      <mesh position={[1.3, 2.95, -0.55]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.8, 10]} />
        <dioramaMaterial power={powered ? 1 : 0.06} color={palette.concrete} />
      </mesh>
      <mesh position={[1.3, 1.5, -0.78]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.14, 0.03, 8, 16]} />
        <dioramaMaterial power={powered ? 1 : 0.06} color={palette.fadedRed} />
      </mesh>
      <group position={[-0.2, 2.55, 0.3]}>
        <mesh position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.5, 6]} />
          <dioramaMaterial power={powered ? 1 : 0.06} color={palette.coalBlack} />
        </mesh>
        <mesh>
          <cylinderGeometry args={[0.1, 0.12, 0.2, 8, 1, true]} />
          <dioramaMaterial power={powered ? 1 : 0.06} color={palette.coalBlack} wireframe />
        </mesh>
        <mesh position={[0, -0.02, 0]}>
          <sphereGeometry args={[0.07, 8, 8]} />
          <dioramaMaterial power={powered ? 1 : 0.06} color={palette.boneWhite} emissive={palette.amber} emissiveIntensity={powered ? 1.2 : 0} />
        </mesh>
      </group>
      <mesh position={[0.2, 2.3, -1.22]}>
        <planeGeometry args={[0.7, 0.4]} />
        <dioramaMaterial power={powered ? 1 : 0.06} color={palette.amber} />
      </mesh>
      <mesh position={[0.2, 2.3, -1.21]}>
        <planeGeometry args={[0.5, 0.06]} />
        <dioramaMaterial power={powered ? 1 : 0.06} color={palette.coalBlack} />
      </mesh>
    </RoomShell></group>
  );
}
