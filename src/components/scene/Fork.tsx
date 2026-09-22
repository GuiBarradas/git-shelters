"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group } from "three";

import { forkLook, mulberry32, type Fork as ForkData } from "@/lib/forks/catalog";
import { palette } from "@/lib/palette";

type Props = {
  fork: ForkData;
  /** Half-width of the strip the Fork paces, in world units. */
  range?: number;
  /** Overall size; 1 in the corridor, larger in the close-up. */
  scale?: number;
  onClick?: (fork: ForkData) => void;
  onHover?: (fork: ForkData | null) => void;
};

/**
 * A survivor: six blocks (head, torso, two arms, two legs), pacing the
 * room, arms and legs swinging, turning around at the edges, stopping
 * now and then to look at the player. Everything is driven by the seed
 * so the same Fork moves the same way on every visit.
 */
export function Fork({ fork, range = 1.2, scale = 1, onClick, onHover }: Props) {
  const look = useMemo(() => forkLook(fork.seed), [fork.seed]);
  const params = useMemo(() => {
    const rand = mulberry32(fork.seed ^ 0x2545f491);
    return {
      speed: 0.35 + rand() * 0.3,
      phase: rand() * Math.PI * 2,
      x0: (rand() - 0.5) * range,
      restEvery: 6 + rand() * 6,
    };
  }, [fork.seed, range]);

  const root = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + params.phase;
    const g = root.current;
    if (!g) return;

    // Pace: a triangle wave across the strip, with a pause every so often.
    const cycle = t % params.restEvery;
    const resting = cycle > params.restEvery - 1.8;
    const travel = ((t * params.speed) % 2 + 2) % 2; // 0..2
    const x = params.x0 + (travel < 1 ? travel : 2 - travel) * range * 2 - range;
    const dir = travel < 1 ? 1 : -1;

    g.position.x = resting ? g.position.x : x;
    g.rotation.y = resting ? 0 : dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    g.position.y = resting ? 0 : Math.abs(Math.sin(t * 8)) * 0.03;

    const swing = resting ? 0 : Math.sin(t * 8) * 0.6;
    if (armL.current) armL.current.rotation.x = swing;
    if (armR.current) armR.current.rotation.x = -swing;
    if (legL.current) legL.current.rotation.x = -swing;
    if (legR.current) legR.current.rotation.x = swing;
  });

  const s = 0.16 * scale; // one voxel
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
      {/* legs */}
      <group ref={legL} position={[-s * 0.55, s * 2.2, 0]}>
        <mesh position={[0, -s * 1.1, 0]}>
          <boxGeometry args={[s, s * 2.2, s]} />
          <meshToonMaterial color={look.pants} />
        </mesh>
      </group>
      <group ref={legR} position={[s * 0.55, s * 2.2, 0]}>
        <mesh position={[0, -s * 1.1, 0]}>
          <boxGeometry args={[s, s * 2.2, s]} />
          <meshToonMaterial color={look.pants} />
        </mesh>
      </group>
      {/* torso */}
      <mesh position={[0, s * 3.5, 0]}>
        <boxGeometry args={[s * 2.2, s * 2.6, s * 1.2]} />
        <meshToonMaterial color={look.shirt} />
      </mesh>
      {/* arms */}
      <group ref={armL} position={[-s * 1.6, s * 4.6, 0]}>
        <mesh position={[0, -s * 1.1, 0]}>
          <boxGeometry args={[s * 0.8, s * 2.3, s * 0.8]} />
          <meshToonMaterial color={look.shirt} />
        </mesh>
      </group>
      <group ref={armR} position={[s * 1.6, s * 4.6, 0]}>
        <mesh position={[0, -s * 1.1, 0]}>
          <boxGeometry args={[s * 0.8, s * 2.3, s * 0.8]} />
          <meshToonMaterial color={look.shirt} />
        </mesh>
      </group>
      {/* head */}
      <mesh position={[0, s * 5.9, 0]}>
        <boxGeometry args={[s * 1.8, s * 1.8, s * 1.8]} />
        <meshToonMaterial color={look.skin} />
      </mesh>
      {/* eyes: two dark voxels on the face */}
      {[-0.45, 0.45].map((ex) => (
        <mesh key={ex} position={[ex * s, s * 6.05, s * 0.92]}>
          <boxGeometry args={[s * 0.3, s * 0.3, s * 0.1]} />
          <meshToonMaterial color={palette.coalBlack} />
        </mesh>
      ))}
      {look.helmet && (
        <mesh position={[0, s * 6.9, 0]}>
          <boxGeometry args={[s * 2.0, s * 0.6, s * 2.0]} />
          <meshToonMaterial color={look.helmet} />
        </mesh>
      )}
    </group>
  );
}
