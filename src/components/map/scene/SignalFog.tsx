"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef } from "react";

import type { Quality } from "@/components/scene/quality";
import { REGIONS } from "@/lib/regions/catalog";

import { mapTime } from "./clock";
import { cloudNoise, createFogMask } from "./fogMask";
import { FogCards } from "./FogCards";
import { fogCards } from "./props";
import { SignalFogEffect } from "./SignalFogEffect";

const LOCKED = REGIONS.filter((r) => !r.open).map((r) => r.id);
/** How thin a locked region's fog gets while the pointer is over it (map brief). */
export const PEEK_STRENGTH = 0.42;
const CLOUD = 128;

/**
 * Signal fog over the locked regions, its cloud cards, and the composer
 * that runs it. Hovering a locked region thins its fog to peek; the
 * toggle fades it all out. The sharp lights still pass through the
 * effect with the fog off.
 */
export function SignalFog({ on, quality, peek, reducedMotion }: { on: boolean; quality: Quality; peek: string | null; reducedMotion: boolean }) {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const mask = useMemo(() => createFogMask(), []);
  const cards = useMemo(() => fogCards(), []);
  const effect = useMemo(() => {
    mask.draw({});
    return new SignalFogEffect(scene, camera, mask.data, cloudNoise(CLOUD), CLOUD);
  }, [scene, camera, mask]);
  useEffect(() => () => effect.dispose(), [effect]);
  useEffect(() => { effect.setQuality(quality); }, [effect, quality]);

  const state = useRef({ fog: 1, strength: Object.fromEntries(LOCKED.map((id) => [id, 1])) as Record<string, number> });
  useFrame(() => {
    const s = state.current;
    const k = reducedMotion ? 1 : 0.12;
    s.fog += ((on ? 1 : 0) - s.fog) * k;
    let changed = false;
    for (const id of LOCKED) {
      const target = id === peek ? PEEK_STRENGTH : 1;
      const now = s.strength[id]!;
      if (now === target) continue;
      // Settle exactly on the target, so a still mask stops re-uploading.
      s.strength[id] = Math.abs(target - now) < 0.002 ? target : now + (target - now) * k;
      changed = true;
    }
    if (changed) {
      mask.draw(s.strength);
      effect.refreshMask();
    }
    effect.setFrame(mapTime.value, s.fog);
  });

  return (
    <>
      <FogCards cards={cards} cloud={effect.cloud} on={on} reducedMotion={reducedMotion} />
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <primitive object={effect} dispose={null} />
      </EffectComposer>
    </>
  );
}
