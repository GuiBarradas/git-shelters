"use client";

import type { ReactNode } from "react";
import { ExtrudeGeometry, Path, Shape } from "three";
import { palette } from "@/lib/palette";
import { LightPool, RoomLight, SoftBoxGeometry, StaticBatch } from "./Details";

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
const rimGeometry = new ExtrudeGeometry(rim, { depth: 0.16, bevelEnabled: false, curveSegments: 4, steps: 1 });

/** Rounded pressure hull; front lane and panel anchors retain their footprint. */
export function RoomShell({ children, light = palette.lampWarm, lightIntensity = 6, tone = "#514551", dim = false, powered = true }: {
  children?: ReactNode; light?: string; lightIntensity?: number; tone?: string; dim?: boolean; powered?: boolean;
}) {
  const strength = powered ? 1 : 0.12;
  return <StaticBatch>
    <mesh position={[0, -0.13, 0]}><SoftBoxGeometry args={[4.12, 0.26, 3.04]} /><meshToonMaterial color={dim ? "#24212d" : "#535361"} /></mesh>
    <mesh position={[0, 1.5, -1.375]}><boxGeometry args={[4, 3, 0.25]} /><meshToonMaterial color={dim ? "#282433" : tone} /></mesh>
    {!dim && <>
      <mesh position={[0, 0.42, -1.22]}><SoftBoxGeometry args={[3.94, 0.8, 0.1]} /><meshToonMaterial color="#383744" /></mesh>
      <mesh position={[0, 0.86, -1.14]}><boxGeometry args={[3.94, 0.045, 0.045]} /><meshToonMaterial color={palette.concreteTan} /></mesh>
    </>}
    <mesh position={[0, 3.1, 0]}><SoftBoxGeometry args={[4.25, 0.22, 3]} /><meshToonMaterial color={dim ? "#2c2934" : "#5b5260"} /></mesh>
    {[-1, 1].map(side => <mesh key={side} position={[side * 2.07, 1.5, 0]}><boxGeometry args={[0.16, 3, 3]} /><meshToonMaterial color={dim ? "#292631" : "#4c4354"} /></mesh>)}
    <mesh geometry={rimGeometry} dispose={null} position={[0, 0, 1.38]}><meshToonMaterial color={dim ? "#39313f" : "#82717c"} /></mesh>
    {!dim && <>
      <mesh position={[0, 2.88, -0.35]}><SoftBoxGeometry args={[1.45, 0.13, 0.5]} /><meshToonMaterial color={palette.oldWoodBrown} /></mesh>
      <mesh position={[0, 2.79, -0.35]}><SoftBoxGeometry args={[1.25, 0.045, 0.36]} /><meshBasicMaterial color={powered ? palette.lampWarm : palette.oldWoodBrown} /></mesh>
      <RoomLight position={[0, 2.4, 0.6]} color={light} intensity={lightIntensity * strength} distance={5} decay={2} />
      <LightPool position={[0, 1.8, -1.24]} scale={[1.94, 1.3, 1]} wall color={light} strength={0.3 * strength} />
      <LightPool position={[0, 0.012, 0.1]} scale={[1.95, 1.35, 1]} color={light} strength={0.19 * strength} />
      <mesh position={[1.98, 2.05, 1.48]}><boxGeometry args={[0.035, 0.45, 0.03]} /><meshBasicMaterial color={powered ? palette.phosphorViolet : palette.violetDim} /></mesh>
    </>}
    {children}
  </StaticBatch>;
}
