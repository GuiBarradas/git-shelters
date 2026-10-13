"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group } from "three";

import { forkLook, mulberry32, type Fork as ForkData } from "@/lib/forks/catalog";
import { MOOD_MOTION } from "@/lib/forks/mood";
import { palette } from "@/lib/palette";
import { LIVE, SoftBoxGeometry, StaticBatch } from "./rooms/Details";
import { ContactShade } from "./rooms/ContactShade";

/** Something a Fork can do somewhere in a room. */
export type Station = {
  /** Where the Fork's feet go while acting. */
  position: [number, number, number];
  /** Which way it faces (rotation around y) while acting. */
  facing: number;
  action: "sit" | "type" | "work" | "inspect" | "cook" | "crank";
  /** How long it stays, in seconds. */
  hold: number;
  /** For "sit"/"type": seat height the hips rest on. */
  seatY?: number;
  /**
   * Optional waypoint reached before stepping into `position`, and again
   * when leaving. Lets a Fork slip into a chair from the open side instead
   * of walking through its back.
   */
  approach?: [number, number, number];
};

/** The furniture-free strip a Fork can pace along, plus its stations. */
export type RoomLayout = {
  walk: { z: number; xMin: number; xMax: number };
  stations: Station[];
};

type Props = {
  fork: ForkData;
  layout: RoomLayout;
  powered?: boolean;
  /** One worker starts at each station; extras use the free walk lane. */
  stationIndex?: number;
  onClick?: (fork: ForkData) => void;
  onHover?: (fork: ForkData | null) => void;
};

/** One voxel, in world units. Head top lands at about 1.45: shoulder height to the desk. */
const VOXEL = 0.2;
const WALK_SPEED = 0.55; // units per second
/** Hip pivot height above the feet: 2.2 voxels, see the leg groups below. */
const HIP_HEIGHT = 2.2 * VOXEL;

type Phase = "pace" | "approach" | "enter" | "act" | "exit" | "leave";

/**
 * A survivor: head, torso, two arms and two legs with knees, driven by a
 * tiny behaviour loop. It paces the room's free strip, picks a station,
 * walks there (via the station's approach point, if any), does the
 * action, then walks back. All randomness comes from the Fork's seed, so
 * a survivor is recognisable by how it moves, and the loop never touches
 * React state.
 */
