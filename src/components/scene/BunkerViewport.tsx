"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import type { BunkerSceneProps } from "./BunkerScene";

const BunkerScene = dynamic(() => import("./BunkerScene"), { ssr: false, loading: SceneBooting });
const Registration = createContext<((scene: BunkerSceneProps | null) => void) | null>(null);
const Focus = createContext<((slot: number | null) => void) | null>(null);
const HasScene = createContext(false);

export function SceneBooting() {
  return <p className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-sm text-[#BD93F9]/70">
    &gt; booting renderer<span className="blink">_</span>
  </p>;
}

/** Lives outside Next's page template/loading boundary, so navigation keeps the WebGL context. */
export function BunkerViewport({ children }: { children: ReactNode }) {
  const path = usePathname();
  if (path !== "/" && !/^\/room\/\d+$/.test(path)) return children;
  return <PersistentViewport>{children}</PersistentViewport>;
}

export function PersistentViewport({ children }: { children: ReactNode }) {
  const [{ scene, focusedSlot, pending }, setView] = useState<{
    scene: BunkerSceneProps | null; focusedSlot: number | null; pending: boolean;
  }>({ scene: null, focusedSlot: null, pending: false });
  const publish = useCallback((next: BunkerSceneProps | null) => {
    setView(current => {
      if (!next) return { scene: null, focusedSlot: null, pending: false };
      const slot = next.focusedSlot ?? null;
      // Hover/speech can still rerender the outgoing page during navigation.
      const arrived = !current.scene || slot !== (current.scene.focusedSlot ?? null) || next.demo !== current.scene.demo;
      return { scene: next, focusedSlot: arrived ? slot : current.focusedSlot, pending: arrived ? false : current.pending };
    });
  }, []);
  const focus = useCallback((slot: number | null) => {
    setView(current => ({ ...current, focusedSlot: slot, pending: slot !== (current.scene?.focusedSlot ?? null) }));
  }, []);
  useEffect(() => {
    const back = () => {
      const match = /^\/room\/(\d+)$/.exec(window.location.pathname);
      focus(match ? Number(match[1]) : null);
    };
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, [focus]);
  return <Registration value={publish}><Focus value={focus}><HasScene value={scene !== null}>
    <div className="relative h-dvh w-full">
      <div className="absolute inset-0 z-0" data-testid="bunker-viewport">
        {scene && <BunkerScene {...scene} focusedSlot={focusedSlot}
          panel={pending ? undefined : scene.panel}
          interactive={!pending}
          onSlotClick={(slot, built, locked) => {
            if (pending) return;
            if (built) focus(slot);
            scene.onSlotClick(slot, built, locked);
          }} />}
      </div>
      <div className="bunker-hud pointer-events-none relative z-10 h-full">{children}</div>
    </div>
  </HasScene></Focus></Registration>;
}

/** Publishing new server props also refreshes panels after a Server Action. No cleanup between pages. */
export function RegisteredBunkerScene(props: BunkerSceneProps) {
  const publish = useContext(Registration);
  useLayoutEffect(() => { publish?.(props); }, [publish, props]);
  return publish ? null : <BunkerScene {...props} />;
}

export function useBunkerFocus() { return useContext(Focus); }
export function useHasBunkerScene() { return useContext(HasScene); }

/** A failed/invalid route must not leave a previous room's panel or interactions active. */
export function ClearBunkerScene() {
  const publish = useContext(Registration);
  useLayoutEffect(() => { publish?.(null); }, [publish]);
  return null;
}
