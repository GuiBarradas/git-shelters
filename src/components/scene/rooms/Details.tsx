"use client";

import { createContext, useContext, useLayoutEffect, useRef, type DependencyList, type ReactNode } from "react";
import type { ThreeElements } from "@react-three/fiber";
import { AdditiveBlending, CircleGeometry, Float32BufferAttribute, Matrix4, Mesh, type Group, type MeshBasicMaterial } from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { palette } from "@/lib/palette";

/** userData for a mesh whose material animates or a group that moves: batching leaves it live. */
export const LIVE = { live: true };

/**
 * Draws static meshes that differ only in colour as one mesh per moving
 * anchor, colour baked into vertex colours. Originals stay mounted but
 * hidden, so props, raycasts and disposal are untouched. Rebuilds after
 * every commit (or when `deps` change): memoise callers past hover renders.
 */
export function StaticBatch({ children, deps }: { children: ReactNode; deps?: DependencyList }) {
  const root = useRef<Group>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => batch(root.current!), deps);
  return <group ref={root}>{children}</group>;
}

export function batch(root: Group) {
  root.updateWorldMatrix(true, true);
  const buckets = new Map<string, { anchor: Group; meshes: Mesh[] }>();
  root.traverse((object) => {
    const mesh = object as Mesh;
    const material = mesh.material as MeshBasicMaterial;
    if (!mesh.isMesh || !mesh.visible || mesh.userData.live || !material.color || material.wireframe) return;
    // Alpha blending depends on draw order; additive pools do not. Mirrors would flip winding.
    if ((material.transparent && material.blending !== AdditiveBlending) || mesh.matrixWorld.determinant() < 0) return;
    let anchor = mesh.parent as Group;
    while (anchor !== root && !anchor.userData.live) anchor = anchor.parent as Group;
    const key = anchor.uuid + JSON.stringify({ ...material.toJSON(), uuid: 0, color: 0, vertexColors: 0 });
    const bucket = buckets.get(key) ?? { anchor, meshes: [] };
    bucket.meshes.push(mesh);
    buckets.set(key, bucket);
  });

  const merged: Mesh[] = [];
  const hidden: Mesh[] = [];
  const toAnchor = new Matrix4();
  for (const { anchor, meshes } of buckets.values()) {
    if (meshes.length < 2) continue;
    const inverse = anchor.matrixWorld.clone().invert();
    const parts = meshes.map((mesh) => {
      const { color, vertexColors } = mesh.material as MeshBasicMaterial;
      const part = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      const base = vertexColors ? part.getAttribute("color") : null;
      const colors = new Float32Array(part.getAttribute("position").count * 3);
      for (let i = 0; i < colors.length / 3; i++) {
        colors[i * 3] = color.r * (base ? base.getX(i) : 1);
        colors[i * 3 + 1] = color.g * (base ? base.getY(i) : 1);
        colors[i * 3 + 2] = color.b * (base ? base.getZ(i) : 1);
      }
      for (const name of Object.keys(part.attributes)) if (name !== "position" && name !== "normal") part.deleteAttribute(name);
      part.setAttribute("color", new Float32BufferAttribute(colors, 3));
      return part.applyMatrix4(toAnchor.multiplyMatrices(inverse, mesh.matrixWorld));
    });
    const material = (meshes[0]!.material as MeshBasicMaterial).clone();
    material.color.setRGB(1, 1, 1);
    material.vertexColors = true;
    const geometry = mergeGeometries(parts);
    parts.forEach(part => part.dispose());
    const mesh = new Mesh(geometry, material);
    mesh.raycast = () => {}; // pointer events keep hitting the hidden originals
    anchor.add(mesh);
    merged.push(mesh);
    for (const original of meshes) {
      original.visible = false;
      hidden.push(original);
    }
  }
  return () => {
    for (const mesh of merged) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
      (mesh.material as MeshBasicMaterial).dispose();
    }
    for (const mesh of hidden) mesh.visible = true;
  };
}

/** Local lights only in close-up, never ten rooms at once. */
export const CloseUpLighting = createContext(false);
export function RoomLight(props: ThreeElements["pointLight"]) {
  return useContext(CloseUpLighting) ? <pointLight {...props} /> : null;
}

// The finite furniture catalog shares GPU buffers across rooms.
const bevels = new Map<string, RoundedBoxGeometry>();
export function SoftBoxGeometry({ args }: { args: [number, number, number] }) {
  const key = args.join(",");
  let geometry = bevels.get(key);
  if (!geometry) {
    geometry = new RoundedBoxGeometry(...args, 1, Math.min(0.12, Math.min(...args) * 0.24));
    bevels.set(key, geometry);
  }
  return <primitive object={geometry} attach="geometry" dispose={null} />;
}

const pool = new CircleGeometry(1, 24);
pool.setAttribute("color", new Float32BufferAttribute(
  Array.from({ length: pool.getAttribute("position").count }, (_, i) => i === 0 ? [1, 1, 1] : [0, 0, 0]).flat(), 3,
));

/** Vertex-colour falloff: no texture or postprocessing. */
export function LightPool({ position, scale, wall = false, color = palette.lampWarm, strength = 0.2 }: {
  position: [number, number, number]; scale: [number, number, number]; wall?: boolean; color?: string; strength?: number;
}) {
  return <mesh geometry={pool} dispose={null} position={position} scale={scale} rotation={wall ? [0, 0, 0] : [-Math.PI / 2, 0, 0]}>
    <meshBasicMaterial color={color} vertexColors transparent opacity={strength} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
  </mesh>;
}

export function Planter({ position }: { position: [number, number, number] }) {
  return <group position={position}>
    <mesh position={[0, 0.13, 0]}><cylinderGeometry args={[0.18, 0.12, 0.26, 10]} /><meshToonMaterial color={palette.fadedRed} /></mesh>
    <mesh position={[0, 0.26, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.15, 10]} /><meshToonMaterial color={palette.oldWoodBrown} /></mesh>
    {[0, 2.1, 4.2].map((angle, i) => <mesh key={angle} position={[Math.sin(angle) * 0.09, 0.38 + i * 0.035, Math.cos(angle) * 0.09]} rotation={[0.4, angle, 0.4]} scale={[0.08, 0.23, 0.045]}>
      <sphereGeometry args={[1, 6, 4]} /><meshToonMaterial color={i === 1 ? palette.boneWhite : palette.concreteTan} />
    </mesh>)}
  </group>;
}
