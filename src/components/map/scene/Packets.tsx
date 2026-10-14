"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, type Points, ShaderMaterial, Vector3 } from "three";

import { palette } from "@/lib/palette";

import type { MapBunker } from "./bunker";
import { mapTime } from "./clock";
import { FOV } from "./framing";
import { srgb, SRGB_TO_LINEAR } from "./glow";
import { flightAt, PACKET_SLOTS, SLOT_PERIOD, TRAIL } from "./packet";
import { SHARP_LAYER } from "./SignalFogEffect";

const VERTEX = /* glsl */ `
  attribute float aSlot; attribute float aTrail;
  uniform float uTime; uniform float uPx; uniform vec3 uColor;
  uniform vec3 uFrom[${PACKET_SLOTS}]; uniform vec3 uTo[${PACKET_SLOTS}];
  uniform float uStart[${PACKET_SLOTS}]; uniform float uDur[${PACKET_SLOTS}];
  varying vec3 vColor;
  void main() {
    int i = int(aSlot);
    vec3 a = uFrom[i]; vec3 b = uTo[i];
    float k = (uTime - uStart[i]) / max(uDur[i], 0.001) - aTrail * 0.018;
    float fade = 1.0 - aTrail / ${TRAIL}.0;
    float size = (k < 0.0 || k > 1.0 || uDur[i] <= 0.0) ? 0.0 : (aTrail < 0.5 ? 0.7 : 0.45) * fade;
    // An arc from hatch to hatch, higher for longer hops.
    float q = clamp(k, 0.0, 1.0);
    vec3 p = mix(a, b, q);
    p.y = a.y + 0.6 + sin(3.14159265 * q) * (2.0 + distance(a.xz, b.xz) * 0.3);
    vColor = uColor * fade;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = min(size * uPx / -mv.z, 240.0);
    gl_Position = projectionMatrix * mv;
  }`;
const FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  ${SRGB_TO_LINEAR}
  void main() {
    vec2 c = gl_PointCoord - 0.5; float r = length(c) * 2.0; if (r > 1.0) discard;
    gl_FragColor = vec4(toLinear(vColor * (exp(-r * r * 4.5) * 0.55 + smoothstep(0.24, 0.0, r))), 1.0);
    #include <colorspace_fragment>
  }`;

/** The packets' flights, written when a slot starts a new one. One map is mounted at a time. */
const flights = {
  uPx: { value: 600 },
  uFrom: { value: Array.from({ length: PACKET_SLOTS }, () => new Vector3()) },
  uTo: { value: Array.from({ length: PACKET_SLOTS }, () => new Vector3()) },
  uStart: { value: new Array<number>(PACKET_SLOTS).fill(0) },
  uDur: { value: new Array<number>(PACKET_SLOTS).fill(0) },
};

/**
 * Packets between Repos that still answer (see packet.ts: ambience
 * only). One Points draw; the CPU only writes a slot's endpoints when a
 * new flight starts, the shader does the arc and the trail. Drawn on the
 * sharp layer, since arcs over The Outage rise in front of locked land.
 */
export function Packets({ talkers }: { talkers: readonly MapBunker[] }) {
  const points = useRef<Points>(null);
  const cycles = useRef<number[]>(Array.from({ length: PACKET_SLOTS }, () => NaN));
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    const n = PACKET_SLOTS * TRAIL;
    // Positions come from the shader; this attribute only sets the vertex count.
    g.setAttribute("position", new Float32BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("aSlot", new Float32BufferAttribute(Array.from({ length: n }, (_, i) => Math.floor(i / TRAIL)), 1));
    g.setAttribute("aTrail", new Float32BufferAttribute(Array.from({ length: n }, (_, i) => i % TRAIL), 1));
    return g;
  }, []);
  const material = useMemo(() => new ShaderMaterial({
    uniforms: {
      ...flights,
      uTime: mapTime,
      uColor: { value: new Vector3(...srgb(palette.phosphorViolet)) },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  }), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  useLayoutEffect(() => { points.current?.layers.set(SHARP_LAYER); }, []);
  // New talkers: every slot picks its flight again.
  useEffect(() => { cycles.current.fill(NaN); }, [talkers]);

  useFrame(({ size, viewport }) => {
    flights.uPx.value = (size.height * viewport.dpr) / (2 * Math.tan((FOV * Math.PI) / 360));
    const t = mapTime.value;
    for (let slot = 0; slot < PACKET_SLOTS; slot++) {
      const cycle = Math.floor((t + (slot * SLOT_PERIOD) / PACKET_SLOTS) / SLOT_PERIOD);
      if (cycle === cycles.current[slot]) continue;
      cycles.current[slot] = cycle;
      const f = flightAt(slot, t, talkers);
      flights.uDur.value[slot] = f ? f.duration : 0;
      if (!f) continue;
      flights.uFrom.value[slot]!.set(...f.from);
      flights.uTo.value[slot]!.set(...f.to);
      flights.uStart.value[slot] = f.start;
    }
  });
  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />;
}
