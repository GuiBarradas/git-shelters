import { useEffect, useState, useSyncExternalStore } from "react";

import type { HudInset } from "./DioramaCamera";

function media(query: string) {
  return {
    subscribe: (cb: () => void) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    matches: () => window.matchMedia(query).matches,
  };
}
const LG = media("(min-width: 1024px)");
const PHONE = media("(max-width: 639px)");

/** One-row TopBar from `lg`; the server assumes desktop, like the rest of the HUD. */
export const useWide = () => useSyncExternalStore(LG.subscribe, LG.matches, () => true);
/** Below `sm`: the overview pages through its columns. */
export const usePhone = () => useSyncExternalStore(PHONE.subscribe, PHONE.matches, () => false);

/** TopBar height: 56 px in one row from `lg`, 108 px (bar + resource strip) below; the AlertBanner adds 44. */
export function hudTop(alerting: boolean, wide: boolean): number {
  return (wide ? 56 : 108) + (alerting ? 44 : 0);
}

/**
 * Screen space the HUD takes: the TopBar from the breakpoint, and below
 * whatever the lower band element (passed to the returned ref callback)
 * covers from its top edge down, measured on resize. The crew log expands
 * as an overlay, so opening it never moves the camera.
 */
export function useHudInset(alerting: boolean): [HudInset, (el: HTMLElement | null) => void] {
  const wide = useWide();
  const [band, setBand] = useState<HTMLElement | null>(null);
  const [bottom, setBottom] = useState(0);
  useEffect(() => {
    if (!band) return;
    const measure = () => setBottom(Math.max(0, Math.round(window.innerHeight - band.getBoundingClientRect().top)));
    const observer = new ResizeObserver(measure);
    observer.observe(band);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [band]);
  return [{ top: hudTop(alerting, wide), bottom: band ? bottom : 0 }, setBand];
}
