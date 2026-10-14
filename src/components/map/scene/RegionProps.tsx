"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  BoxGeometry, BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, InstancedMesh, MeshLambertMaterial, Object3D,
} from "three";

import { palette } from "@/lib/palette";

import { mapTime } from "./clock";
import type { Cube, MapProps, Solid } from "./props";

const dummy = new Object3D();
const color = new Color();

/** One instanced draw for a whole list of solids, whatever region they stand in. */
function Solids({ geometry, solids }: { geometry: BufferGeometry; solids: readonly Solid[] }) {
  const mesh = useRef<InstancedMesh>(null);
  const material = useMemo(() => new MeshLambertMaterial(), []);
  useEffect(() => () => material.dispose(), [material]);
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    solids.forEach((s, i) => {
      dummy.position.set(...s.at);
      dummy.rotation.set(...s.rot);
      dummy.scale.set(...s.scale);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      m.setColorAt(i, color.set(s.color));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [solids]);
  if (!solids.length) return null;
  return <instancedMesh ref={mesh} args={[geometry, material, solids.length]} frustumCulled={false} />;
}

/** The Sandbox colours its cubes walk through. */
const SANDBOX = [palette.phosphorViolet, palette.amber, palette.mustardWarning, palette.steelBlue, palette.inactivePlum].map((c) => new Color(c));

/** The Sandbox cubes: bob, spin, breathe and recolour every frame (38 matrices, one draw). */
function SandboxCubes({ geometry, cubes }: { geometry: BufferGeometry; cubes: readonly Cube[] }) {
  const mesh = useRef<InstancedMesh>(null);
  const material = useMemo(() => new MeshLambertMaterial({ emissive: palette.inactivePlum, emissiveIntensity: 0.4 }), []);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const t = mapTime.value;
    cubes.forEach((c, i) => {
      dummy.position.set(c.at[0], c.at[1] + Math.sin(t * c.speed + c.phase) * 0.6, c.at[2]);
      dummy.rotation.set(t * 0.3 * c.speed + c.phase, t * 0.4 * c.speed, 0);
      dummy.scale.setScalar(c.size * (0.85 + 0.15 * Math.sin(t * 1.3 + c.phase)));
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      const k = (((t * 0.08 + c.phase / 6.283) % 1) + 1) % 1 * SANDBOX.length;
      const a = Math.floor(k);
      m.setColorAt(i, color.copy(SANDBOX[a % SANDBOX.length]!).lerp(SANDBOX[(a + 1) % SANDBOX.length]!, k - a));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  if (!cubes.length) return null;
  return <instancedMesh ref={mesh} args={[geometry, material, cubes.length]} frustumCulled={false} />;
}

/**
 * Every region's props in four draws: all boxes, all cylinders, all
 * lines (power cables, the Edge grid) and the Sandbox cubes. Their
 * lights are in Glows.
 */
export function RegionProps({ props }: { props: MapProps }) {
  const shared = useMemo(() => ({ box: new BoxGeometry(1, 1, 1), cylinder: new CylinderGeometry(0.5, 0.5, 1, 8) }), []);
  const lines = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(props.lines.flatMap((l) => [...l.from, ...l.to]), 3));
    g.setAttribute("color", new Float32BufferAttribute(props.lines.flatMap((l) => { const c = color.set(l.color).toArray(); return [...c, ...c]; }), 3));
    return g;
  }, [props.lines]);
  useEffect(() => () => { shared.box.dispose(); shared.cylinder.dispose(); }, [shared]);
  useEffect(() => () => lines.dispose(), [lines]);
  return (
    <group>
      <Solids geometry={shared.box} solids={props.boxes} />
      <Solids geometry={shared.cylinder} solids={props.cylinders} />
      <SandboxCubes geometry={shared.box} cubes={props.cubes} />
      <lineSegments geometry={lines} frustumCulled={false}>
        <lineBasicMaterial vertexColors />
      </lineSegments>
    </group>
  );
}
