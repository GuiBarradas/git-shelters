"use client";

import dynamic from "next/dynamic";
import { Component, useState, useSyncExternalStore, type ReactNode } from "react";

import { GameDock } from "@/components/hud/GameDock";
import type { MapPin } from "@/lib/api/world-map";

import { MapTitle, RepoList } from "./MapOverlay";
import { WorldMap } from "./WorldMap";

const WorldMap3D = dynamic(() => import("./WorldMap3D"), { ssr: false });

/** A renderer that throws while starting (no context, driver refusal) falls back instead of blanking the page. */
class Fallback extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override componentDidCatch() { this.props.onError(); }
  override render() { return this.state.failed ? null : this.props.children; }
}

const noSubscribe = () => () => {};

/**
 * The 404 Lands: the 3D diorama where WebGL works, the SVG map otherwise.
 * The SVG stays up until the canvas has drawn its first frame, and comes
 * back for good if the context is lost or the renderer fails.
 */
export function WorldMapClient({ pins, me, review }: { pins: MapPin[]; me: string | null; review: boolean }) {
  const webgl = useSyncExternalStore(noSubscribe, () => "WebGLRenderingContext" in window, () => false);
  const [state, setState] = useState<"booting" | "ready" | "failed">("booting");
  const mine = me ? (pins.find((p) => p.login.toLowerCase() === me.toLowerCase()) ?? null) : null;
  const live = webgl && state !== "failed";

  return (
    <main data-map className="relative h-dvh w-full overflow-hidden font-mono text-sm">
      {state !== "ready" && (
        <div className="absolute inset-0 flex flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="mx-auto mb-4 max-w-5xl"><MapTitle review={review} count={pins.length} /></div>
            <WorldMap pins={pins} me={me} />
            <div className="mx-auto mt-4 max-w-5xl"><RepoList pins={pins} mine={mine} review={review} /></div>
          </div>
          <div className="flex flex-col sm:items-center sm:pb-3"><GameDock active="map" /></div>
        </div>
      )}
      {live && (
        <Fallback onError={() => setState("failed")}>
          <WorldMap3D
            pins={pins}
            me={me}
            review={review}
            hidden={state !== "ready"}
            onReady={() => setState("ready")}
            onLost={() => setState("failed")}
          />
        </Fallback>
      )}
    </main>
  );
}
