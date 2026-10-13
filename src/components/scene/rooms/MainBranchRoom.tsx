"use client";

import { AmbientLife, ClockHands, useRoomPhase } from "./AmbientLife";
import { useFrame } from "@react-three/fiber";
import { memo, useRef } from "react";
import type { Mesh, MeshStandardMaterial } from "three";
import { BoxGeometry, DataTexture, LinearFilter, LinearMipmapLinearFilter, RGBAFormat } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import type { RoomLayout } from "@/components/scene/Fork";
import { palette } from "@/lib/palette";

import { SurfaceDetail } from "./SurfaceDetail";
import { RoomShell } from "./RoomShell";
import { LIVE, SoftBoxGeometry, RoomLight, Planter } from "./Details";

type Props = {
  /** Brighter, restless screen while today's Daily Event is unresolved. */
  pending?: boolean;
  /** The bunker pushed code today: the whole room feels alive. */
  active?: boolean;
  /** False in a blackout. */
  powered?: boolean;
};

/**
 * Main Branch: the command room. A desk with the terminal whose screen
 * carries the Daily Event, a server rack with blinking LEDs, a chair.
 * The screen is exported at SCREEN so the room page can pin HTML to it.
 */
export const SCREEN = {
  // On the front face of the terminal body (body front is z = -0.5).
  position: [0.55, 1.14, -0.515] as [number, number, number],
  width: 0.95,
  height: 0.68,
};

/** Key rows: z offset, key count, x offset (stagger). */
const KEY_ROWS: Array<[number, number, number]> = [
  [-0.085, 10, 0],
  [-0.025, 10, 0.02],
  [0.035, 9, 0.045],
];
const keys = KEY_ROWS.flatMap(([z, count, offset]) => Array.from({ length: count }, (_, i) =>
  new BoxGeometry(0.05, 0.03, 0.05).translate(-0.3 + offset + i * 0.062, 0.055, z),
));
const keyboard = mergeGeometries(keys);
keys.forEach(geometry => geometry.dispose());

/** Where a Fork can pace and what it can do here. Chair seat is at y = 0.3. */
// Reused luminance stripes on every CRT; no transparent overlay or extra draw.
const scanData = new Uint8Array(64 * 4);
for (let row = 0; row < 64; row++) scanData.set([row % 3 === 0 ? 240 : 255, row % 3 === 0 ? 240 : 255, row % 3 === 0 ? 240 : 255, 255], row * 4);
const scanlines = new DataTexture(scanData, 1, 64, RGBAFormat);
scanlines.magFilter = LinearFilter;
scanlines.minFilter = LinearMipmapLinearFilter;
scanlines.generateMipmaps = true;
scanlines.needsUpdate = true;

export const LAYOUT: RoomLayout = {
  // The whole layout stays left of the terminal: its HTML panel is DOM and
  // paints over the canvas, so a Fork crossing the screen's area (even in
  // front of the desk) would vanish behind the text. xMax keeps a head's
  // width of clearance from the screen's left edge (x = 0.07).
  walk: { z: 1.05, xMin: -1.35, xMax: -0.2 },
  stations: [
    // Off the screen's axis: the terminal's HTML panel is DOM, always drawn
    // over the canvas, so a Fork sitting dead-centre would vanish behind it.
    // Enter and leave the chair from its open left side, never through the back.
    {
      position: [-0.32, 0, 0.42],
      approach: [-0.95, 0, 0.55],
      facing: Math.PI - 0.35,
      action: "type",
      hold: 24,
      seatY: 0.3,
    },
    { position: [-0.85, 0, -0.2], facing: -Math.PI / 2, action: "inspect", hold: 4 },
  ],
};

