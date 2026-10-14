"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { GeneratedBunker, GeneratedRoom } from "@/lib/visuals/types";
import type { RoomLayout } from "../Fork";
import type { PanelAnchor } from "../rooms";
import { RoomShell } from "../rooms/RoomShell";
import { AmbientLife } from "../rooms/AmbientLife";
import { ContactShade } from "../rooms/ContactShade";
import { PropModel } from "./PropModel";
import { VisualContext, VisualPower } from "./VisualContext";
import { TileContext, useBunkerAtlas, type BunkerAtlas } from "./TextureAtlas";

const AtlasContext = createContext<BunkerAtlas | null>(null);

export function OptionalBunkerVisuals({ bunker, children }: { bunker?: GeneratedBunker | null; children: ReactNode }) {
  return bunker ? <BunkerVisuals bunker={bunker}>{children}</BunkerVisuals> : children;
}

export function BunkerVisuals({ bunker, children }: { bunker: GeneratedBunker; children: ReactNode }) {
  const atlas = useBunkerAtlas(bunker);
  return <VisualContext.Provider value={bunker.identity}><AtlasContext.Provider value={atlas}>{children}</AtlasContext.Provider></VisualContext.Provider>;
}

export function proceduralLayout(room: GeneratedRoom): RoomLayout {
  const chair = room.props.find(p => p.slot === "chair"), hero = room.props.find(p => room.kind === "cache_storage" ? p.slot === "rack-2" : ["generator", "workbench", "rack", "bunk"].includes(p.slot));
  const walk = { z: 1.07, xMin: -1.55, xMax: 1.55 };
  if (room.kind === "main" && chair) return { walk: { ...walk, xMax: -0.2 }, stations: [{
    position: [chair.position[0], 0, chair.position[2]], facing: chair.rotationY, action: "type", hold: 20,
    seatY: chair.size[1] * 0.42, approach: [chair.position[0] - 0.55, 0, 0.7],
  }] };
  if (!hero || room.kind === "dorm") return { walk, stations: [] };
  const workingZ = Math.min(0.66, hero.position[2] + hero.size[2] / 2 + 0.4);
  return { walk, stations: [{ position: [hero.position[0], 0, workingZ], facing: Math.PI,
    action: room.kind === "power_plant" ? "crank" : room.kind === "cache_storage" ? "cook" : "inspect", hold: 14,
    approach: [hero.position[0], 0, 0.92],
  }] };
}

export function proceduralPanel(room: GeneratedRoom): PanelAnchor {
  const surface = room.props.find(p => p.kind === "monitor") ?? room.props.find(p => p.kind === "board" || p.kind === "poster");
  if (!surface) return { position: [0,1.65,0.5], width: 1.2, height: 0.9 };
  const monitor = surface.kind === "monitor";
  return { position: [surface.position[0], surface.position[1] + surface.size[1] * (monitor ? 0.57 : 0.5), surface.position[2] + surface.size[2] * 0.4],
    width: surface.size[0] * 0.86, height: surface.size[1] * (monitor ? 0.7 : 0.82) };
}

export function ProceduralRoom({ room, powered = true }: { room: GeneratedRoom; powered?: boolean }) {
  const identity = useContext(VisualContext)!, atlas = useContext(AtlasContext)!;
  const colors = identity.palette;
  const furniture = useMemo(() => room.props.filter(p => p.layer === "floor" && p.kind !== "rug"), [room]);
  return <VisualPower.Provider value={powered ? 1 : 0.06}><RoomShell powered={powered} fixtures={false}>
    {room.kind === "elevator" && <group position={[0,1.25,-1.15]}>
      <mesh><boxGeometry args={[1.48,2.5,0.16]} /><meshStandardMaterial color={colors.inset} /></mesh>
      {[-1,1].map(side => <mesh key={side} position={[side*0.355,0,0.1]}><boxGeometry args={[0.68,2.37,0.04]} /><meshStandardMaterial color={colors.concrete} /></mesh>)}
    </group>}
    {room.props.map(p => <group key={p.id} position={[p.position[0], p.position[1] + p.size[1]/2, p.position[2]]} rotation={[0,p.rotationY,0]} scale={p.size}>
      <TileContext.Provider value={atlas.tiles.get(p.id) ?? [0,0,1,1]}>
        <PropModel roomKind={room.kind} slot={p.slot} powered={powered} kind={p.kind} variant={p.variant} color={p.color} wood={colors.wood} fabric={colors.fabric} warmLight={colors.warmLight} emissive={colors.emissive}
          lit={powered && p.state.lit} filled={p.state.filled} texture={p.texture ? atlas.texture : undefined} />
      </TileContext.Provider>
    </group>)}
    <AmbientLife powered={powered} />
    {furniture.map(p => <group key={`shade:${p.id}`} position={[p.position[0],0.026,p.position[2]]} scale={[p.size[0]*1.6,1,p.size[2]*2.4]}><ContactShade /></group>)}
  </RoomShell></VisualPower.Provider>;
}
