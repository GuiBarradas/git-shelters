"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Color, type DataTexture, InstancedBufferAttribute, type InstancedMesh, Object3D, PlaneGeometry, ShaderMaterial } from "three";

import { mapTones } from "@/lib/palette";

import { mapTime } from "./clock";
import type { FogCard } from "./props";

const VERTEX = /* glsl */ `
  attribute float aSeed; uniform float uTime; varying vec2 vUv; varying float vSeed;
  void main() {
    vUv = uv; vSeed = aSeed;
    vec4 c = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float s = length(instanceMatrix[0].xyz);
    c.x += sin(uTime * 0.05 + aSeed * 6.283) * 1.8;
    c.z += cos(uTime * 0.04 + aSeed * 4.0) * 1.1;
    // Billboard: the card always faces the camera, squashed a little like a cloud bank.
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    gl_Position = projectionMatrix * viewMatrix * vec4(c.xyz + (right * position.x + up * position.y * 0.55) * s, 1.0);
  }`;
const FRAGMENT = /* glsl */ `
  uniform sampler2D tCloud; uniform vec3 uColor; uniform float uOpacity; uniform float uTime; varying vec2 vUv; varying float vSeed;
  void main() {
    float ang = vSeed * 6.283 + uTime * 0.012;
    vec2 uv = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * (vUv - 0.5) * 0.8 + 0.5;
    float edge = smoothstep(0.5, 0.12, length(vUv - 0.5));
    gl_FragColor = vec4(uColor, texture2D(tCloud, uv).r * edge * uOpacity);
    #include <colorspace_fragment>
  }`;

const OPACITY = 0.24;
/** Shared by the card shader; eased toward 0 when the fog is switched off. One map is mounted at a time. */
const opacity = { value: OPACITY };
const dummy = new Object3D();

/**
 * The signal fog's drifting cloud banks: one billboarded InstancedMesh
 * over the locked regions, faded out with the fog toggle. Drawn with the
 * terrain, so the fog pass blurs them along with it.
 */
export function FogCards({ cards, cloud, on, reducedMotion }: { cards: readonly FogCard[]; cloud: DataTexture; on: boolean; reducedMotion: boolean }) {
  const mesh = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => {
    const g = new PlaneGeometry(1, 1);
    g.setAttribute("aSeed", new InstancedBufferAttribute(new Float32Array(cards.map((c) => c.seed)), 1));
    return g;
  }, [cards]);
  const material = useMemo(() => new ShaderMaterial({
    uniforms: { uTime: mapTime, tCloud: { value: cloud }, uColor: { value: new Color(mapTones.fogCard) }, uOpacity: opacity },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
  }), [cloud]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    cards.forEach((c, i) => {
      dummy.position.set(...c.at);
      dummy.scale.setScalar(c.size);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [cards]);
  useFrame(() => { opacity.value += ((on ? OPACITY : 0) - opacity.value) * (reducedMotion ? 1 : 0.1); });
  return <instancedMesh ref={mesh} args={[geometry, material, cards.length]} frustumCulled={false} renderOrder={5} />;
}
