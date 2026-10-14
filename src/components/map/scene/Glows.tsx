"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, type Points, ShaderMaterial } from "three";

import { mapTime } from "./clock";
import { FOV } from "./framing";
import { GLOW_MODES, type Glow, srgb, SRGB_TO_LINEAR } from "./glow";

const VERTEX = /* glsl */ `
  attribute vec3 aColor; attribute float aSize; attribute float aPhase; attribute float aMode;
  uniform float uTime; uniform float uPx; uniform vec3 uCycle[3];
  varying vec3 vColor; varying float vAlpha;
  float h1(float n) { return fract(sin(n) * 43758.5453); }
  void main() {
    vec3 p = position; float a = 1.0; float s = aSize; vColor = aColor;
    if (aMode < 0.5) { s *= 0.86 + 0.14 * sin(uTime * 1.6 + aPhase * 6.283); }
    else if (aMode < 1.5) { a = mix(0.05, 1.0, step(0.55, fract(uTime * 0.5 + aPhase))); }
    else if (aMode < 2.5) { a = 0.2 + 0.8 * h1(floor(uTime * 9.0 + aPhase * 97.0)); }
    else if (aMode < 3.5) { float k = 0.5 + 0.5 * sin(uTime * 2.2); s *= 0.92 + 0.3 * k; a = 0.85 + 0.15 * k; }
    else if (aMode < 4.5) { a = 0.3 + 0.7 * (0.5 + 0.5 * sin(uTime * 0.8 + aPhase * 6.283)); }
    else if (aMode < 5.5) {
      float c = fract(uTime * 0.11 + aPhase) * 3.0;
      vColor = 0.8 * (c < 1.0 ? mix(uCycle[0], uCycle[1], c) : c < 2.0 ? mix(uCycle[1], uCycle[2], c - 1.0) : mix(uCycle[2], uCycle[0], c - 2.0));
    }
    else if (aMode > 6.5) {
      p.y = mod(p.y + uTime * 0.16 + aPhase * 5.0, 14.0) - 0.4;
      p.x += sin(uTime * 0.13 + aPhase * 20.0) * 1.4;
      p.z += cos(uTime * 0.11 + aPhase * 13.0) * 1.0;
      a = 0.55 * smoothstep(-0.4, 2.0, p.y) * smoothstep(13.6, 9.0, p.y);
    }
    vAlpha = a;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = min(s * uPx / -mv.z, 240.0);
    gl_Position = projectionMatrix * mv;
  }`;

const FRAGMENT = /* glsl */ `
  varying vec3 vColor; varying float vAlpha;
  ${SRGB_TO_LINEAR}
  void main() {
    vec2 c = gl_PointCoord - 0.5; float r = length(c) * 2.0; if (r > 1.0) discard;
    float halo = exp(-r * r * 4.5) * 0.55; float core = smoothstep(0.24, 0.0, r);
    gl_FragColor = vec4(toLinear(vColor * (halo + core) * vAlpha), 1.0);
    #include <colorspace_fragment>
  }`;

/**
 * Every point light of the 404 Lands in one Points draw: bunker cores,
 * beacons, LEDs, CRT flicker, dust. Each glow animates on the GPU by its
 * mode, so nothing here touches buffers after the first frame.
 */
export function Glows({ glows, cycle }: { glows: readonly Glow[]; cycle: readonly [string, string, string] }) {
  const points = useRef<Points>(null);
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(glows.flatMap((l) => l.at), 3));
    g.setAttribute("aColor", new Float32BufferAttribute(glows.flatMap((l) => srgb(l.color)), 3));
    g.setAttribute("aSize", new Float32BufferAttribute(glows.map((l) => l.size), 1));
    g.setAttribute("aPhase", new Float32BufferAttribute(glows.map((l) => l.phase), 1));
    g.setAttribute("aMode", new Float32BufferAttribute(glows.map((l) => GLOW_MODES.indexOf(l.mode)), 1));
    return g;
  }, [glows]);
  const material = useMemo(() => new ShaderMaterial({
    uniforms: { uTime: mapTime, uPx: { value: 600 }, uCycle: { value: cycle.map((hex) => new Color().fromArray(srgb(hex))) } },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  }), [cycle]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ size, viewport }) => {
    // A glow's world size in pixels at distance 1: the drawing buffer height over the lens.
    (points.current!.material as ShaderMaterial).uniforms.uPx!.value = (size.height * viewport.dpr) / (2 * Math.tan((FOV * Math.PI) / 360));
  });
  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />;
}
