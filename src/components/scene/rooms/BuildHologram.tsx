"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { BoxGeometry, EdgesGeometry, LineBasicMaterial } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ROOM_CATALOG, type RoomKind } from "@/lib/rooms/catalog";
import { useRoomPhase } from "./AmbientLife";

type Box = [number, number, number, number, number, number];
const outlines: Record<RoomKind, Box[]> = {
  cache_storage: [[0,0.6,-0.4,2.2,1.2,0.8],[-1.3,1.9,-0.7,0.6,0.7,0.4]],
  power_plant: [[0,0.75,-0.4,2,1.5,1],[-1.5,1.2,-0.8,0.45,2.4,0.4]],
  dorm: [[0,0.35,-0.5,2.5,0.2,1],[0,1.65,-0.5,2.5,0.2,1]],
  elevator: [[0,1.35,-0.6,1.6,2.7,0.8]],
  workshop: [[0,0.7,-0.4,2.5,0.15,0.9],[0,1.9,-0.9,2.2,0.9,0.1]],
};
function outline(boxes: Box[]) {
  const edges = boxes.map(([x,y,z,w,h,d]) => {
    const box = new BoxGeometry(w,h,d);
    const edge = new EdgesGeometry(box).translate(x,y,z);
    box.dispose(); return edge;
  });
  const geometry = mergeGeometries(edges);
  edges.forEach(edge => edge.dispose());
  return geometry;
}
const generic = outline([[0,1.3,-0.6,2.4,2.4,0.8]]);
const geometries = Object.fromEntries(Object.entries(outlines).map(([kind, boxes]) => [kind,outline(boxes)])) as Record<RoomKind,ReturnType<typeof outline>>;

export function BuildHologram({ kind, missingBytes, highlight }: { kind?: RoomKind; missingBytes?: number; highlight: boolean }) {
  const { root, offset } = useRoomPhase();
  const material = useRef<LineBasicMaterial>(null);
  const geometry = useMemo(() => kind ? geometries[kind] : generic, [kind]);
  useFrame(({ clock }) => {
    if (material.current) material.current.opacity = (highlight ? 0.6 : 0.22) + Math.sin(clock.elapsedTime * 1.7 + offset()) * 0.08;
  });
  return <group ref={root}>
    <lineSegments geometry={geometry} dispose={null}><lineBasicMaterial ref={material} color="#b779ff" transparent depthWrite={false} toneMapped={false} /></lineSegments>
    {kind && <Html center position={[0,0.5,1.25]} style={{pointerEvents:"none",whiteSpace:"nowrap"}}>
      <div className="border border-[#BD93F9]/60 bg-[#120b1e]/90 px-2 py-1 font-mono text-[10px] text-[#dfc6ff]">{ROOM_CATALOG[kind].name} · {missingBytes ? `${missingBytes} B to go` : "Ready to build"}</div>
    </Html>}
  </group>;
}
