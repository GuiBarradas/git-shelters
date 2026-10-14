"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, type RefObject } from "react";
import { Vector3 } from "three";

import type { MapBunker } from "./bunker";
import type { Vec3 } from "./framing";

/** How close, in CSS pixels, the pointer must be to a hatch to pick it. */
export const PICK_RADIUS = 22;
/** More movement than this between press and release is a drag, not a tap. */
const TAP_SLOP = 6;

const v = new Vector3();

/**
 * Picks the bunker nearest the pointer in screen space (no raycast: the
 * hatches are too small to hit). Mouse: hover shows the tooltip, a click
 * opens the profile. Touch: a tap pins the tooltip, whose link opens it.
 * {@link hot} tells the plateaus underneath that the bunker took the click.
 */
export function BunkerPicker({ bunkers, hot, onHover, onOpen, onPin }: {
  bunkers: readonly MapBunker[];
  hot: RefObject<MapBunker | null>;
  onHover: (b: MapBunker | null) => void;
  onOpen: (b: MapBunker) => void;
  onPin: (b: MapBunker | null) => void;
}) {
  const gl = useThree((s) => s.gl);
  const get = useThree((s) => s.get);

  useEffect(() => {
    const el = gl.domElement;
    const nearest = (e: PointerEvent): MapBunker | null => {
      const rect = el.getBoundingClientRect();
      const [mx, my] = [e.clientX - rect.left, e.clientY - rect.top];
      const { camera: cam, size: sz } = get();
      let best: MapBunker | null = null;
      let bestD = PICK_RADIUS;
      for (const b of bunkers) {
        v.set(b.at[0], b.at[1] + 0.5, b.at[2]).project(cam);
        if (v.z >= 1) continue;
        const d = Math.hypot(((v.x + 1) / 2) * sz.width - mx, ((1 - v.y) / 2) * sz.height - my);
        if (d < bestD) { bestD = d; best = b; }
      }
      return best;
    };
    let down: [number, number] | null = null;
    const set = (b: MapBunker | null) => {
      if (hot.current === b) return;
      hot.current = b;
      onHover(b);
      el.style.cursor = b ? "pointer" : "";
    };
    const move = (e: PointerEvent) => { if (e.pointerType === "mouse" && !e.buttons) set(nearest(e)); };
    const press = (e: PointerEvent) => { down = [e.clientX, e.clientY]; };
    const release = (e: PointerEvent) => {
      const tap = down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < TAP_SLOP;
      down = null;
      if (!tap) return;
      const b = nearest(e);
      hot.current = b;
      if (e.pointerType === "mouse") { if (b) onOpen(b); }
      else onPin(b);
    };
    const leave = () => set(null);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerdown", press);
    el.addEventListener("pointerup", release);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerdown", press);
      el.removeEventListener("pointerup", release);
      el.removeEventListener("pointerleave", leave);
      el.style.cursor = "";
    };
  }, [gl, get, bunkers, hot, onHover, onOpen, onPin]);
  return null;
}

/**
 * Keeps a DOM element over a world point every frame, without React state;
 * hidden behind the camera, or further away than {@link within}.
 */
export function ScreenAnchor({ at, el, within = Infinity }: { at: Vec3 | null; el: RefObject<HTMLElement | null>; within?: number }) {
  useFrame(({ camera, size }) => {
    const node = el.current;
    if (!node) return;
    if (!at) { node.style.setProperty("visibility", "hidden"); return; }
    const near = camera.position.distanceTo(v.set(...at)) <= within;
    v.project(camera);
    node.style.setProperty("visibility", near && v.z < 1 ? "visible" : "hidden");
    node.style.setProperty("transform", `translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px)`);
  });
  return null;
}
