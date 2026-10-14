"use client";

import { Bloom, DepthOfField, EffectComposer, N8AO, Noise, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";

import { setQuality, type Quality } from "./quality";

export { useQuality, type Quality } from "./quality";
/** Floating picker for screens without the TopBar (landing, public Repo, labs); the bunker's lives in the AccountMenu. */
export function QualityControl({ value }: { value: Quality }) {
  return <label className="scene-quality absolute bottom-9 right-3 z-20 flex items-center gap-2 font-mono text-[10px] text-[#cbb9df]">
    Visual
    <select aria-label="Qualidade gráfica" value={value} onChange={event => setQuality(event.target.value as Quality)} className="rounded border border-[#736084] bg-[#17121e] px-2 py-1">
      <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
    </select>
  </label>;
}
export function SceneEffects({ quality, closeUp = false, focusTarget = [0, 1.25, -0.4] }: { quality: Quality; closeUp?: boolean; focusTarget?: [number, number, number] }) {
  if (quality === "low") return null;
  return <EffectComposer multisampling={0} enableNormalPass={false}>
    {quality === "high" && closeUp ? <N8AO aoRadius={0.22} distanceFalloff={0.5} intensity={1.3} halfRes /> : <></>}
    <Bloom luminanceThreshold={1.15} luminanceSmoothing={0.15} intensity={0.3} mipmapBlur />
    {quality === "high" && closeUp ? <DepthOfField target={focusTarget} worldFocusRange={3.5} bokehScale={0.65} height={360} /> : <></>}
    <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    <Vignette eskil={false} offset={0.22} darkness={0.3} />
    <Noise opacity={0.012} blendFunction={BlendFunction.SOFT_LIGHT} />
    <SMAA />
  </EffectComposer>;
}
