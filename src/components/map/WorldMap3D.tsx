"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { Vector3 } from "three";

import { useQuality } from "@/components/scene/quality";
import type { MapPin } from "@/lib/api/world-map";
import { mapTones, palette } from "@/lib/palette";
import { REGIONS, type Region } from "@/lib/regions/catalog";
import { regionHeight, toWorld } from "@/lib/regions/look";

import { MapOverlay } from "./MapOverlay";
import { FOV, type Vec3 } from "./scene/framing";
import { MapCameraRig, type MapRigHandle } from "./scene/MapCameraRig";
import { Regions } from "./scene/Regions";

function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => { const m = window.matchMedia(query); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

function usePageVisible(): boolean {
  return useSyncExternalStore(
    (cb) => { document.addEventListener("visibilitychange", cb); return () => document.removeEventListener("visibilitychange", cb); },
    () => document.visibilityState === "visible",
    () => true,
  );
}

/** Reports once, after the first frame has actually been drawn. */
function FirstFrame({ onReady }: { onReady: () => void }) {
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    requestAnimationFrame(onReady);
  });
  return null;
}

const scratch = new Vector3();
const LABEL_AT: [string, Vec3][] = REGIONS.map((r) => {
  const [x, z] = toWorld(r.label);
  return [r.id, [x, regionHeight(r.id) + 0.5, z]];
});

/** Moves the DOM region labels over their plateaus every frame, without React state. */
function LabelProjector({ labels }: { labels: RefObject<Map<string, HTMLElement>> }) {
  useFrame(({ camera, size }) => {
    for (const [id, at] of LABEL_AT) {
      const el = labels.current.get(id);
      if (!el) continue;
      scratch.set(...at).project(camera);
      const onScreen = scratch.z < 1 && Math.abs(scratch.x) < 1.05 && Math.abs(scratch.y) < 1.05;
      el.style.visibility = onScreen ? "visible" : "hidden";
      el.style.transform = `translate(${((scratch.x + 1) / 2) * size.width}px, ${((1 - scratch.y) / 2) * size.height}px) translate(-50%, -50%)`;
    }
  });
  return null;
}

/**
 * The 404 Lands as a night diorama: seven plateaus, the camera rig and the
 * DOM overlay. Loaded with ssr: false by WorldMapClient, which keeps the
 * SVG map up until {@link onReady} and brings it back on {@link onLost}.
 */
export default function WorldMap3D({ pins, me, review, hidden, onReady, onLost }: {
  pins: MapPin[];
  me: string | null;
  review: boolean;
  hidden: boolean;
  onReady: () => void;
  onLost: () => void;
}) {
  const quality = useQuality();
  const reducedMotion = useMedia("(prefers-reduced-motion: reduce)");
  const visible = usePageVisible();
  const [drift, setDrift] = useState(true);
  const [selected, setSelected] = useState<Region | null>(null);
  const labels = useRef(new Map<string, HTMLElement>());
  const rig = useRef<MapRigHandle>(null);

  const mine = me ? (pins.find((p) => p.login.toLowerCase() === me.toLowerCase()) ?? null) : null;
  const ownAt = mine ? toWorld(mine.at) : null;
  const own: Vec3 | null = mine && ownAt ? [ownAt[0], regionHeight(mine.region), ownAt[1]] : null;

  return (
    <div className={`absolute inset-0 ${hidden ? "invisible" : ""}`}>
      {/* flat: no tone mapping, like the prototype; tones are matched by eye against it. */}
      <Canvas
        flat
        frameloop={visible ? "always" : "never"}
        dpr={[1, quality === "low" ? 1 : 1.5]}
        gl={{ antialias: false, powerPreference: "high-performance" }}
        camera={{ fov: FOV, near: 1, far: 800 }}
        onCreated={({ gl }) => {
          // No restore path: a lost context hands the visit back to the SVG map.
          gl.domElement.addEventListener("webglcontextlost", onLost, { once: true });
        }}
        onPointerMissed={() => setSelected(null)}
      >
        <color attach="background" args={[mapTones.mapSky]} />
        <fogExp2 attach="fog" args={[mapTones.mapSky, 0.0042]} />
        {/* violet night fill, and one high moon so the plateau walls read */}
        <hemisphereLight args={[mapTones.nightSky, palette.bunkerBlack, 3]} />
        <directionalLight position={[-30, 60, 25]} color={mapTones.moon} intensity={1.6} />
        <Regions onSelect={setSelected} />
        <MapCameraRig ref={rig} own={own} drift={drift} reducedMotion={reducedMotion} />
        <LabelProjector labels={labels} />
        <FirstFrame onReady={onReady} />
      </Canvas>
      <MapOverlay
        pins={pins}
        mine={mine}
        review={review}
        labels={labels}
        selected={selected}
        onClose={() => setSelected(null)}
        drift={reducedMotion ? null : drift}
        onDrift={setDrift}
        quality={quality}
        reducedMotion={reducedMotion}
        onReset={() => rig.current?.reset()}
        onFindMe={() => rig.current?.findMe()}
      />
    </div>
  );
}
