"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending, BoxGeometry, Color, CylinderGeometry, DoubleSide, InstancedBufferAttribute, InstancedMesh, MeshLambertMaterial,
  Object3D, PlaneGeometry, ShaderMaterial,
} from "three";

import { mapTones, palette } from "@/lib/palette";

import { beamHeight, type MapBunker, poolRadius, poolStrength } from "./bunker";
import { mapTime } from "./clock";
import { SHARP_LAYER } from "./SignalFogEffect";
import { srgb, SRGB_TO_LINEAR } from "./glow";

type Place = { at: [number, number, number]; scale?: [number, number, number] };

const dummy = new Object3D();

/** One InstancedMesh per part: the draw count does not grow with the number of bunkers. */
function Instances({ geometry, material, places, color, layer = 0 }: {
  geometry: InstancedMesh["geometry"];
  material: InstancedMesh["material"];
  places: readonly Place[];
  /** Per-instance sRGB colour, as an aC attribute for the shader materials. */
  color?: readonly Color[];
  layer?: number;
}) {
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => { mesh.current?.layers.set(layer); }, [layer, places.length]);
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    places.forEach((p, i) => {
      dummy.position.set(...p.at);
      dummy.scale.set(...(p.scale ?? [1, 1, 1]));
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    if (color) m.geometry.setAttribute("aC", new InstancedBufferAttribute(new Float32Array(color.flatMap((c) => c.toArray())), 3));
  }, [places, color]);
  if (!places.length) return null;
  return <instancedMesh ref={mesh} args={[geometry, material, places.length]} frustumCulled={false} />;
}

const POOL_VERTEX = /* glsl */ `
  attribute vec3 aC; varying vec3 vC; varying vec2 vUv;
  void main() { vC = aC; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`;
const POOL_FRAGMENT = /* glsl */ `
  varying vec3 vC; varying vec2 vUv;
  ${SRGB_TO_LINEAR}
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    // The prototype's radial canvas: full at the centre, 45% at a third, gone at the rim.
    float k = r < 0.35 ? mix(1.0, 0.45, r / 0.35) : mix(0.45, 0.0, clamp((r - 0.35) / 0.65, 0.0, 1.0));
    gl_FragColor = vec4(toLinear(vC * k), 1.0);
    #include <colorspace_fragment>
  }`;

const BEAM_VERTEX = /* glsl */ `
  attribute vec3 aC; varying vec3 vC; varying float vY; varying float vP;
  void main() {
    vC = aC; vY = position.y;
    // A per-beam phase from its ground position, so neighbours never pulse together.
    vP = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453) * 6.283;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }`;
const BEAM_FRAGMENT = /* glsl */ `
  uniform float uTime; varying vec3 vC; varying float vY; varying float vP;
  ${SRGB_TO_LINEAR}
  void main() {
    float fade = pow(1.0 - vY, 1.6);
    float bands = 0.55 + 0.45 * sin(vY * 22.0 - uTime * 3.2 + vP);
    // The upload: a bright packet climbing the beam now and then.
    float pkt = smoothstep(0.92, 1.0, sin(vY * 7.0 - uTime * 1.9 + vP * 2.0));
    gl_FragColor = vec4(toLinear(vC * fade * (0.28 * bands + 0.5 * pkt)), 1.0);
    #include <colorspace_fragment>
  }`;

const additive = { transparent: true, depthWrite: false, blending: AdditiveBlending } as const;

/**
 * Every bunker on the map: a low hex hatch with an antenna mast, a warm
 * pool of light, and an upload beam whose height follows the activity.
 * The visitor's own bunker is amber, with a tall beam and the map's only
 * real light. Cores are drawn by Glows. Unknown activity (null) shows a
 * bare hatch: no light, no age.
 */
export function Bunkers({ bunkers }: { bunkers: readonly MapBunker[] }) {
  const parts = useMemo(() => {
    const beam = new CylinderGeometry(0.05, 0.34, 1, 12, 1, true);
    beam.translate(0, 0.5, 0);
    return {
      hatch: new CylinderGeometry(0.34, 0.42, 0.22, 6),
      mast: new BoxGeometry(0.08, 0.7, 0.08),
      pool: new PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      beam,
    };
  }, []);
  const materials = useMemo(() => ({
    hatch: new MeshLambertMaterial({ color: mapTones.hatch }),
    mast: new MeshLambertMaterial({ color: mapTones.mast }),
    pool: new ShaderMaterial({ vertexShader: POOL_VERTEX, fragmentShader: POOL_FRAGMENT, ...additive }),
    beam: new ShaderMaterial({ uniforms: { uTime: mapTime }, vertexShader: BEAM_VERTEX, fragmentShader: BEAM_FRAGMENT, side: DoubleSide, ...additive }),
  }), []);
  useEffect(() => () => {
    for (const g of [parts.hatch, parts.mast, parts.pool, parts.beam]) g.dispose();
    for (const m of Object.values(materials)) m.dispose();
  }, [parts, materials]);

  const layout = useMemo(() => {
    const lit = bunkers.filter((b) => poolRadius(b.pin.activity, b.mine) > 0);
    const beams = bunkers.filter((b) => beamHeight(b.pin.activity, b.mine) > 0);
    const tint = (b: MapBunker, k: number) => new Color().fromArray(srgb(b.mine ? palette.amber : palette.lampWarm)).multiplyScalar(k);
    return {
      hatches: bunkers.map((b): Place => ({ at: [b.at[0], b.at[1] + 0.11, b.at[2]] })),
      masts: bunkers.map((b): Place => ({ at: [b.at[0] + 0.55, b.at[1] + 0.35, b.at[2] - 0.2] })),
      pools: lit.map((b): Place => {
        const r = poolRadius(b.pin.activity, b.mine);
        return { at: [b.at[0], b.at[1] + 0.025, b.at[2]], scale: [r, 1, r] };
      }),
      poolColors: lit.map((b) => tint(b, poolStrength(b.pin.activity, b.mine))),
      beams: beams.map((b): Place => ({ at: [b.at[0], b.at[1] + 0.2, b.at[2]], scale: [1, beamHeight(b.pin.activity, b.mine), 1] })),
      beamColors: beams.map((b) => tint(b, b.mine ? 1 : 0.35 + 0.55 * (b.pin.activity ?? 0))),
      own: bunkers.find((b) => b.mine) ?? null,
    };
  }, [bunkers]);

  return (
    <group>
      <Instances geometry={parts.hatch} material={materials.hatch} places={layout.hatches} />
      <Instances geometry={parts.mast} material={materials.mast} places={layout.masts} />
      <Instances geometry={parts.pool} material={materials.pool} places={layout.pools} color={layout.poolColors} />
      {/* Beams rise in front of locked regions: they skip the fog and are drawn after it. */}
      <Instances geometry={parts.beam} material={materials.beam} places={layout.beams} color={layout.beamColors} layer={SHARP_LAYER} />
      {layout.own && (
        // The one real light on the map: short, amber, unshadowed.
        <pointLight position={[layout.own.at[0], layout.own.at[1] + 1.6, layout.own.at[2]]} color={palette.amber} intensity={6} distance={14} decay={2} />
      )}
    </group>
  );
}
