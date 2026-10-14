"use client";

import { AtlasPlane } from "./TextureAtlas";
import { VisualMaterial } from "./VisualContext";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group, Texture } from "three";
import { LIVE, RoomLight, SoftBoxGeometry } from "../rooms/Details";
import type { PropKind, VisualRoomKind } from "@/lib/visuals/types";

type Triple = [number, number, number];
type ModelProps = {
  kind: PropKind; color: string; wood: string; fabric: string; warmLight: string; emissive: string;
  variant: number; lit: boolean; filled: boolean; texture?: Texture;
  roomKind?: VisualRoomKind; slot?: string; powered?: boolean;
};
const ink = "#201b27", metal = "#45434b", paper = "#e2c8a0";

function Box({ size, at = [0,0,0], color, glow, rotation }: { size: Triple; at?: Triple; color: string; glow?: string; rotation?: Triple }) {
  return <mesh position={at} rotation={rotation}><SoftBoxGeometry args={size} /><VisualMaterial color={color} emissive={glow ?? "#000000"} emissiveIntensity={glow ? 1.5 : 0} /></mesh>;
}

function Rotor({ powered, phase }: { powered: boolean; phase: number }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => { if (ref.current && powered) ref.current.rotation.z = clock.elapsedTime * 1.5 + phase; });
  return <group ref={ref} position={[0,0.03,0.43]} userData={LIVE}>{[0,1,2,3,4].map(i => <group key={i} rotation={[0,0,i*Math.PI*0.4]}><Box at={[0,0.15,0]} size={[0.07,0.23,0.03]} color={paper} /></group>)}</group>;
}

function Clock() {
  const hour = useRef<Group>(null), minute = useRef<Group>(null);
  const second = useRef(-1);
  useFrame(({ clock }) => {
    const tick = Math.floor(clock.elapsedTime);
    if (second.current === tick) return;
    second.current = tick;
    const now = new Date();
    if (hour.current) hour.current.rotation.z = -(now.getHours()%12 + now.getMinutes()/60)*Math.PI/6;
    if (minute.current) minute.current.rotation.z = -now.getMinutes()*Math.PI/30;
  });
  return <>
    <mesh rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[0.48,0.48,0.08,12]} /><VisualMaterial color={paper} /></mesh>
    <group ref={hour} userData={LIVE}><Box at={[0,0.1,0.061]} size={[0.04,0.24,0.015]} color={ink} /></group>
    <group ref={minute} userData={LIVE}><Box at={[0,0.16,0.068]} size={[0.025,0.36,0.015]} color={ink} /></group>
  </>;
}
function Decal({ texture, size = [0.86,0.82], at = [0,0,0.1], color = paper }: { texture?: Texture; size?: [number,number]; at?: Triple; color?: string }) {
  return <mesh position={at}><AtlasPlane size={size} /><VisualMaterial color={texture ? "#ffffff" : color} map={texture} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} /></mesh>;
}
function Desk({ wood, color, variant = 0, keyboard = false }: { wood: string; color: string; variant?: number; keyboard?: boolean }) {
  return <>
    <Box at={[0,0.44,0]} size={[1,0.12,1]} color={wood} />
    {[-0.43,0.43].flatMap(x=>[-0.38,0.38].map(z=><Box key={`${x}:${z}`} at={[x,-0.03,z]} size={[variant === 2 ? 0.08 : 0.055,0.88,0.055]} color={variant === 2 ? wood : ink} />))}
    <Box at={[0.26,0.27,-0.06]} size={[0.35,0.18,0.74]} color={color} />
    <Box at={[0.26,0.27,0.32]} size={[0.12,0.025,0.03]} color={paper} />
    {variant === 0 && <>
      <Box at={[-0.43,-0.03,0]} size={[0.12,0.88,0.87]} color={wood} />
      <Box at={[0.18,0.504,-0.2]} size={[0.08,0.008,0.45]} color={paper} />
    </>}
    {variant === 1 && <>
      {[-0.43,0.43].map(x => <Box key={x} at={[x,-0.25,0]} size={[0.09,0.08,0.88]} color={metal} />)}
      <Box at={[0,-0.2,-0.35]} size={[0.9,0.055,0.045]} color={metal} />
    </>}
    {variant === 2 && <>
      <Box at={[0.29,-0.04,-0.03]} size={[0.29,0.82,0.83]} color={wood} />
      {[-0.25,0,0.25].map(y => <Box key={y} at={[0.29,y,0.39]} size={[0.16,0.025,0.025]} color={paper} />)}
    </>}
    {keyboard && <group position={[-0.32,0.52,0.33]} rotation={[0,-0.35,0]}>
      <Box size={[0.36,0.025,0.22]} color={ink} />
      {[0,1,2].flatMap(row => Array.from({length:10},(_,i) => <mesh key={`${row}:${i}`} position={[-0.15+i*0.033,0.023,-0.07+row*0.065]}><boxGeometry args={[0.026,0.02,0.045]} /><VisualMaterial color={paper} /></mesh>))}
    </group>}
  </>;
}

