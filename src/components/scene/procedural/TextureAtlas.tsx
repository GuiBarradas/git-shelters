"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { CanvasTexture, LinearFilter, PlaneGeometry, SRGBColorSpace } from "three";
import { mulberry32 } from "@/lib/forks/catalog";
import type { GeneratedBunker, PropDescriptor } from "@/lib/visuals/types";

const CELL = 256;
export const TileContext = createContext<[number, number, number, number]>([0, 0, 1, 1]);
export function AtlasPlane({ size }: { size: [number, number] }) {
  const tile = useContext(TileContext);
  const geometry = useMemo(() => {
    const g = new PlaneGeometry(...size), uv = g.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) uv.setXY(i, tile[0] + uv.getX(i) * tile[2], tile[1] + uv.getY(i) * tile[3]);
    return g;
  }, [size[0], size[1], tile]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <primitive object={geometry} attach="geometry" />;
}

function drawTile(ctx: CanvasRenderingContext2D, p: PropDescriptor) {
  const r = p.texture!, rand = mulberry32(r.seed), [a, b, c] = r.palette;
  ctx.fillStyle = p.kind === "monitor" ? "#171124" : p.kind === "rug" ? a : "#dfc5a3";
  ctx.fillRect(0, 0, CELL, CELL);
  ctx.strokeStyle = b; ctx.fillStyle = b;
  if (p.kind === "rug") {
    ctx.lineWidth = 7; ctx.strokeRect(14, 14, 228, 228); ctx.strokeRect(26, 26, 204, 204);
    for (let x = 42; x < 225; x += 28) for (let y = 42; y < 225; y += 28) {
      ctx.fillStyle = rand() > 0.5 ? b : c;
      ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x + 7, y); ctx.lineTo(x, y + 7); ctx.lineTo(x - 7, y); ctx.fill();
    }
  } else if (p.kind === "monitor") {
    ctx.fillStyle = c; ctx.font = "bold 14px monospace"; ctx.fillText("REPO // CONNECTED", 15, 27);
    const words = r.text.match(/.{1,25}/gu) ?? ["system ready"];
    ctx.font = "12px monospace"; words.slice(0, 6).forEach((line, i) => ctx.fillText(line, 15, 65 + i * 20));
    ctx.fillStyle = b;
    for (let i = 0; i < 9; i++) ctx.fillRect(15, 182 + i * 5, 15 + rand() * 170, 2);
    ctx.globalAlpha = 0.12; ctx.fillStyle = "#000000";
    for (let y = 0; y < CELL; y += 4) ctx.fillRect(0, y, CELL, 1);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = a; ctx.fillRect(18, 18, 220, 10);
    ctx.strokeStyle = b; ctx.lineWidth = 5;
    if (r.motif === "data") {
      for (let i = 0; i < 6; i++) ctx.fillRect(38 + i * 31, 132 - i * 12, 16, 20 + i * 12);
    } else {
      ctx.strokeRect(79, 58, 95, 79);
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(35 + i * 37, 40); ctx.lineTo(35 + i * 37, 80); ctx.lineTo(64 + i * 27, 100); ctx.stroke(); }
    }
    ctx.fillStyle = "#3a2b36"; ctx.font = "bold 17px monospace";
    const words = r.text.match(/.{1,19}/gu) ?? [];
    words.slice(0, 3).forEach((line, i) => ctx.fillText(line, 20, 172 + i * 23));
    ctx.fillStyle = c; ctx.fillRect(211, 211, 25, 25);
  }
  // Seeded paper grain, generated once; no frame-time canvas uploads.
  for (let i = 0; i < 350; i++) {
    ctx.fillStyle = rand() > 0.5 ? "#ffffff0b" : "#0000000b";
    ctx.fillRect(rand() * CELL, rand() * CELL, 2, 2);
  }
}

export function useBunkerAtlas(bunker: GeneratedBunker) {
  const atlas = useMemo(() => {
    const props = bunker.rooms.flatMap(room => room.props.filter(p => p.texture));
    const columns = Math.max(1, Math.ceil(Math.sqrt(props.length))), rows = Math.max(1, Math.ceil(props.length / columns));
    const canvas = document.createElement("canvas"); canvas.width = columns * CELL; canvas.height = rows * CELL;
    const ctx = canvas.getContext("2d")!;
    const tiles = new Map<string, [number, number, number, number]>();
    props.forEach((p, i) => {
      const x = i % columns, y = Math.floor(i / columns);
      ctx.save(); ctx.translate(x * CELL, y * CELL); drawTile(ctx, p); ctx.restore();
      tiles.set(p.id, [(x + 0.002) / columns, (rows - y - 1 + 0.002) / rows, 0.996 / columns, 0.996 / rows]);
    });
    const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
    texture.generateMipmaps = false; texture.minFilter = LinearFilter;
    return { texture, tiles };
  }, [bunker]);
  useEffect(() => () => atlas.texture.dispose(), [atlas]);
  return atlas;
}

export type BunkerAtlas = ReturnType<typeof useBunkerAtlas>;
