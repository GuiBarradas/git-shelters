"use client";

import dynamic from "next/dynamic";

import type { PaletteColor } from "@/lib/palette";

const BunkerScene = dynamic(() => import("./BunkerScene"), { ssr: false });

type BunkerSceneClientProps = {
  cubeColor?: PaletteColor;
};

export function BunkerSceneClient({ cubeColor }: BunkerSceneClientProps) {
  return <BunkerScene cubeColor={cubeColor} />;
}
