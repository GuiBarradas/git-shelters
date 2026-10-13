"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { BufferAttribute, Group, Points, Vector3 } from "three";
import { useQuality } from "../SceneQuality";
import { LIVE, SoftBoxGeometry } from "./Details";

/** Room position supplies a stable phase without storing anything in game state. */
export function useRoomPhase() {
  const root = useRef<Group>(null);
  const phase = useRef<number | null>(null);
  const position = useRef(new Vector3());
  function offset() {
    if (phase.current === null && root.current) {
      root.current.getWorldPosition(position.current);
      phase.current = position.current.x * 1.17 + position.current.y * 2.31;
    }
    return phase.current ?? 0;
  }
  return { root, offset };
}

/** A single points draw: dust in the lamp cone and a few steam flecks over the mug. */
export function AmbientLife({ powered, steam = false }: { powered: boolean; steam?: boolean }) {
  const quality = useQuality();
  const points = useRef<Points>(null);
  const { root, offset } = useRoomPhase();
  const positions = useMemo(() => new Float32Array(18 * 3), []);
  useFrame(({ clock }) => {
    if (!points.current || !powered || quality === "low") return;
    const t = clock.elapsedTime + offset();
    const attribute = points.current.geometry.attributes.position as BufferAttribute;
    const array = attribute.array;
    for (let i = 0; i < 18; i++) {
      const rise = ((t * (i < 6 && steam ? 0.18 : 0.045) + i * 0.317) % 1 + 1) % 1;
      const mug = steam && i < 6;
      array[i * 3] = (mug ? 1.13 : 0.1) + Math.sin(t * 0.35 + i * 8) * (mug ? 0.035 : 0.8);
      array[i * 3 + 1] = (mug ? 0.85 : 0.5) + rise * (mug ? 0.55 : 1.85);
      array[i * 3 + 2] = (mug ? -0.25 : -0.3) + Math.cos(i * 2.4 + t * 0.12) * (mug ? 0.025 : 0.45);
    }
    attribute.needsUpdate = true;
  });
  if (!powered || quality === "low") return null;
  return <group ref={root}><points ref={points} frustumCulled={false} userData={LIVE}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
    <pointsMaterial color="#fbd3a5" size={0.018} transparent opacity={0.22} depthWrite={false} toneMapped={false} />
  </points></group>;
}

export function ClockHands({ powered }: { powered: boolean }) {
  const hour = useRef<Group>(null);
  const minute = useRef<Group>(null);
  const lastSecond = useRef(-1);
  useFrame(({ clock }) => {
    const second = Math.floor(clock.elapsedTime);
    if (second === lastSecond.current) return;
    lastSecond.current = second;
    const now = new Date();
    const minutes = now.getMinutes() + now.getSeconds() / 60;
    if (minute.current) minute.current.rotation.z = -minutes * Math.PI / 30;
    if (hour.current) hour.current.rotation.z = -(now.getHours() % 12 + minutes / 60) * Math.PI / 6;
  });
  return <group position={[1.2, 2.3, -1.19]}>
    <group ref={minute} userData={LIVE}><mesh position={[0, 0.062, 0]}><SoftBoxGeometry args={[0.015, 0.14, 0.012]} /><dioramaMaterial power={powered ? 1 : 0.06} color="#211a26" /></mesh></group>
    <group ref={hour} userData={LIVE}><mesh position={[0, 0.04, 0.012]}><SoftBoxGeometry args={[0.022, 0.09, 0.012]} /><dioramaMaterial power={powered ? 1 : 0.06} color="#211a26" /></mesh></group>
  </group>;
}
