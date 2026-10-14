"use client";

import { PerspectiveCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef } from "react";
import { PerspectiveCamera as Camera, Vector3 } from "three";

type Point = [number, number, number];
/** Screen pixels the HUD covers at the top and bottom; the diorama fits between them. */
export type HudInset = { top: number; bottom: number };

const FOV = 28;
const NO_INSET: HudInset = { top: 0, bottom: 0 };

/**
 * Camera distance that fits a w×h world box inside the free band of a
 * W×H canvas: full width, and the height left between the HUD insets.
 */
export function fitDistance(w: number, h: number, W: number, H: number, inset: HudInset = NO_INSET): number {
  const usable = Math.max(1, H - inset.top - inset.bottom);
  return Math.max(h * (H / usable), w / (W / H)) / (2 * Math.tan(FOV * Math.PI / 360)) * 1.12;
}

/**
 * setViewOffset y that moves the look-at point from the canvas centre to
 * the centre of the free band, (top + H - bottom) / 2. A positive offset
 * slides the view window down, so the picture moves up.
 */
export function viewOffsetY(inset: HudInset): number {
  return (inset.bottom - inset.top) / 2;
}

/** Low-FOV perspective, fitted to the whole hull, with restrained pointer parallax. */
export function DioramaCamera({ width, height, center, focus, controls = false, inset = NO_INSET }: {
  width: number; height: number; center: Point; focus?: Point | null; controls?: boolean; inset?: HudInset;
}) {
  const size = useThree(state => state.size);
  const camera = useRef<Camera>(null);
  const target = useRef(new Vector3());
  const aim = useRef(new Vector3());
  const destination = useRef(new Vector3());
  const reduceMotion = useRef(false);
  const parallax = useRef(false);
  const placed = useRef(false);
  /** The view offset actually applied, eased toward the inset's. */
  const offset = useRef({ y: 0, W: 0, H: 0 });
  const wide = fitDistance(width, height, size.width, size.height, inset);
  const close = fitDistance(4.8, 3.9, size.width, size.height, inset);
  const [x, y, z] = center;
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => { reduceMotion.current = media.matches; };
    sync(); media.addEventListener("change", sync);
    parallax.current = window.matchMedia("(pointer: fine)").matches;
    return () => media.removeEventListener("change", sync);
  }, []);
  // Place once. Later changes to size, inset or centre ease in through
  // useFrame, so a resize or a new HUD band never snaps a room close-up
  // back to the overview.
  useLayoutEffect(() => {
    if (!camera.current || placed.current) return;
    placed.current = true;
    target.current.set(x, y, z);
    camera.current.position.set(x + wide * 0.13, y + wide * 0.115, z + wide);
    camera.current.lookAt(target.current);
  }, [wide, x, y, z]);
  useFrame(({ pointer }, delta) => {
    const cam = camera.current;
    if (!cam) return;
    const easing = reduceMotion.current ? 1 : 1 - Math.exp(-delta * 8);

    const goal = viewOffsetY(inset);
    const o = offset.current;
    if (o.y !== goal || o.W !== size.width || o.H !== size.height) {
      o.y = Math.abs(goal - o.y) < 0.5 ? goal : o.y + (goal - o.y) * easing;
      o.W = size.width;
      o.H = size.height;
      if (o.y === 0) cam.clearViewOffset();
      else cam.setViewOffset(size.width, size.height, 0, o.y, size.width, size.height);
    }

    if (controls) return;
    const zoom = focus ? close : wide;
    aim.current.set(...(focus ?? center));
    const sway = parallax.current && !reduceMotion.current && !focus;
    destination.current.set(aim.current.x + zoom * 0.13 + (sway ? pointer.x * 0.16 : 0), aim.current.y + zoom * 0.115 + (sway ? pointer.y * 0.09 : 0), aim.current.z + zoom);
    cam.position.lerp(destination.current, easing);
    target.current.lerp(aim.current, easing);
    cam.lookAt(target.current);
  });
  return <PerspectiveCamera ref={camera} makeDefault fov={FOV} near={0.1} far={250} />;
}
