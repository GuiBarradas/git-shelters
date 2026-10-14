"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { ACESFilmicToneMapping, PerspectiveCamera, SRGBColorSpace, WebGLRenderTarget } from "three";
import type { Fork as ForkData } from "@/lib/forks/catalog";
import type { GeneratedBunker, GeneratedRoom } from "@/lib/visuals/types";
import { Fork } from "../Fork";
import { SceneInstances } from "../SceneInstances";
import { CloseUpLighting, RoomOccupants } from "../rooms/Details";
import { BunkerVisuals, ProceduralRoom, proceduralLayout } from "./ProceduralRoom";

export type SnapshotJob = { key: string; bunker: GeneratedBunker; room: GeneratedRoom; forks: ForkData[]; width?: number; height?: number };
export type SnapshotResult = { blob: Blob; calls: number; triangles: number };

function Capture({ job, onCapture, onError }: { job: SnapshotJob; onCapture: (result: SnapshotResult) => void; onError: (message: string) => void }) {
  const { gl, scene, invalidate } = useThree();
  const frames = useRef(0), done = useRef(false), alive = useRef(true);
  const width = job.width ?? 480, height = job.height ?? 360;
  const target = useMemo(() => {
    const t = new WebGLRenderTarget(width, height, { samples: 4 });
    t.texture.colorSpace = SRGBColorSpace;
    return t;
  }, [width, height]);
  const camera = useMemo(() => {
    const c = new PerspectiveCamera(28, width / height, 0.1, 80);
    c.position.set(3.0, 2.8, 10.7); c.lookAt(0, 1.45, 0); c.updateMatrixWorld();
    return c;
  }, [width, height]);
  useEffect(() => { alive.current = true; invalidate(); return () => { alive.current = false; target.dispose(); }; }, [target, invalidate]);
  useFrame(() => {
    if (done.current) return;
    // Allow the scene's static batches and initial working pose to settle.
    if (++frames.current < 3) { invalidate(); return; }
    done.current = true;
    const previous = gl.getRenderTarget();
    try {
      gl.setRenderTarget(target); gl.clear(); gl.render(scene, camera);
      const calls = gl.info.render.calls, triangles = gl.info.render.triangles;
      const bytes = new Uint8Array(width * height * 4);
      gl.readRenderTargetPixels(target, 0, 0, width, height, bytes);
      const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d")!, pixels = ctx.createImageData(width, height);
      for (let y = 0; y < height; y++) pixels.data.set(bytes.subarray((height - y - 1) * width * 4, (height - y) * width * 4), y * width * 4);
      ctx.putImageData(pixels, 0, 0);
      canvas.toBlob(blob => {
        if (!alive.current) return;
        if (blob) onCapture({ blob, calls, triangles });
        else onError("Could not encode the room image.");
      }, "image/png");
    } catch { onError("WebGL capture failed. Try the low quality preset or reload."); }
    finally { gl.setRenderTarget(previous); }
  });
  return null;
}

/** One renderer reused by the entire thumbnail queue. Never one WebGL context per seed. */
export function SnapshotStage({ job, onCapture, onError }: { job: SnapshotJob; onCapture: (result: SnapshotResult) => void; onError: (message: string) => void }) {
  const portrait = useMemo(() => ({ identity: job.bunker.identity, rooms: [job.room] }), [job.bunker.identity, job.room]);
  return <div aria-hidden style={{ position: "fixed", left: -2048, top: 0, width: 480, height: 360, pointerEvents: "none" }}>
    <Canvas frameloop="demand" dpr={1} gl={{ antialias: false, powerPreference: "low-power", toneMapping: ACESFilmicToneMapping }}>
      <color attach="background" args={["#130e19"]} />
      <hemisphereLight args={["#b1a2d1", "#5b3d36", 0.5]} />
      <directionalLight position={[6,10,8]} color="#e6dfc8" intensity={1.1} />
      <Suspense fallback={null}><BunkerVisuals key={job.key} bunker={portrait}>
        <SceneInstances><CloseUpLighting.Provider value={true}><RoomOccupants.Provider value={job.forks.length}>
          <ProceduralRoom room={job.room} />
        </RoomOccupants.Provider></CloseUpLighting.Provider>
        {job.forks.map((fork, i) => <Fork key={fork.id} fork={fork} layout={proceduralLayout(job.room)} stationIndex={i} />)}
        </SceneInstances>
        <Capture job={job} onCapture={onCapture} onError={onError} />
      </BunkerVisuals></Suspense>
    </Canvas>
  </div>;
}
