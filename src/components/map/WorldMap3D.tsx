"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { Vector3 } from "three";

import { useQuality } from "@/components/scene/quality";
import type { MapPin } from "@/lib/api/world-map";
import { mapTones, palette } from "@/lib/palette";
import { REGIONS, type Region } from "@/lib/regions/catalog";
import { regionHeight, toWorld } from "@/lib/regions/look";

import { MapOverlay } from "./MapOverlay";
import { BunkerPicker, ScreenAnchor } from "./scene/BunkerPicker";
import { Bunkers } from "./scene/Bunkers";
import { bunkerGlows, mapBunkers, type MapBunker, ownSonar } from "./scene/bunker";
import { mapTime, REDUCED_MOTION_SPEED } from "./scene/clock";
import { FOV, type Vec3 } from "./scene/framing";
import { Glows } from "./scene/Glows";
import { MapCameraRig, type MapRigHandle } from "./scene/MapCameraRig";
import { talkers } from "./scene/packet";
import { Packets } from "./scene/Packets";
import { dust, inOpenRegion, mapProps } from "./scene/props";
import { RegionProps } from "./scene/RegionProps";
import { Rings } from "./scene/Rings";
import { Regions } from "./scene/Regions";
import { SignalFog } from "./scene/SignalFog";
import { SHARP_LAYER } from "./scene/SignalFogEffect";

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

/** Advances the shared scene time; reduced motion slows it rather than stopping it. */
function MapTime({ reducedMotion }: { reducedMotion: boolean }) {
  useFrame((_, delta) => { mapTime.value += Math.min(delta, 0.1) * (reducedMotion ? REDUCED_MOTION_SPEED : 1); });
  return null;
}

/** The Sandbox's colour cycle, also used by every "cycle" glow. */
const CYCLE = [palette.phosphorViolet, palette.amber, palette.mustardWarning] as const;
const lift = (b: MapBunker | null, y: number): Vec3 | null => (b ? [b.at[0], b.at[1] + y, b.at[2]] : null);

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
  const [fog, setFog] = useState(true);
  const [peek, setPeek] = useState<string | null>(null);
  const [selected, setSelected] = useState<Region | null>(null);
  const labels = useRef(new Map<string, HTMLElement>());
  const rig = useRef<MapRigHandle>(null);

  const router = useRouter();
  const bunkers = useMemo(() => mapBunkers(pins, me), [pins, me]);
  // Pylons and rubble keep clear of the Repos, so the props follow the pins.
  const props = useMemo(() => mapProps(bunkers.filter((b) => b.pin.region === "the_outage").map((b) => [b.at[0], b.at[2]])), [bunkers]);
  // Lights over open ground stay sharp in front of the fog; lights inside locked regions blur with them.
  const glows = useMemo(() => {
    const all = [...bunkerGlows(bunkers), ...props.glows, ...dust()];
    return { sharp: all.filter((g) => inOpenRegion(g.at)), fogged: all.filter((g) => !inOpenRegion(g.at)) };
  }, [bunkers, props]);
  const rings = useMemo(() => [...ownSonar(bunkers), ...props.rings], [bunkers, props]);
  const answering = useMemo(() => talkers(bunkers), [bunkers]);
  const ownBunker = bunkers.find((b) => b.mine) ?? null;
  const mine = ownBunker?.pin ?? null;
  const own = ownBunker?.at ?? null;
  const hot = useRef<MapBunker | null>(null);
  const [hovered, setHovered] = useState<MapBunker | null>(null);
  const [pinned, setPinned] = useState<MapBunker | null>(null);
  const tip = pinned ?? hovered;
  const tipEl = useRef<HTMLDivElement>(null);
  const youEl = useRef<HTMLDivElement>(null);
  // Synthetic review Repos have no profile to open.
  const openProfile = useCallback((b: MapBunker) => { if (!review) router.push(`/u/${b.pin.login}`); }, [review, router]);
  const selectRegion = useCallback((r: Region) => { if (!hot.current) setSelected(r); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setPinned(null); setSelected(null); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
        onPointerMissed={() => { if (!hot.current) setSelected(null); }}
      >
        <color attach="background" args={[mapTones.mapSky]} />
        <fogExp2 attach="fog" args={[mapTones.mapSky, 0.0042]} />
        {/* violet night fill, and one high moon so the plateau walls read */}
        <hemisphereLight args={[mapTones.nightSky, palette.bunkerBlack, 3]} />
        <directionalLight position={[-30, 60, 25]} color={mapTones.moon} intensity={1.6} />
        <MapTime reducedMotion={reducedMotion} />
        <Regions onSelect={selectRegion} onPeek={setPeek} />
        <RegionProps props={props} />
        <Bunkers bunkers={bunkers} />
        <Rings rings={rings} />
        <Packets talkers={answering} />
        <Glows glows={glows.sharp} cycle={CYCLE} layer={SHARP_LAYER} />
        <Glows glows={glows.fogged} cycle={CYCLE} />
        <SignalFog on={fog} quality={quality} peek={peek} reducedMotion={reducedMotion} />
        <BunkerPicker bunkers={bunkers} hot={hot} onHover={setHovered} onOpen={openProfile} onPin={setPinned} />
        <ScreenAnchor at={lift(tip, 0.5)} el={tipEl} />
        {/* Like the prototype, the YOU tag waits for a closer look so it never crowds the whole-map view. */}
        <ScreenAnchor at={lift(ownBunker, 1.4)} el={youEl} within={120} />
        <MapCameraRig ref={rig} own={own} drift={drift} reducedMotion={reducedMotion} />
        <LabelProjector labels={labels} />
        <FirstFrame onReady={onReady} />
      </Canvas>
      <MapOverlay
        pins={pins}
        mine={mine}
        tip={tip}
        pinned={pinned !== null}
        tipEl={tipEl}
        youEl={youEl}
        onCloseTip={() => setPinned(null)}
        review={review}
        labels={labels}
        selected={selected}
        onClose={() => setSelected(null)}
        fog={fog}
        onFog={setFog}
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
