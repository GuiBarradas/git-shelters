"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { AdditiveBlending, DoubleSide, InstancedBufferAttribute, type InstancedMesh, Object3D, RingGeometry, ShaderMaterial } from "three";

import { mapTime } from "./clock";
import { srgb, SRGB_TO_LINEAR } from "./glow";
import type { Ring } from "./props";

const VERTEX = /* glsl */ `
  attribute vec3 aColor; attribute float aPeriod; attribute float aPhase; attribute float aRadius;
  uniform float uTime; varying vec3 vC; varying float vA;
  void main() {
    float k = fract(uTime / aPeriod + aPhase);
    vA = (1.0 - k) * (1.0 - k);
    vC = aColor;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position * (0.3 + k * aRadius), 1.0);
  }`;
const FRAGMENT = /* glsl */ `
  varying vec3 vC; varying float vA;
  ${SRGB_TO_LINEAR}
  void main() {
    gl_FragColor = vec4(toLinear(vC * vA * 0.9), 1.0);
    #include <colorspace_fragment>
  }`;

const dummy = new Object3D();

/**
 * Every expanding ring on the map in one draw: the visitor's amber sonar,
 * the Outage sirens and the Static's ghost broadcasts. They lie on the
 * ground, so they test depth like the terrain and the fog treats them
 * with it; they never write depth.
 */
export function Rings({ rings }: { rings: readonly Ring[] }) {
  const mesh = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => {
    const g = new RingGeometry(0.93, 1, 72).rotateX(-Math.PI / 2);
    g.setAttribute("aColor", new InstancedBufferAttribute(new Float32Array(rings.flatMap((r) => srgb(r.color))), 3));
    g.setAttribute("aPeriod", new InstancedBufferAttribute(new Float32Array(rings.map((r) => r.period)), 1));
    g.setAttribute("aPhase", new InstancedBufferAttribute(new Float32Array(rings.map((r) => r.phase)), 1));
    g.setAttribute("aRadius", new InstancedBufferAttribute(new Float32Array(rings.map((r) => r.radius)), 1));
    return g;
  }, [rings]);
  const material = useMemo(() => new ShaderMaterial({
    uniforms: { uTime: mapTime },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  }), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    rings.forEach((r, i) => {
      dummy.position.set(...r.at);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [rings]);
  if (!rings.length) return null;
  return <instancedMesh ref={mesh} args={[geometry, material, rings.length]} frustumCulled={false} />;
}
