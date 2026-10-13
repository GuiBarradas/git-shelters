"use client";

import { useSyncExternalStore } from "react";
import { Bloom, DepthOfField, EffectComposer, N8AO, Noise, SMAA, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";

export type Quality = "low" | "medium" | "high";
const subscribe = (cb: () => void) => { window.addEventListener("shelter-quality", cb); return () => window.removeEventListener("shelter-quality", cb); };
function snapshot(): Quality {
  try {
    const value = localStorage.getItem("shelter-quality");
    if (value === "low" || value === "medium" || value === "high") return value;
  } catch { /* Storage is optional in private browsing. */ }
  return window.matchMedia("(pointer: coarse)").matches ? "low" : "medium";
}
export function useQuality() { return useSyncExternalStore(subscribe, snapshot, () => "medium" as Quality); }
export function QualityControl({ value }: { value: Quality }) {
  return <label className="absolute bottom-9 right-3 z-20 flex items-center gap-2 font-mono text-[10px] text-[#cbb9df]">
    Visual
    <select aria-label="Qualidade gráfica" value={value} onChange={event => {
      try { localStorage.setItem("shelter-quality", event.target.value); } catch { return; }
      window.dispatchEvent(new Event("shelter-quality"));
    }} className="rounded border border-[#736084] bg-[#17121e] px-2 py-1">
      <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
    </select>
  </label>;
}
export function SceneEffects({ quality, closeUp = false }: { quality: Quality; closeUp?: boolean }) {
  if (quality === "low") return null;
  return <EffectComposer multisampling={0} enableNormalPass={false}>
    {quality === "high" && closeUp ? <N8AO aoRadius={0.22} distanceFalloff={0.5} intensity={1.3} halfRes /> : <></>}
    <Bloom luminanceThreshold={1.15} luminanceSmoothing={0.15} intensity={0.3} mipmapBlur />
    {quality === "high" && closeUp ? <DepthOfField focusDistance={0.16} focalLength={0.15} bokehScale={0.65} height={360} /> : <></>}
    <Vignette eskil={false} offset={0.22} darkness={0.3} />
    <Noise opacity={0.012} blendFunction={BlendFunction.SOFT_LIGHT} />
    <SMAA />
  </EffectComposer>;
}
