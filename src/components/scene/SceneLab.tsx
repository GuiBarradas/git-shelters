"use client";
import dynamic from "next/dynamic";
import { Canvas } from "@react-three/fiber";
import { Html, PerformanceMonitor } from "@react-three/drei";
import { DioramaCamera } from "./DioramaCamera";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import BunkerScene from "./BunkerScene";
import { BuiltRoom, EmptyCell, MainBranchRoom, roomLayout } from "./rooms";
import { SceneInstances } from "./SceneInstances";
import { generateBunker } from "@/lib/visuals/generate";
import { OptionalBunkerVisuals, ProceduralRoom, proceduralLayout } from "./procedural/ProceduralRoom";
import { Fork } from "./Fork";
import { QualityControl, SceneEffects, useQuality } from "./SceneQuality";
import { RoomOccupants } from "./rooms/Details";
import type { RoomKind } from "@/lib/rooms/catalog";
import { forkLook } from "@/lib/forks/catalog";
const RoomScene = dynamic(() => import("./RoomScene"), { ssr: false });
const kinds: (RoomKind | null)[] = [null,"cache_storage","power_plant","dorm","elevator","workshop"];
function Scene() {
  const query = useSearchParams();
  const [entered, setEntered] = useState<number | null>(null);
  const [action, setAction] = useState("");
  const [dpr, setDpr] = useState(1);
  const count = query.get("rooms") === "30" ? 30 : 10;
  const powered = query.get("dark") !== "1";
  const quality = useQuality();
  const numericSeed = Number(query.get("seed"));
  const visuals = useMemo(() => Number.isSafeInteger(numericSeed) && numericSeed > 0 ? generateBunker(numericSeed, {recentActivity:1}, Array.from({length:count},(_,slot)=>({slot,kind:kinds[slot%6] ?? "main"}))) : null, [numericSeed,count]);
  const requested = query.get("quality");
  useEffect(() => {
    if (requested !== "low" && requested !== "medium" && requested !== "high") return;
    try { localStorage.setItem("shelter-quality", requested); } catch { return; }
    window.dispatchEvent(new Event("shelter-quality"));
  }, [requested]);
  const person = (i: number) => ({ id: `preview-${i}`, name: "Preview", trait: "junior" as const, mood: "content" as const, seed: i * 131, roomSlot: 0 });
  if (query.has("forks")) return <Canvas dpr={1} gl={{antialias:true}} style={{background:"#19141f"}}>
    <DioramaCamera width={7.4} height={4.4} center={[0,-0.25,0]} />
    <hemisphereLight args={["#ddd2ef","#493343",1.5]} />
    <directionalLight position={[-3,5,6]} intensity={2.2} color="#ffe1bc" />
    <SceneInstances>
      {[0, Array.from({length:32},(_,i)=>i).find(i=>forkLook(person(i).seed).helmet)!].map((seed,row)=><group key={row} position={[0,-row*2.15,0]}>
        {[0, Math.PI/2, Math.PI, -Math.PI/4].map((facing,column)=><group key={column} position={[(column-1.5)*1.7,0,0]}>
          <Fork fork={person(seed)} layout={{walk:{z:0,xMin:0,xMax:0},stations:[{position:[0,0,0],facing,action:"inspect",hold:3600}]}} />
          <Html position={[0,-0.23,0]} center style={{color:"#ddcbe9",font:"12px monospace",whiteSpace:"nowrap"}}>{["Frente","Perfil","Costas","3/4"][column]}</Html>
        </group>)}
      </group>)}
    </SceneInstances>
  </Canvas>;
  const sampleRooms = [{slot:1,kind:"cache_storage"},{slot:2,kind:"power_plant"},{slot:3,kind:"dorm"},{slot:4,kind:"elevator"},{slot:5,kind:"workshop"}] as const;
  if (query.has("overview") && entered === null) return <>
    <BunkerScene visuals={visuals} rooms={[...sampleRooms]} forks={[person(1), {...person(2),roomSlot:1}]} activeToday powered={powered} onSlotClick={(slot,built) => { setAction(`${slot}:${built}`); if (built) setEntered(slot); }} />
    <output data-testid="scene-action" className="absolute bottom-4 left-4 text-white">{action}</output>
  </>;
  const selected = entered === null ? query.get("room") : entered === 0 ? "main" : sampleRooms.find(room => room.slot === entered)?.kind;
  if (selected && selected !== "empty") return <RoomScene visuals={visuals} slot={entered ?? kinds.indexOf(selected === "main" ? null : selected as RoomKind)} kind={selected === "main" ? null : selected as RoomKind} activeToday eventPending={false} powered={powered} forks={query.has("empty") ? [] : [person(0)]} panel={<div style={{ color:"#ede2ff", padding:10, fontFamily:"monospace" }}>MAIN BRANCH<br/>System online</div>} />;
  return <><QualityControl value={quality} /><Canvas dpr={dpr} gl={{ antialias:false, powerPreference:"high-performance" }} style={{background:"radial-gradient(ellipse, #211529, #0c0911 75%)"}}>
    <PerformanceMonitor ms={500} iterations={4} threshold={0.5} bounds={() => [60,65]} onDecline={() => setDpr(value => Math.max(0.75,value - 0.1))} />
    <DioramaCamera width={selected === "empty" ? 5.2 : 24} height={selected === "empty" ? 4.1 : count / 5 * 4} center={[0,selected === "empty" ? 1.5 : 1.5 - (count / 5 - 1) * 2,0]} />
    <hemisphereLight args={["#978dbb","#30232f",powered ? 0.42 : 0.18]} /><directionalLight position={[-3,8,10]} intensity={powered ? 0.65 : 0.18} color="#ffe2b4" />
    <OptionalBunkerVisuals bunker={visuals}><SceneInstances simpleLighting={quality === "low"}>
    {selected === "empty" ? <EmptyCell highlight preview={{kind: "workshop", missingBytes: 80}} /> : Array.from({length:count},(_,i) => <group key={i} position={[(i%5-2)*4.55,-Math.floor(i/5)*4,0]}>
      <RoomOccupants.Provider value={i%5===0?2:1}>
        {visuals?.rooms[i] ? <ProceduralRoom room={visuals.rooms[i]} powered={powered} /> : kinds[i%6] === null ? <MainBranchRoom powered={powered} active /> : <BuiltRoom kind={kinds[i%6]!} powered={powered} />}
      </RoomOccupants.Provider>
      <Fork fork={person(i)} powered={powered} layout={visuals?.rooms[i] ? proceduralLayout(visuals.rooms[i]) : roomLayout(kinds[i%6] ?? null)} />
      {i%5 === 0 && <Fork fork={person(i+count)} powered={powered} stationIndex={1} layout={visuals?.rooms[i] ? proceduralLayout(visuals.rooms[i]) : roomLayout(kinds[i%6] ?? null)} />}
    </group>)}
    </SceneInstances></OptionalBunkerVisuals>
    <SceneEffects quality={quality} />
  </Canvas></>;
}
export function SceneLab() { return <main style={{height:"100vh",position:"relative"}}><Suspense><Scene /></Suspense></main>; }