/** Authored silhouettes in a unit cube; placement, bounds and variation belong to the recipe. */
export function PropModel({ kind, color, wood, fabric, warmLight, emissive, variant, lit, filled, texture, roomKind, slot, powered = true }: ModelProps) {
  switch (kind) {
    case "desk": return <Desk wood={wood} color={color} variant={variant} keyboard />;
    case "chair": return <>
      {variant === 0 ? [-0.15,0.06,0.27].map(y => <Box key={y} at={[0,y,-0.36]} size={[0.86,0.16,0.15]} color={wood} />) : <Box at={[0,0.2,-0.36]} size={[variant === 1 ? 0.65 : 0.86,variant === 1 ? 0.44 : 0.6,0.2]} color={fabric} />}
      {variant === 2 && [-0.46,0.46].map(x => <Box key={x} at={[x,0.04,0.02]} size={[0.07,0.1,0.8]} color={wood} />)}
      <Box at={[0,-0.08,0]} size={[0.88,0.15,0.86]} color={fabric} />
      <Box at={[0,-0.29,-0.03]} size={[0.1,0.35,0.1]} color={metal} />
      <mesh position={[0,-0.47,0]}><cylinderGeometry args={[0.32,0.36,0.05,10]} /><VisualMaterial color={ink} /></mesh>
    </>;
    case "monitor": return <>
      <Box at={[0,0.05,-0.07]} size={[0.99,0.86,0.76]} color={variant === 1 ? wood : paper} />
      <Box at={[0,-0.44,-0.03]} size={[0.52,0.1,0.78]} color={metal} />
      <Box at={[0,0.07,0.325]} size={[0.93,0.77,0.055]} color={ink} />
      <mesh position={[0,0.07,0.357]}><AtlasPlane size={[0.86,0.7]} /><VisualMaterial color={lit ? emissive : "#211829"} map={lit ? texture : undefined} emissive={emissive} emissiveIntensity={lit ? 0.8 : 0} /></mesh>
      <Box at={[0.32,-0.31,0.366]} size={[0.04,0.022,0.015]} color={lit ? emissive : ink} glow={lit ? emissive : undefined} />
      {lit && <RoomLight position={[0,0,0.55]} color={emissive} intensity={0.45} distance={1.7} decay={2} />}
    </>;
    case "rack": return roomKind === "cache_storage" && slot === "rack-2" ? <>
      <Box at={[0,-0.29,0]} size={[0.94,0.42,0.92]} color={wood} />
      <Box at={[0,-0.07,0]} size={[0.98,0.04,0.98]} color={paper} />
      <Box at={[0,0.36,-0.25]} size={[0.94,0.23,0.44]} color={wood} />
      <Box at={[0,0.23,-0.25]} size={[0.84,0.015,0.4]} color={warmLight} glow={powered ? warmLight : undefined} />
      <mesh position={[0,-0.02,0]}><cylinderGeometry args={[0.28,0.25,0.12,10]} /><VisualMaterial color={metal} /></mesh>
      <Box at={[0.3,0.02,0]} size={[0.3,0.035,0.06]} color={ink} />
      <Box at={[0,-0.27,0.475]} size={[0.7,0.23,0.015]} color={ink} />
    </> : <>
      <Box size={[0.92,1,0.88]} color={ink} />
      {[0,1,2,3,4].map(i=><group key={i} position={[0,0.33-i*0.155,0.46]}>
        <Box size={[0.76,0.105,0.04]} color={i%2 ? "#302935" : metal} />
        <Box at={[0.26,0,0.026]} size={[0.033,0.029,0.012]} color={lit ? emissive : metal} glow={lit && i%2===0 ? emissive : undefined} />
      </group>)}
      <Box at={[0,-0.42,0.46]} size={[0.67,0.043,0.025]} color={warmLight} />
    </>;
    case "board": return <><Box size={[1,1,0.12]} color={wood} /><Decal texture={texture} /></>;
    case "clock": return <Clock />;
    case "mug": return <>
      <mesh><cylinderGeometry args={[0.32,0.28,0.86,10]} /><VisualMaterial color={color} /></mesh>
      <mesh position={[0,filled ? 0.42 : 0.37,0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[0.265,10]} /><VisualMaterial color={filled ? "#452718" : "#927868"} /></mesh>
      <mesh position={[0.32,0.03,0]}><torusGeometry args={[0.18,0.055,4,8]} /><VisualMaterial color={color} /></mesh>
    </>;
    case "planter": return <>
      <mesh position={[0,-0.29,0]}><cylinderGeometry args={[0.34,0.25,0.42,8]} /><VisualMaterial color={color} /></mesh>
      <mesh position={[0,-0.073,0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[0.3,8]} /><VisualMaterial color="#392c2b" /></mesh>
      {[-1,0,1].map(i=><mesh key={i} position={[i*0.14,0.17,0]} rotation={[0,i*0.5,-i*0.3]}><coneGeometry args={[0.15,0.61,4]} /><VisualMaterial color={i===0 ? "#a48b61" : "#c8b68e"} /></mesh>)}
    </>;
    case "crate": return <>
      <Box size={[0.94,0.86,0.92]} color={wood} />
      {[-0.34,0.34].map(x=><Box key={x} at={[x,0,0.48]} size={[0.09,0.98,0.04]} color={color} />)}
      <Box at={[0,0.06,0.493]} size={[0.35,0.25,0.012]} color={paper} />
    </>;
    case "books": return <>{[0,1,2].map(i=><group key={i} position={[i%2*0.05,-0.32+i*0.29,0]} rotation={[0,(i-1)*0.07,0]}>
      <Box size={[0.86,0.25,0.78]} color={i===1 ? fabric : color} /><Box at={[0.04,0,0.012]} size={[0.78,0.14,0.76]} color={paper} />
    </group>)}</>;
    case "poster": return <><Box size={[0.99,0.99,0.03]} color={ink} /><Decal texture={texture} size={[0.91,0.91]} at={[0,0,0.02]} /><Box size={[0.2,0.065,0.015]} at={[0.04,0.455,0.032]} color={paper} /></>;
    case "note": return <><Decal texture={texture} size={[0.98,0.98]} at={[0,0,0]} color={color} /><Box size={[0.075,0.075,0.025]} at={[0,0.38,0.018]} color={fabric} /></>;
    case "rug": return <mesh rotation={[-Math.PI/2,0,0]}><AtlasPlane size={[1,1]} /><VisualMaterial color={texture ? "#ffffff" : fabric} map={texture} /></mesh>;
    case "pipe": return <>
      <mesh rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[0.09,0.09,0.94,8]} /><VisualMaterial color={metal} /></mesh>
      {[-0.33,0.33].map(x=><mesh key={x} position={[x,0,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[0.14,0.14,0.08,8]} /><VisualMaterial color={color} /></mesh>)}
    </>;
    case "bunk": return <>
      {[-0.45,0.45].flatMap(x=>[-0.42,0.42].map(z=><Box key={`${x}:${z}`} at={[x,0,z]} size={[0.055,1,0.055]} color={wood} />))}
      {[-0.32,0.22].map(y=><group key={y} position={[0,y,0]}>
        <Box size={[0.94,0.05,0.9]} color={wood} /><Box at={[0,0.06,0]} size={[0.88,0.09,0.82]} color={paper} />
        <Box at={[0.13,0.11,0.02]} size={[0.59,0.025,0.83]} color={fabric} /><Box at={[-0.31,0.14,0]} size={[0.19,0.055,0.6]} color={paper} />
      </group>)}
      {[0,1,2,3].map(i=><Box key={i} at={[0.3,-0.4+i*0.2,0.46]} size={[0.23,0.035,0.04]} color={warmLight} />)}
    </>;
    case "generator": return <>
      <Box at={[0,-0.43,0]} size={[1,0.14,0.98]} color={warmLight} />
      <Box at={[0,0.02,-0.03]} size={[0.94,0.78,0.72]} color={metal} />
      <mesh position={[0,0.03,0.35]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[0.35,0.35,0.065,14]} /><VisualMaterial color={ink} /></mesh>
      <mesh position={[0,0.03,0.4]}><torusGeometry args={[0.33,0.015,4,16]} /><VisualMaterial color={lit ? emissive : metal} emissive={emissive} emissiveIntensity={lit ? 1.3 : 0} /></mesh>
      <Rotor powered={powered} phase={variant} />
      <Box at={[0.37,0.31,0.37]} size={[0.08,0.035,0.03]} color={lit ? warmLight : ink} glow={lit ? warmLight : undefined} />
    </>;
    case "workbench": return <>
      <group position={[0,-0.15,0]} scale={[1,0.7,1]}><Desk wood={wood} color={color} /></group>
      <Box at={[0,0.34,-0.4]} size={[0.94,0.32,0.08]} color={wood} />
      {[-0.3,0,0.3].map(x=><Box key={x} at={[x,0.3,-0.34]} size={[0.045,0.2,0.035]} color={metal} />)}
    </>;
    case "cabinet": return <>
      <Box size={[0.94,1,0.94]} color={color} />
      {[-0.32,0,0.32].map(y=><group key={y} position={[0,y,0.48]}>
        <Box size={[0.82,0.27,0.025]} color={metal} /><Box at={[0,0.045,0.023]} size={[0.25,0.035,0.025]} color={paper} />
      </group>)}
    </>;
    case "lamp": return <>
      {(slot === "sconce" || slot?.startsWith("call-light")) && <>
        <Box at={[0,-0.45,0]} size={[0.98,0.1,0.98]} color={wood} />
        <Box at={[0,-0.16,-0.45]} size={[0.6,0.64,0.08]} color={wood} />
      </>}
      {variant === 0 ? <Box at={[0,0.24,0]} size={[0.07,0.5,0.07]} color={metal} /> : <>
        <Box at={[0,-0.46,0]} size={[0.85,0.08,0.75]} color={ink} />
        <Box at={[-0.1,-0.09,0]} size={[0.08,0.74,0.09]} color={metal} rotation={[0,0,-0.16]} />
      </>}
      <mesh position={[0,variant === 0 ? -0.14 : 0.32,0]}><cylinderGeometry args={[0.14,0.44,0.3,6]} /><VisualMaterial color={variant === 1 ? warmLight : wood} /></mesh>
      <Box at={[0,variant === 0 ? -0.3 : 0.15,0]} size={[0.66,0.03,0.59]} color={lit ? warmLight : paper} glow={lit ? warmLight : undefined} />
      {lit && <RoomLight position={[0,0,0.3]} color={warmLight} intensity={0.65} distance={2.7} decay={2} />}
    </>;
    case "aquarium": return <>
      <Box size={[0.98,0.94,0.92]} color={ink} />
      <Box at={[0,0,0.47]} size={[0.84,0.72,0.018]} color="#263b55" glow={lit ? "#52688a" : undefined} />
      <Box at={[0,-0.33,0.488]} size={[0.82,0.07,0.018]} color={paper} />
      {[-0.2,0.18].map((x,i)=><group key={x} position={[x,i*0.17-0.07,0.49]}>
        <Box size={[0.17,0.08,0.016]} color={i ? warmLight : paper} /><mesh position={[-0.105,0,0]} rotation={[0,0,Math.PI/2]}><coneGeometry args={[0.065,0.08,3]} /><VisualMaterial color={i ? warmLight : paper} /></mesh>
      </group>)}
    </>;
    case "cat": return <>
      <Box at={[-0.05,-0.17,0]} size={[0.78,0.42,0.6]} color={color} />
      <Box at={[0.27,0.13,0.13]} size={[0.41,0.41,0.42]} color={color} />
      {[-0.12,0.12].map(x=><mesh key={x} position={[0.27+x,0.39,0.12]}><coneGeometry args={[0.12,0.21,4]} /><VisualMaterial color={color} /></mesh>)}
      {[-0.09,0.09].map(x=><Box key={x} at={[0.27+x,0.13,0.35]} size={[0.07,0.015,0.01]} color={ink} />)}
      <mesh position={[-0.29,-0.1,0.04]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[0.3,0.075,4,10,Math.PI*1.5]} /><VisualMaterial color={color} /></mesh>
    </>;
    case "flag": return <>
      <Box at={[-0.46,0,0]} size={[0.035,1,0.035]} color={metal} />
      <Box at={[0.01,0.12,0]} size={[0.89,0.64,0.025]} color={fabric} />
      <Decal texture={texture} size={[0.77,0.54]} at={[0.01,0.12,0.02]} color={emissive} />
    </>;
    default: return null;
  }
}
