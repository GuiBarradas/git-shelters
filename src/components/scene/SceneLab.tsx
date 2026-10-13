"use client";
import dynamic from "next/dynamic";
import { Canvas } from "@react-three/fiber";
import { OrthographicCamera } from "@react-three/drei";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BuiltRoom, MainBranchRoom, roomLayout } from "./rooms";
import { SceneInstances } from "./SceneInstances";
import { Fork } from "./Fork";
import { SceneEffects, type Quality } from "./SceneQuality";
import { RoomOccupants } from "./rooms/Details";
import type { RoomKind } from "@/lib/rooms/catalog";
const RoomScene = dynamic(() => import("./RoomScene"), { ssr: false });
const kinds: (RoomKind | null)[] = [null,"cache_storage","power_plant","dorm","elevator","workshop"];
function Scene() {
  const query = useSearchParams();
  const count = query.get("rooms") === "30" ? 30 : 10;
  const powered = query.get("dark") !== "1";
  const quality = (query.get("quality") ?? "low") as Quality;
  const person = (i: number) => ({ id: `preview-${i}`, name: "Preview", trait: "junior" as const, mood: "content" as const, seed: i * 131, roomSlot: 0 });
  const selected = query.get("room");
  if (selected) return <RoomScene kind={selected === "main" ? null : selected as RoomKind} activeToday eventPending={false} powered={powered} forks={query.has("empty") ? [] : [person(1)]} panel={<div style={{ color:"#ede2ff", padding:10, fontFamily:"monospace" }}>MAIN BRANCH<br/>System online</div>} />;
  return <Canvas dpr={1} gl={{ antialias:false, powerPreference:"high-performance" }} style={{background:"radial-gradient(ellipse, #211529, #0c0911 75%)"}}>
    <OrthographicCamera makeDefault position={[6,8,30]} zoom={count === 30 ? 32 : 55} onUpdate={camera => camera.lookAt(0,count === 30 ? -8 : -0.5,0)} />
    <hemisphereLight args={["#978dbb","#30232f",0.42]} /><directionalLight position={[-3,8,10]} intensity={0.65} color="#ffe2b4" />
    <SceneInstances>
    {Array.from({length:count},(_,i) => <group key={i} position={[(i%5-2)*4.55,-Math.floor(i/5)*4,0]}>
      <RoomOccupants.Provider value={i%5===0?2:1}>
        {kinds[i%6] === null ? <MainBranchRoom powered={powered} active /> : <BuiltRoom kind={kinds[i%6]!} powered={powered} />}
      </RoomOccupants.Provider>
      <Fork fork={person(i)} layout={roomLayout(kinds[i%6] ?? null)} />
      {i%5 === 0 && <Fork fork={person(i+count)} layout={roomLayout(kinds[i%6] ?? null)} />}
    </group>)}
    </SceneInstances>
    <SceneEffects quality={quality} />
  </Canvas>;
}
export function SceneLab() { return <main style={{height:"100vh",position:"relative"}}><Suspense><Scene /></Suspense></main>; }
