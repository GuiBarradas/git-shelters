"use client";

import { createContext, useLayoutEffect, useRef, type ReactNode } from "react";
import {
  AdditiveBlending, InstancedBufferAttribute, InstancedMesh, Material, Matrix4, Mesh,
  type BufferGeometry, type Color, type Group, type InstancedBufferGeometry, type Object3D, type Texture,
} from "three";

/** True under <SceneInstances>: per-object batchers (StaticBatch) should step aside. */
export const SceneInstancesContext = createContext(false);

/**
 * Draws every opaque mesh of the subtree that shares a geometry shape and a
 * material (up to colour) as one InstancedMesh. Originals stay mounted but
 * hidden, so props, raycasts and disposal are untouched. Instance matrices
 * follow the originals each render, after every useFrame animation.
 * Meshes that animate their own visibility must opt out with userData.live.
 * Rebuilds after each commit of this component, and on its own when an
 * original unmounts, swaps geometry/material or a material changes in place.
 */
export function SceneInstances({ children }: { children: ReactNode }) {
  const root = useRef<Group>(null);
  useLayoutEffect(() => {
    const group = root.current!;
    let scene: Object3D = group;
    while (scene.parent) scene = scene.parent;
    let instances = instanceMeshes(group);
    const off = beforeRender(scene, () => {
      if (instances.update()) return;
      instances.dispose();
      instances = instanceMeshes(group);
    });
    return () => { off(); instances.dispose(); };
  });
  return <SceneInstancesContext value><group ref={root}>{children}</group></SceneInstancesContext>;
}

type Entry = { holder: Record<string, unknown>; key: string; value: unknown };
type Member = { mesh: Mesh; material: Material; geometry: BufferGeometry };
type Batch = { mesh: InstancedMesh; members: Member[]; tint: boolean };

