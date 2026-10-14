import { useSyncExternalStore } from "react";

/** The visual quality store, kept apart from the effects so HUD menus don't bundle postprocessing. */
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
export function setQuality(value: Quality) {
  try { localStorage.setItem("shelter-quality", value); } catch { return; }
  window.dispatchEvent(new Event("shelter-quality"));
}
