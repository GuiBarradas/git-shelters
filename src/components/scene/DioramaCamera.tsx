"use client";

import { PerspectiveCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import { PerspectiveCamera as Camera, Vector3 } from "three";

type Point = [number, number, number];
/** Low-FOV perspective, fitted to the whole hull, with restrained pointer parallax. */
export function DioramaCamera({ width, height, center, focus, controls = false }: {
  width: number; height: number; center: Point; focus?: Point | null; controls?: boolean;
}) {
  const size = useThree(state => state.size);
  const camera = useRef<Camera>(null);
  const target = useRef(new Vector3());
  const aim = useRef(new Vector3());
  const destination = useRef(new Vector3());
  const reduceMotion = useRef(false);
  const parallax = useRef(false);
  const distance = (w: number, h: number) => Math.max(h, w / (size.width / size.height)) / (2 * Math.tan(28 * Math.PI / 360)) * 1.12;
  const wide = distance(width, height);
  const close = distance(4.8, 3.9);
  const [x, y, z] = center;
  useLayoutEffect(() => {
    if (!camera.current) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => { reduceMotion.current = media.matches; };
    sync(); media.addEventListener("change", sync);
    parallax.current = window.matchMedia("(pointer: fine)").matches;
    target.current.set(x, y, z);
    camera.current.position.set(x + wide * 0.13, y + wide * 0.115, z + wide);
    camera.current.lookAt(target.current);
    return () => media.removeEventListener("change", sync);
  }, [wide, x, y, z]);
  useFrame(({ pointer }, delta) => {
    const cam = camera.current;
    if (!cam || controls) return;
    const zoom = focus ? close : wide;
    aim.current.set(...(focus ?? center));
    const sway = parallax.current && !reduceMotion.current && !focus;
    destination.current.set(aim.current.x + zoom * 0.13 + (sway ? pointer.x * 0.16 : 0), aim.current.y + zoom * 0.115 + (sway ? pointer.y * 0.09 : 0), aim.current.z + zoom);
    const easing = reduceMotion.current ? 1 : 1 - Math.exp(-delta * 8);
    cam.position.lerp(destination.current, easing);
    target.current.lerp(aim.current, easing);
    cam.lookAt(target.current);
  });
  return <PerspectiveCamera ref={camera} makeDefault fov={28} near={0.1} far={250} />;
}