/** Groups `root`'s batchable meshes; `update` returns false once a rebuild is needed. */
export function instanceMeshes(root: Object3D) {
  root.updateWorldMatrix(true, true);
  const materials = new Map<Material, { key: string; entries: Entry[] }>();
  const buckets = new Map<string, Mesh[]>();
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!batchable(mesh)) return;
    const material = mesh.material as Material;
    let fingerprint = materials.get(material);
    if (!fingerprint) materials.set(material, fingerprint = describe(material));
    const key = `${shapeKey(mesh.geometry)}|${fingerprint.key}|${mesh.castShadow}${mesh.receiveShadow}${mesh.frustumCulled}|${mesh.renderOrder}|${mesh.layers.mask}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(mesh);
    else buckets.set(key, [mesh]);
  });

  const batches: Batch[] = [];
  const watched = new Map<Material, Entry[]>();
  for (const meshes of buckets.values()) {
    if (meshes.length < 2) continue;
    const first = meshes[0]!.material as Material & { color?: Color };
    const shared = meshes.every((mesh) => mesh.material === first);
    // Twins that differ only in colour draw with a white clone tinted per instance;
    // colourless twins are identical, so the first material draws them all.
    const tint = !shared && !!first.color;
    const material = tint ? first.clone() as Material & { color: Color } : first;
    if (tint) material.color!.setRGB(1, 1, 1);
    const mesh = new InstancedMesh(meshes[0]!.geometry, material, meshes.length);
    if (tint) mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(meshes.length * 3), 3);
    mesh.raycast = () => {}; // pointer events keep hitting the hidden originals
    mesh.castShadow = meshes[0]!.castShadow;
    mesh.receiveShadow = meshes[0]!.receiveShadow;
    mesh.frustumCulled = meshes[0]!.frustumCulled;
    mesh.renderOrder = meshes[0]!.renderOrder;
    mesh.layers.mask = meshes[0]!.layers.mask;
    root.add(mesh);
    mesh.updateMatrixWorld();
    const members = meshes.map((original) => {
      original.visible = false;
      const own = original.material as Material;
      if (!shared) watched.set(own, materials.get(own)!.entries);
      return { mesh: original, material: own, geometry: original.geometry };
    });
    batches.push({ mesh, members, tint });
  }

  const inverse = new Matrix4();
  const local = new Matrix4();
  function update() {
    for (const [material, entries] of watched) if (!entries.every(unchanged)) return drifted(material);
    inverse.copy(root.matrixWorld).invert();
    for (const { mesh, members, tint } of batches) {
      const matrices = mesh.instanceMatrix.array;
      const colors = mesh.instanceColor?.array;
      let moved = false;
      let tinted = false;
      for (let i = 0; i < members.length; i++) {
        const { mesh: original, material, geometry } = members[i]!;
        if (original.material !== material || original.geometry !== geometry) return false;
        let shown = true;
        for (let node = original.parent; node !== root; node = node.parent) {
          if (!node) return false; // unmounted
          shown &&= node.visible;
        }
        if (shown) local.multiplyMatrices(inverse, original.matrixWorld);
        else local.makeScale(0, 0, 0);
        const e = local.elements;
        for (let k = 0; k < 16; k++) {
          if (matrices[i * 16 + k] === Math.fround(e[k]!)) continue;
          local.toArray(matrices, i * 16);
          moved = true;
          break;
        }
        if (!tint) continue;
        const { r, g, b } = (material as Material & { color: Color }).color;
        if (colors![i * 3] === Math.fround(r) && colors![i * 3 + 1] === Math.fround(g) && colors![i * 3 + 2] === Math.fround(b)) continue;
        colors![i * 3] = r; colors![i * 3 + 1] = g; colors![i * 3 + 2] = b;
        tinted = true;
      }
      if (moved) {
        mesh.instanceMatrix.needsUpdate = true;
        mesh.boundingSphere = mesh.boundingBox = null; // culling recomputes lazily
      }
      if (tinted) mesh.instanceColor!.needsUpdate = true;
    }
    return true;
  }

  function dispose() {
    for (const { mesh, members, tint } of batches) {
      mesh.removeFromParent();
      mesh.dispose();
      if (tint) (mesh.material as Material).dispose();
      for (const member of members) member.mesh.visible = true;
    }
    batches.length = 0;
  }

  update();
  return { update, dispose };
}

function batchable(mesh: Mesh) {
  const material = mesh.material as Material;
  // Plain meshes only: Instanced, Skinned, Batched and custom subclasses draw themselves.
  return Object.getPrototypeOf(mesh) === Mesh.prototype && mesh.visible && !mesh.userData.live
    && !Array.isArray(material) && !material.userData.live
    && (!material.transparent || material.blending === AdditiveBlending || mesh.userData.contactShade) && !volatile.has(material)
    && material.onBeforeRender === Material.prototype.onBeforeRender
    && !(mesh.geometry as InstancedBufferGeometry).isInstancedBufferGeometry && !mesh.morphTargetInfluences
    && !mesh.customDepthMaterial && !mesh.customDistanceMaterial
    && !Object.hasOwn(mesh, "onBeforeRender") && !Object.hasOwn(mesh, "onAfterRender")
    && mesh.children.length === 0 // hiding a parent would hide its children
    && mesh.matrixWorld.determinant() > 0; // instancing keeps the batch's winding
}

function unchanged({ holder, key, value }: Entry) {
  return Object.is(holder[key], value);
}

// A material edited in place twice within a second is animated: leave it live.
const volatile = new WeakSet<Material>();
const lastDrift = new WeakMap<Material, number>();
function drifted(material: Material) {
  const now = performance.now();
  if (now - (lastDrift.get(material) ?? -Infinity) < 1000) volatile.add(material);
  lastDrift.set(material, now);
  return false;
}

const SKIP = new Set(["uuid", "id", "name", "version", "color", "_listeners"]);
const classes = new Map<unknown, number>();

/** Every own property but colour, as a key and as entries cheap to re-check each frame. */
function describe(material: Material) {
  const entries: Entry[] = [];
  const parts: string[] = [];
  const walk = (holder: Record<string, unknown>, depth: number) => {
    for (const key of Object.keys(holder)) {
      const value = holder[key];
      // `__r3f` and kin are framework bookkeeping (props, parent mesh), not appearance.
      if ((depth === 0 && SKIP.has(key)) || key.startsWith("__") || typeof value === "function") continue;
      entries.push({ holder, key, value });
      const nested = value !== null && typeof value === "object" && !(value as Texture).isTexture;
      parts.push(`${depth}${key}=${nested ? "{" : (value as Texture)?.isTexture ? (value as Texture).uuid : String(value)}`);
      if (nested && depth < 3) walk(value as Record<string, unknown>, depth + 1);
    }
  };
  walk(material as unknown as Record<string, unknown>, 0);
  if (!classes.has(material.constructor)) classes.set(material.constructor, classes.size);
  // Closures (instance onBeforeCompile, ShaderMaterial uniforms) cannot be compared: never mix those.
  const custom = (material as Material & { isShaderMaterial?: boolean }).isShaderMaterial
    || Object.keys(material).some((key) => typeof (material as unknown as Record<string, unknown>)[key] === "function");
  const key = `${classes.get(material.constructor)}:${material.customProgramCacheKey()}:${custom ? material.uuid : ""}:${parts.join(";")}`;
  return { key, entries };
}

const word = new Float32Array(1);
const bits = new Uint32Array(word.buffer);
const shapes = new WeakMap<BufferGeometry, { stamp: number; key: string }>();

/** Equal for geometries with identical buffers, whatever their uuid. Cached per geometry. */
function shapeKey(geometry: BufferGeometry) {
  const names = Object.keys(geometry.attributes).sort();
  const attributes = names.map((name) => geometry.attributes[name]!);
  if (geometry.index) attributes.push(geometry.index);
  const stamp = attributes.reduce((sum, attribute) =>
    sum + ((attribute as { version?: number }).version ?? (attribute as { data?: { version: number } }).data!.version), names.length);
  const cached = shapes.get(geometry);
  if (cached?.stamp === stamp) return cached.key;
  // Two 32-bit hashes over every component: collisions are ~2^-64.
  let h1 = 0x811c9dc5;
  let h2 = 0x9747b28c;
  for (const attribute of attributes) {
    for (let i = 0; i < attribute.count; i++) {
      for (let c = 0; c < attribute.itemSize; c++) {
        word[0] = attribute.getComponent(i, c);
        h1 = Math.imul(h1 ^ bits[0]!, 0x01000193);
        h2 = Math.imul(h2 ^ bits[0]!, 0x5bd1e995);
        h2 ^= h2 >>> 15;
      }
    }
  }
  const layout = attributes.map((attribute) => `${attribute.itemSize}${attribute.normalized ? "n" : ""}x${attribute.count}`);
  const key = `${names}${geometry.index ? "+i" : ""}:${layout}:${JSON.stringify(geometry.groups)}:${geometry.drawRange.start},${geometry.drawRange.count}:${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}`;
  shapes.set(geometry, { stamp, key });
  return key;
}

// One wrapper per scene: hooks run after useFrame and the world-matrix pass, before culling.
const renderHooks = new WeakMap<Object3D, Set<() => void>>();
function beforeRender(scene: Object3D, hook: () => void) {
  let hooks = renderHooks.get(scene);
  if (!hooks) {
    const own = new Set<() => void>();
    const previous = scene.onBeforeRender;
    scene.onBeforeRender = function (this: Object3D, ...args: Parameters<Object3D["onBeforeRender"]>) {
      previous.apply(this, args);
      own.forEach((run) => run());
    };
    renderHooks.set(scene, hooks = own);
  }
  hooks.add(hook);
  return () => { hooks.delete(hook); };
}
