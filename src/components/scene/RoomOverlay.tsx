"use client";

import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import { Vector3, type Camera } from "three";

import type { RoomStatus } from "@/components/hud/roomStatus";

import type { HudInset } from "./DioramaCamera";
import { CELL } from "./rooms";

export type Rect = { left: number; top: number; right: number; bottom: number };

const CARD_W = 252;
const GAP = 8;
const corner = new Vector3();

/**
 * Screen rectangle (CSS px from the canvas' top-left) of a cell's front
 * face: x0..x0+CELL.w by y0..y0+CELL.h at z = CELL.d / 2, the same box
 * the click hitbox uses. Writes into `out`; allocates nothing.
 */
export function projectRect(x0: number, y0: number, camera: Camera, W: number, H: number, out: Rect): Rect {
  out.left = Infinity; out.top = Infinity; out.right = -Infinity; out.bottom = -Infinity;
  for (let i = 0; i < 4; i++) {
    corner.set(x0 + (i & 1 ? CELL.w : 0), y0 + (i & 2 ? CELL.h : 0), CELL.d / 2).project(camera);
    const px = (corner.x + 1) / 2 * W;
    const py = (1 - corner.y) / 2 * H;
    if (px < out.left) out.left = px;
    if (px > out.right) out.right = px;
    if (py < out.top) out.top = py;
    if (py > out.bottom) out.bottom = py;
  }
  return out;
}

/** Card spot under the room, flipped above when the HUD band below is too short, then clamped into the band. */
export function placeCard(room: Rect, cardH: number, W: number, H: number, inset: HudInset): { x: number; y: number } {
  const minY = inset.top + GAP;
  const maxY = H - inset.bottom - GAP - cardH;
  let y = room.bottom + GAP;
  if (y > maxY) y = room.top - GAP - cardH;
  y = Math.max(minY, Math.min(maxY, y));
  const x = Math.max(GAP, Math.min(W - CARD_W - GAP, room.left));
  return { x, y };
}

type DivRef = RefObject<HTMLDivElement | null>;
/** World x, y of a cell's bottom-left front corner; null hides it. */
type Cell = [number, number] | null;

function moveBox(el: HTMLElement, r: Rect) {
  el.style.transform = `translate(${Math.round(r.left)}px, ${Math.round(r.top)}px)`;
  el.style.width = `${Math.round(r.right - r.left)}px`;
  el.style.height = `${Math.round(r.bottom - r.top)}px`;
  el.style.visibility = "visible";
}

function moveCard(el: HTMLElement, x: number, y: number) {
  el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  el.style.visibility = "visible";
}

function track(at: Cell, box: HTMLElement | null, card: HTMLElement | null, camera: Camera, W: number, H: number, inset: HudInset, out: Rect) {
  if (!at || !box) return;
  const r = projectRect(at[0], at[1], camera, W, H, out);
  // Read the card's height before writing styles, so the frame lays out once.
  const cardH = card?.offsetHeight ?? 0;
  moveBox(box, r);
  if (card) {
    const { x, y } = placeCard(r, cardH, W, H, inset);
    moveCard(card, x, y);
  }
}

/**
 * Lives inside the Canvas and draws nothing: each frame it projects the
 * hovered and the blocked cell and moves their DOM boxes. The camera
 * sways with the pointer, so this cannot be a one-off; it writes styles
 * through refs instead of React state. The projection reuses one vector
 * and one rect; the style strings and placeCard's small result object are
 * the only per-frame garbage, and only while an overlay is showing.
 */
export function OverlayProbe({ hoverAt, blockerAt, hoverRef, cardRef, blockerRef, inset }: {
  hoverAt: Cell;
  blockerAt: Cell;
  hoverRef: DivRef;
  cardRef: DivRef;
  blockerRef: DivRef;
  inset: HudInset;
}) {
  const rectRef = useRef<Rect>({ left: 0, top: 0, right: 0, bottom: 0 });
  useFrame(({ camera, size }) => {
    track(hoverAt, hoverRef.current, cardRef.current, camera, size.width, size.height, inset, rectRef.current);
    track(blockerAt, blockerRef.current, null, camera, size.width, size.height, inset, rectRef.current);
  });
  return null;
}

/**
 * The DOM half: one violet outline plus a 252 px card for the hovered
 * cell, and one amber dashed outline with a "+ ASSIGN" chip for the room
 * that needs a worker. Positioned by OverlayProbe; only the chip takes clicks.
 */
export function RoomOverlay({ hover, blocker, hoverRef, cardRef, blockerRef, onAssign }: {
  hover: { slot: number; status: RoomStatus } | null;
  blocker: { role: string } | null;
  hoverRef: DivRef;
  cardRef: DivRef;
  blockerRef: DivRef;
  onAssign: () => void;
}) {
  const hidden = { visibility: "hidden" } as const;
  return (
    <div data-hud className="pointer-events-none absolute inset-0 z-[1] overflow-hidden font-mono">
      {blocker && (
        <div ref={blockerRef} style={hidden} className="absolute left-0 top-0 border border-dashed border-hud-amber">
          <button
            type="button"
            onClick={onAssign}
            className="pointer-events-auto absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap bg-hud-amber px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-hud-bg hover:bg-hud-amber/90"
          >
            + Assign {blocker.role}
          </button>
        </div>
      )}
      {hover && (
        <>
          <div ref={hoverRef} style={hidden} className="absolute left-0 top-0 border border-hud-violet" />
          <div ref={cardRef} style={hidden} data-testid="room-card" className="absolute left-0 top-0 w-[252px] border border-hud-violet bg-hud-bg/95 p-3 text-xs leading-relaxed">
            <div className="flex items-baseline justify-between">
              <p className="text-[10px] uppercase tracking-[0.22em] text-hud-violet">{hover.status.title}</p>
              <p className="text-[10px] text-hud-bone/60">slot {hover.slot}</p>
            </div>
            {hover.status.workers && <p className="text-hud-bone">{hover.status.workers}</p>}
            {hover.status.rate && <p className="text-hud-bone/70">{hover.status.rate}</p>}
            {hover.status.note && <p className="text-hud-bone/60">{hover.status.note}</p>}
            {hover.status.action && <p className="text-hud-violet">{hover.status.action}</p>}
          </div>
        </>
      )}
    </div>
  );
}