export function Fork({ fork, layout, powered = true, stationIndex = 0, onClick, onHover }: Props) {
  const look = useMemo(() => forkLook(fork.seed), [fork.seed]);
  const rand = useMemo(() => mulberry32(fork.seed ^ 0x2545f491), [fork.seed]);

  const root = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const thighL = useRef<Group>(null);
  const thighR = useRef<Group>(null);
  const kneeL = useRef<Group>(null);
  const kneeR = useRef<Group>(null);
  const head = useRef<Group>(null);
  const eyes = useRef<Group>(null);
  const shade = useRef<Group>(null);
  const firstStation = layout.stations[stationIndex];

  // Behaviour state lives in a ref: mutated every frame, never rendered.
  const state = useRef({
    phase: (firstStation ? "act" : "pace") as Phase,
    x: firstStation?.position[0] ?? layout.walk.xMin + rand() * (layout.walk.xMax - layout.walk.xMin),
    z: firstStation?.position[2] ?? layout.walk.z,
    dir: rand() > 0.5 ? 1 : -1,
    until: firstStation ? firstStation.hold + rand() * 5 : 4 + rand() * 6,
    station: firstStation ?? null as Station | null,
    target: [0, 0, 0] as [number, number, number],
    facing: firstStation?.facing ?? 0,
    started: false,
  });

  useFrame(({ clock }, delta) => {
    const g = root.current;
    if (!g) return;
    const t = clock.elapsedTime;
    const anim = t + (fork.seed % 997) * 0.37;
    const s = state.current;
    if (!s.started) { s.until += t; s.started = true; }
    const { walk, stations } = layout;

    let moving = false;
    let action: Station["action"] | null = null;
    const motion = MOOD_MOTION[fork.mood];
    const speed = WALK_SPEED * motion.speed;

    // Advance toward s.target; true once there.
    const step = () => {
      const dx = s.target[0] - s.x;
      const dz = s.target[2] - s.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.03) {
        s.x = s.target[0];
        s.z = s.target[2];
        return true;
      }
      const d = Math.min(dist, speed * delta);
      s.x += (dx / dist) * d;
      s.z += (dz / dist) * d;
      s.facing = Math.atan2(dx, dz);
      moving = true;
      return false;
    };

    switch (s.phase) {
      case "pace": {
        s.x += s.dir * speed * 0.6 * delta;
        if (s.x > walk.xMax) {
          s.x = walk.xMax;
          s.dir = -1;
        } else if (s.x < walk.xMin) {
          s.x = walk.xMin;
          s.dir = 1;
        }
        s.facing = s.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        moving = true;
        if (t > s.until && stations.length > 0) {
          const station = stations[Math.floor(rand() * stations.length)]!;
          s.station = station;
          // Always enter a station along z from the walk lane: walk the lane
          // to the station's column, then straight in. The lane is furniture
          // free by contract, so the only way to clip is a station whose
          // column is blocked, which is a layout bug, not a pathing one.
          s.target = station.approach ?? [station.position[0], 0, walk.z];
          s.phase = "approach";
        }
        break;
      }
      case "approach": {
        if (step() && s.station) {
          s.target = s.station.position;
          s.phase = "enter";
        }
        break;
      }
      case "enter": {
        if (step() && s.station) {
          s.phase = "act";
          s.facing = s.station.facing;
          s.until = t + s.station.hold;
        }
        break;
      }
      case "act": {
        action = s.station?.action ?? null;
        if (t > s.until && s.station) {
          // Back out the way it came in.
          s.target = s.station.approach ?? [s.station.position[0], 0, walk.z];
          s.phase = "exit";
        }
        break;
      }
      case "exit": {
        if (step()) {
          s.target = [Math.min(walk.xMax, Math.max(walk.xMin, s.x)), 0, walk.z];
          s.phase = "leave";
        }
        break;
      }
      case "leave": {
        if (step()) {
          s.station = null;
          s.phase = "pace";
          s.dir = rand() > 0.5 ? 1 : -1;
          s.until = t + 3 + rand() * 4;
        }
        break;
      }
    }

    // Pose.
    const sitting = action === "sit" || action === "type";
    // The model's origin is at the feet; the hips are HIP_HEIGHT above it.
    // Sitting puts the hips on the seat, so the origin drops below it.
    const originY = sitting ? (s.station?.seatY ?? 0.3) - HIP_HEIGHT : 0;
    g.position.set(s.x, originY + (moving ? Math.abs(Math.sin(t * 9)) * motion.bounce : 0), s.z);
    g.rotation.y = s.facing;
    if (shade.current) shade.current.position.y = 0.025 - g.position.y;

    // Legs: thighs swing from the hips while walking; sitting folds the
    // thighs forward and drops the shins straight down from the knees.
    const swing = moving ? Math.sin(t * 9) * 0.65 : 0;
    const thigh = sitting ? -Math.PI / 2 : 0;
    const knee = sitting ? Math.PI / 2 : 0;
    if (thighL.current) thighL.current.rotation.x = thigh + (sitting ? 0 : -swing);
    if (thighR.current) thighR.current.rotation.x = thigh + (sitting ? 0 : swing);
    if (kneeL.current) kneeL.current.rotation.x = knee;
    if (kneeR.current) kneeR.current.rotation.x = knee;

    // Arms: swing while walking, forward on the keyboard/table, one raised to inspect.
    let armLx = swing,
      armRx = -swing;
    if (action === "type" || action === "work") {
      const jitter = Math.sin(anim * 14) * 0.045;
      const reach = action === "type" ? -1.43 : -1.15;
      armLx = reach + jitter;
      armRx = reach - jitter;
    } else if (action === "cook") {
      armLx = -0.75;
      armRx = -1.1 + Math.sin(anim * 2.6) * 0.18;
    } else if (action === "crank") {
      armLx = -1.25 + Math.sin(anim * 2.2) * 0.3;
      armRx = -0.6;
    } else if (action === "sit") {
      armLx = armRx = -0.6;
    } else if (action === "inspect") {
      armLx = -1.6 + Math.sin(t * 2) * 0.1;
      armRx = 0;
    }
    if (armL.current) armL.current.rotation.set(armLx, 0, action === "crank" ? Math.cos(anim * 2.2) * 0.2 : 0);
    if (armR.current) armR.current.rotation.set(armRx, 0, action === "cook" ? Math.cos(anim * 2.6) * 0.15 : 0);

    // Head: nod while inspecting, tilt down while typing, glance around
    // idle; the mood adds a slump (stressed, bitter) or a lift (happy).
    if (head.current) {
      head.current.rotation.x =
        motion.headPitch +
        (action === "inspect" ? Math.sin(anim * 2) * 0.12 : action === "type" || action === "work" ? 0.18 : 0);
      head.current.rotation.y = !moving ? Math.sin(anim * 0.7) * (action ? 0.035 : 0.25) : 0;
      head.current.position.y = VOXEL * 5 + Math.sin(anim * 2) * 0.006;
    }
    if (eyes.current) eyes.current.scale.y = anim % 4.7 < 0.13 ? 0.08 : 1;
  });

  const v = VOXEL;
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

  return (
    <group
      ref={root}
      onClick={(e) => {
        stop(e);
        onClick?.(fork);
      }}
      onPointerOver={(e) => {
        stop(e);
        document.body.style.cursor = "pointer";
        onHover?.(fork);
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
        onHover?.(null);
      }}
    >
      {/* each pivot draws its parts as one mesh; only the look changes their colours */}
      <group ref={shade} userData={LIVE}><ContactShade /></group>
      <StaticBatch deps={[look, powered]}>
      {/* legs: thigh pivots at the hip (y = 2.2 voxels), shin pivots at the knee */}
      {[-0.55, 0.55].map((side, i) => (
        <group key={side} ref={i === 0 ? thighL : thighR} position={[side * v, v * 2.2, 0]} userData={LIVE}>
          <mesh position={[0, -v * 0.55, 0]}>
            <SoftBoxGeometry args={[v, v * 1.1, v]} />
            <dioramaMaterial power={powered ? 1 : 0.06} color={look.pants} />
          </mesh>
          <group ref={i === 0 ? kneeL : kneeR} position={[0, -v * 1.1, 0]} userData={LIVE}>
            <mesh position={[0, -v * 0.55, 0]}>
              <SoftBoxGeometry args={[v, v * 1.1, v]} />
              <dioramaMaterial power={powered ? 1 : 0.06} color={look.pants} />
            </mesh>
            <mesh position={[0, -v * 1.05, v * 0.15]}>
              <SoftBoxGeometry args={[v, v * 0.3, v * 1.3]} />
              <dioramaMaterial power={powered ? 1 : 0.06} color={palette.coalBlack} />
            </mesh>
          </group>
        </group>
      ))}
      {/* torso */}
      <mesh position={[0, v * 3.5, 0]}>
        <SoftBoxGeometry args={[v * 2.2, v * 2.6, v * 1.2]} />
        <dioramaMaterial power={powered ? 1 : 0.06} color={look.shirt} />
      </mesh>
      {/* arms hang from the shoulders at y = 4.6 voxels */}
      {[-1.6, 1.6].map((side, i) => (
        <group key={side} ref={i === 0 ? armL : armR} position={[side * v, v * 4.6, 0]} userData={LIVE}>
          <mesh position={[0, -v * 1.1, 0]}>
            <SoftBoxGeometry args={[v * 0.8, v * 2.3, v * 0.8]} />
            <dioramaMaterial power={powered ? 1 : 0.06} color={look.shirt} />
          </mesh>
          <mesh position={[0, -v * 2.4, 0]}>
            <SoftBoxGeometry args={[v * 0.7, v * 0.4, v * 0.7]} />
            <dioramaMaterial power={powered ? 1 : 0.06} color={look.skin} />
          </mesh>
        </group>
      ))}
      {/* head pivots at the neck */}
      <group ref={head} position={[0, v * 5.0, 0]} userData={LIVE}>
        <mesh position={[0, v * 1.05, 0]}>
          <SoftBoxGeometry args={[v * 2.2, v * 2.1, v * 2]} />
          <dioramaMaterial power={powered ? 1 : 0.06} color={look.skin} />
        </mesh>
        <group ref={eyes} position={[0, v * 1.12, v * 1.02]} userData={LIVE}>
        {[-0.48, 0.48].map((ex) => (
          <mesh key={ex} position={[ex * v, 0, 0]}>
            <SoftBoxGeometry args={[v * 0.3, v * 0.3, v * 0.1]} />
            <dioramaMaterial power={powered ? 1 : 0.06} color={palette.coalBlack} />
          </mesh>
        ))}
        </group>
        {!look.helmet && <>
          <mesh position={[0, v * 2.08, -v * 0.12]}><SoftBoxGeometry args={[v * 2.35, v * 0.65, v * 2.18]} /><dioramaMaterial power={powered ? 1 : 0.06} color="#402317" /></mesh>
          <mesh position={[-v * 0.94, v * 1.35, -v * 0.15]}><SoftBoxGeometry args={[v * 0.5, v * 1.2, v * 2]} /><dioramaMaterial power={powered ? 1 : 0.06} color="#4b2919" /></mesh>
          <mesh position={[v * 0.7, v * 1.86, v * 0.91]}><SoftBoxGeometry args={[v * 0.7, v * 0.7, v * 0.3]} /><dioramaMaterial power={powered ? 1 : 0.06} color="#56301e" /></mesh>
        </>}
        {look.helmet && (
          <mesh position={[0, v * 2.2, 0]}>
            <SoftBoxGeometry args={[v * 2.4, v * 0.6, v * 2.25]} />
            <dioramaMaterial power={powered ? 1 : 0.06} color={look.helmet} />
          </mesh>
        )}
      </group>
      </StaticBatch>
    </group>
  );
}
