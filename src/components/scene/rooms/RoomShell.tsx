"use client";

import { useContext, type ReactNode } from "react";
import { ExtrudeGeometry, Path, Shape } from "three";
import { palette } from "@/lib/palette";
import { LightPool, RoomLight, SoftBoxGeometry, StaticBatch, RoomOccupants } from "./Details";

import { ContactShade } from "./ContactShade";
import { SurfaceDetail } from "./SurfaceDetail";

export const CELL = { w: 4, h: 3, d: 3 } as const;

function rounded(path: Shape | Path, x: number, y: number, w: number, h: number, r: number) {
  path.moveTo(x + r, y);
  path.lineTo(x + w - r, y); path.quadraticCurveTo(x + w, y, x + w, y + r);
  path.lineTo(x + w, y + h - r); path.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  path.lineTo(x + r, y + h); path.quadraticCurveTo(x, y + h, x, y + h - r);
  path.lineTo(x, y + r); path.quadraticCurveTo(x, y, x + r, y);
  path.closePath();
}
const rim = new Shape();
rounded(rim, -2.17, -0.22, 4.34, 3.45, 0.48);
const opening = new Path();
rounded(opening, -1.97, 0.01, 3.94, 2.98, 0.42);
rim.holes.push(opening);
const rimGeometry = new ExtrudeGeometry(rim, { depth: 0.34, bevelEnabled: true, bevelThickness: 0.085, bevelSize: 0.07, bevelSegments: 2, curveSegments: 6, steps: 1 });

const inset = new Shape();
rounded(inset, -2.02, -0.04, 4.04, 3.10, 0.43);
const insetOpening = new Path();
rounded(insetOpening, -1.90, 0.09, 3.80, 2.85, 0.36);
inset.holes.push(insetOpening);
const insetGeometry = new ExtrudeGeometry(inset, { depth:0.18, bevelEnabled:true, bevelThickness:0.035, bevelSize:0.035, bevelSegments:1, curveSegments:6 });

/** Rounded pressure hull; front lane and panel anchors retain their footprint. */
export function RoomShell({ children, light = palette.lampWarm, lightIntensity = 6, tone = "#514551", dim = false, powered = true }: {
  children?: ReactNode; light?: string; lightIntensity?: number; tone?: string; dim?: boolean; powered?: boolean;
}) {
  const occupied = useContext(RoomOccupants) > 0;
  const strength = powered ? (occupied ? 1 : 0.65) : 0.12;
  return <StaticBatch>
    <mesh position={[0, -0.13, 0]}><SoftBoxGeometry args={[4.12, 0.26, 3.04]} /><dioramaMaterial power={powered ? 1 : 0.06} color={dim ? "#24212d" : "#535361"} /></mesh>
    <mesh position={[0, 1.5, -1.375]}><boxGeometry args={[4, 3, 0.25]} /><dioramaMaterial power={powered ? 1 : 0.06} color={dim ? "#282433" : tone} /></mesh>
    {!dim && <>
      <mesh position={[0, 0.42, -1.22]}><SoftBoxGeometry args={[3.94, 0.8, 0.1]} /><dioramaMaterial power={powered ? 1 : 0.06} color="#383744" /></mesh>
      <mesh position={[0, 0.86, -1.14]}><boxGeometry args={[3.94, 0.045, 0.045]} /><dioramaMaterial power={powered ? 1 : 0.06} color={palette.concreteTan} /></mesh>
    </>}
    <mesh position={[0, 3.1, 0]}><SoftBoxGeometry args={[4.25, 0.22, 3]} /><dioramaMaterial power={powered ? 1 : 0.06} color={dim ? "#2c2934" : "#5b5260"} /></mesh>
    {[-1, 1].map(side => <mesh key={side} position={[side * 2.07, 1.5, 0]}><boxGeometry args={[0.16, 3, 3]} /><dioramaMaterial power={powered ? 1 : 0.06} color={dim ? "#292631" : "#4c4354"} /></mesh>)}
    <mesh geometry={rimGeometry} dispose={null} position={[0, 0, 1.20]}><dioramaMaterial concrete={1} power={powered ? 1 : 0.06} color={dim ? "#504152" : "#b29298"} /></mesh>
    <mesh geometry={insetGeometry} dispose={null} position={[0,0,1.02]}><dioramaMaterial concrete={1} power={powered ? 1 : 0.06} color="#6a545d" /></mesh>
    {!dim && <>
      <mesh position={[0, 2.88, -0.35]}><SoftBoxGeometry args={[1.45, 0.13, 0.5]} /><dioramaMaterial power={powered ? 1 : 0.06} color={palette.oldWoodBrown} /></mesh>
      <mesh position={[0, 2.79, -0.35]}><SoftBoxGeometry args={[1.25, 0.045, 0.36]} /><meshBasicMaterial color={powered ? palette.lampWarm : palette.oldWoodBrown} /></mesh>
      <SurfaceDetail tile={1} position={[0, 1.5, -1.235]} size={[3.7, 2.7]} />
      <SurfaceDetail tile={1} position={[0.2, 0.018, 0.65]} size={[2.8, 1.1]} floor />
      <RoomLight position={[0, 2.4, 0.6]} color={light} intensity={lightIntensity * strength * 0.4} distance={5} decay={2} />
      <LightPool position={[0, 1.8, -1.24]} scale={[1.94, 1.3, 1]} wall color={light} strength={0.08 * strength} />
      <LightPool position={[0, 0.012, 0.1]} scale={[1.95, 1.35, 1]} color={light} strength={0.05 * strength} />
      <mesh position={[1.98, 2.05, 1.48]}><boxGeometry args={[0.035, 0.45, 0.03]} /><meshBasicMaterial color={powered ? (occupied ? palette.phosphorViolet : palette.violetDim) : palette.amber} /></mesh>
    </>}
    {!dim && <ContactShade room />}
    {children}
  </StaticBatch>;
}