// Memoised: its static batch rebuilds on every render.
export const MainBranchRoom = memo(function MainBranchRoom({ pending = false, active = false, powered = true }: Props) {
  const { root, offset } = useRoomPhase();
  const screen = useRef<MeshStandardMaterial>(null);
  const leds = useRef<Mesh[]>([]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + offset();
    if (screen.current) {
      // CRT flicker: a slow breathe plus a fast jitter, stronger when pending.
      const base = pending ? 1.4 : 0.8;
      screen.current.emissiveIntensity = powered ? base + Math.sin(t * 2.1) * 0.06 + Math.sin(t * 39.7) * 0.025 : 0;
    }
    leds.current.forEach((led, i) => {
      if (!led) return;
      const on = Math.sin(t * (1.7 + i * 0.9) + i) > 0.2;
      (led.material as MeshStandardMaterial).emissiveIntensity = powered ? (on ? 2.2 : 0.1) : 0;
    });
  });

  const screenColor = pending ? palette.phosphorViolet : active ? palette.phosphorViolet : palette.glowYellow;

  return (
    <group ref={root}><RoomShell tone="#494553" light={active ? palette.amber : palette.lampWarm} lightIntensity={active ? 5.5 : 4.5} powered={powered}>
      <SurfaceDetail powered={powered} tile={7} position={[1.48, 1.85, -1.23]} size={[0.65, 0.85]} />
      <SurfaceDetail powered={powered} tile={6} position={[-0.45, 1.55, -1.23]} size={[0.48, 0.55]} />
      <SurfaceDetail powered={powered} tile={0} position={[-1.4, 0.7, -0.535]} size={[0.48,0.5]} />
      {/* desk: waist height for a 1.45-tall survivor */}
      <mesh position={[0.55, 0.66, -0.55]}>
        <SoftBoxGeometry args={[2.1, 0.1, 0.9]} />
        <dioramaMaterial power={powered ? 1 : 0.06} color={palette.oldWoodBrown} />
      </mesh>
      {[-0.95, 0.95].map((x) => (
        <mesh key={x} position={[0.55 + x, 0.31, -0.55]}>
          <SoftBoxGeometry args={[0.1, 0.62, 0.7]} />
          <dioramaMaterial power={powered ? 1 : 0.06} color={palette.oldWoodBrown} />
        </mesh>
      ))}
      {/* terminal: base plate, neck, body with a stepped bezel, screen, power LED */}
      <mesh position={[0.55, 0.735, -0.75]}>
        <SoftBoxGeometry args={[0.5, 0.03, 0.36]} />
        <dioramaMaterial power={powered ? 1 : 0.06} color="#8a7d5c" />
      </mesh>
      <mesh position={[0.55, 0.8, -0.78]}>
        <SoftBoxGeometry args={[0.16, 0.1, 0.14]} />
        <dioramaMaterial power={powered ? 1 : 0.06} color="#6f6448" />
      </mesh>
      <mesh position={[0.55, 1.14, -0.78]}>
        <SoftBoxGeometry args={[1.12, 0.86, 0.44]} />
        <dioramaMaterial power={powered ? 1 : 0.06} color={palette.concreteTan} />
      </mesh>
      <mesh position={[0.55, 1.14, -0.545]}>
        <SoftBoxGeometry args={[1.04, 0.78, 0.04]} />
        <dioramaMaterial power={powered ? 1 : 0.06} color="#5a523c" />
      </mesh>
      <mesh position={[0.55, 1.14, -0.52]}>
        <planeGeometry args={[0.99, 0.72]} />
        <dioramaMaterial power={powered ? 1 : 0.06} color={palette.coalBlack} />
      </mesh>
      <mesh position={SCREEN.position} userData={LIVE}>
        <planeGeometry args={[SCREEN.width, SCREEN.height]} />
        <dioramaMaterial power={powered ? 1 : 0.06} ref={screen} emissiveMap={scanlines} color="#150a26" emissive={screenColor} emissiveIntensity={powered ? 1 : 0} />
      </mesh>
      <mesh position={[1.02, 0.78, -0.54]}>
        <SoftBoxGeometry args={[0.04, 0.04, 0.02]} />
        <dioramaMaterial power={powered ? 1 : 0.06} color={palette.coalBlack} emissive={palette.phosphorViolet} emissiveIntensity={powered ? 1.4 : 0} />
      </mesh>
      {/* keyboard: tilted base with three rows of keys and a space bar */}
      <group position={[-0.05, 0.71, -0.22]} rotation={[0.12, 0.35, 0]}>
        <mesh position={[0, 0.02, 0]}>
          <SoftBoxGeometry args={[0.72, 0.04, 0.26]} />
          <dioramaMaterial power={powered ? 1 : 0.06} color="#2b2d31" />
        </mesh>
        <mesh geometry={keyboard} dispose={null}><dioramaMaterial power={powered ? 1 : 0.06} color={palette.boneWhite} /></mesh>
        <mesh position={[0.02, 0.055, 0.095]}>
          <SoftBoxGeometry args={[0.3, 0.03, 0.05]} />
          <dioramaMaterial power={powered ? 1 : 0.06} color={palette.boneWhite} />
        </mesh>
      </group>
      {/* chair at the desk, facing the screen; the Fork sits here to type */}
      <group position={[-0.32, 0, 0.42]} rotation={[0, -0.35, 0]}>
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.28, 0.25, 0.12, 12]} />
          <dioramaMaterial power={powered ? 1 : 0.06} color={palette.fadedRed} />
        </mesh>
        <mesh position={[0, 0.6, 0.24]}>
          <SoftBoxGeometry args={[0.54, 0.55, 0.16]} />
          <dioramaMaterial power={powered ? 1 : 0.06} color={palette.fadedRed} />
        </mesh>
        <mesh position={[0, 0.14, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.28, 8]} />
          <dioramaMaterial power={powered ? 1 : 0.06} color={palette.coalBlack} />
        </mesh>
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.25, 0.25, 0.04, 12]} />
          <dioramaMaterial power={powered ? 1 : 0.06} color={palette.coalBlack} />
        </mesh>
      </group>
      {/* server rack with LEDs */}
      <mesh position={[-1.4, 1.1, -0.9]}>
        <SoftBoxGeometry args={[0.7, 2.2, 0.7]} />
        <dioramaMaterial power={powered ? 1 : 0.06} color="#23262b" />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          position={[-1.4 - 0.2 + (i % 2) * 0.4, 1.9 - Math.floor(i / 2) * 0.35, -0.54]}
          userData={LIVE}
          ref={(m) => {
            if (m) leds.current[i] = m;
          }}
        >
          <SoftBoxGeometry args={[0.08, 0.08, 0.03]} />
          <dioramaMaterial power={powered ? 1 : 0.06} color={palette.coalBlack} emissive={i % 3 === 0 ? palette.fadedRed : palette.phosphorViolet} emissiveIntensity={powered ? 1 : 0} />
        </mesh>
      ))}
      {/* rack detail: three blade slots and a vent strip, so it reads as hardware, not a box */}
      {[1.35, 1.0, 0.65].map((y) => (
        <mesh key={y} position={[-1.4, y, -0.54]}>
          <SoftBoxGeometry args={[0.6, 0.22, 0.02]} />
          <dioramaMaterial power={powered ? 1 : 0.06} color="#15171b" />
        </mesh>
      ))}
      <mesh position={[-1.4, 0.25, -0.54]}>
        <SoftBoxGeometry args={[0.6, 0.12, 0.02]} />
        <dioramaMaterial power={powered ? 1 : 0.06} color={palette.coalBlack} emissive={palette.amber} emissiveIntensity={powered ? 0.35 : 0} />
      </mesh>
      {/* cable bundle from the rack to the desk, along the wall base */}
      <mesh position={[-0.4, 0.05, -1.15]}>
        <SoftBoxGeometry args={[1.9, 0.06, 0.08]} />
        <dioramaMaterial power={powered ? 1 : 0.06} color="#1c1e22" />
      </mesh>
      <mesh position={[0.55, 0.3, -0.98]}>
        <SoftBoxGeometry args={[0.05, 0.6, 0.05]} />
        <dioramaMaterial power={powered ? 1 : 0.06} color="#1c1e22" />
      </mesh>
      {/* desk clutter: mug, papers, a notebook */}
      <mesh position={[1.3, 0.78, -0.3]}>
        <cylinderGeometry args={[0.07, 0.06, 0.14, 10]} />
        <dioramaMaterial power={powered ? 1 : 0.06} color={palette.boneWhite} />
      </mesh>
      <mesh position={[1.38, 0.79, -0.3]}>
        <torusGeometry args={[0.035, 0.012, 6, 10]} />
        <dioramaMaterial power={powered ? 1 : 0.06} color={palette.boneWhite} />
      </mesh>
      <mesh position={[1.25, 0.72, -0.8]} rotation={[0, 0.2, 0]}>
        <SoftBoxGeometry args={[0.32, 0.03, 0.42]} />
        <dioramaMaterial power={powered ? 1 : 0.06} color="#d9d2b8" />
      </mesh>
      <mesh position={[-0.25, 0.72, -0.75]} rotation={[0, -0.15, 0]}>
        <SoftBoxGeometry args={[0.28, 0.025, 0.36]} />
        <dioramaMaterial power={powered ? 1 : 0.06} color={palette.steelBlue} />
      </mesh>
      {/* desk lamp: base, arm, head, and its own warm pool of light */}
      <group position={[1.35, 0.71, -0.85]}>
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.1, 0.11, 0.04, 10]} />
          <dioramaMaterial power={powered ? 1 : 0.06} color={palette.coalBlack} />
        </mesh>
        <mesh position={[0.08, 0.3, 0]} rotation={[0, 0, -0.35]}>
          <SoftBoxGeometry args={[0.04, 0.6, 0.04]} />
          <dioramaMaterial power={powered ? 1 : 0.06} color={palette.coalBlack} />
        </mesh>
        <mesh position={[0.24, 0.55, 0]} rotation={[0, 0, 0.9]}>
          <coneGeometry args={[0.12, 0.2, 10, 1, true]} />
          <dioramaMaterial power={powered ? 1 : 0.06} color={palette.coalBlack} emissive={palette.amber} emissiveIntensity={powered ? 0.9 : 0} side={2} />
        </mesh>
        <RoomLight position={[0.3, 0.45, 0.1]} color={palette.amber} intensity={powered ? 4.5 : 0} distance={2.2} decay={2} />
      </group>
      {/* the screen tints the desk violet */}
      <RoomLight position={[0.55, 1.1, -0.1]} color={palette.phosphorViolet} intensity={powered ? 0.9 : 0} distance={1.8} decay={2} />
      {/* filing cabinet in the corner */}
      <mesh position={[1.78, 0.55, -0.95]}>
        <SoftBoxGeometry args={[0.38, 1.1, 0.5]} />
        <dioramaMaterial power={powered ? 1 : 0.06} color={palette.steelBlue} />
      </mesh>
      {[0.85, 0.55, 0.25].map((y) => (
        <mesh key={y} position={[1.78, y, -0.69]}>
          <SoftBoxGeometry args={[0.16, 0.03, 0.03]} />
          <dioramaMaterial power={powered ? 1 : 0.06} color={palette.boneWhite} />
        </mesh>
      ))}
      {/* rubber mat under the chair */}
      <mesh position={[-0.32, 0.005, 0.42]}>
        <SoftBoxGeometry args={[1.1, 0.01, 1.0]} />
        <dioramaMaterial power={powered ? 1 : 0.06} color="#1e2026" />
      </mesh>
      {/* pinned map on the wall, with pins; the wall face is at z = -1.25 */}
      <mesh position={[-0.2, 2.2, -1.22]}>
        <planeGeometry args={[0.9, 0.6]} />
        <dioramaMaterial power={powered ? 1 : 0.06} color={palette.boneWhite} />
      </mesh>
      {(
        [
          [-0.5, 2.35],
          [-0.15, 2.1],
          [0.1, 2.3],
        ] as Array<[number, number]>
      ).map(([x, y], i) => (
        <mesh key={i} position={[x, y, -1.2]}>
          <SoftBoxGeometry args={[0.04, 0.04, 0.03]} />
          <dioramaMaterial power={powered ? 1 : 0.06} color={i === 1 ? palette.phosphorViolet : palette.fadedRed} />
        </mesh>
      ))}
      {/* wall clock: local real time */}
      <mesh position={[1.2, 2.3, -1.22]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.04, 16]} />
        <dioramaMaterial power={powered ? 1 : 0.06} color={palette.boneWhite} />
      </mesh>
      <ClockHands powered={powered} />
      {/* a pipe along the top of the back wall */}
      <mesh position={[0, 2.8, -1.1]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.06, 0.06, 3.9, 10]} />
        <dioramaMaterial power={powered ? 1 : 0.06} color={palette.concrete} />
      </mesh>
      <Planter powered={powered} position={[1.65, 0, 0.65]} />
      <AmbientLife powered={powered} steam />
    </RoomShell></group>
  );
});
