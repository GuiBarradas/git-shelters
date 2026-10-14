"use client";

import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useImperativeHandle, useLayoutEffect, useRef, type ComponentRef, type Ref } from "react";
import { MOUSE, TOUCH, Vector3 } from "three";

const Y = new Vector3(0, 1, 0);
const offset = new Vector3();

import {
  clampTarget, frameView, HOME_AZIMUTH, HOME_POLAR, MAX_DISTANCE, MAX_POLAR, MIN_DISTANCE, MIN_POLAR, orbitOffset, OWN_DISTANCE, type Vec3,
} from "./framing";

export type MapRigHandle = { reset: () => void; findMe: () => void };
type Controls = ComponentRef<typeof OrbitControls>;

const IDLE_MS = 4000;

/** Keys typed into a field, or chorded with a modifier, belong to someone else. */
function ignoredKey(e: KeyboardEvent): boolean {
  if (e.ctrlKey || e.altKey || e.metaKey) return true;
  const el = e.target as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

/**
 * The diorama camera over the 404 Lands: drag pans the ground, right
 * button or Shift+drag orbits, wheel or pinch zooms. R goes home, F flies
 * to the visitor's own Repo. After {@link IDLE_MS} untouched the azimuth
 * sways a few degrees either way (never a full orbit), unless the visitor
 * turned drift off or prefers reduced motion, which also makes every
 * flight a cut.
 */
export function MapCameraRig({ ref, own, drift, reducedMotion }: {
  ref?: Ref<MapRigHandle>;
  /** The visitor's bunker on the plateau top, or null. */
  own: Vec3 | null;
  drift: boolean;
  reducedMotion: boolean;
}) {
  const controls = useRef<Controls>(null);
  const size = useThree((s) => s.size);
  const portrait = size.width < size.height;
  const goal = useRef<{ target: Vector3; position: Vector3 } | null>(null);
  const idleSince = useRef(0);
  const sway = useRef(0);
  const motion = useRef({ reducedMotion, drift });
  useEffect(() => { motion.current = { reducedMotion, drift }; }, [reducedMotion, drift]);

  const flyTo = (target: Vec3, distance: number, azimuth: number, instant = false) => {
    const c = controls.current;
    if (!c) return;
    const t = new Vector3(...target);
    const p = t.clone().add(new Vector3(...orbitOffset(distance, HOME_POLAR, azimuth)));
    idleSince.current = performance.now();
    if (instant || motion.current.reducedMotion) {
      goal.current = null;
      c.target.copy(t);
      c.object.position.copy(p);
      c.update();
    } else {
      goal.current = { target: t, position: p };
    }
  };
  const home = (instant = false) => {
    const view = frameView(size.width / Math.max(1, size.height));
    flyTo(view.target, view.distance, HOME_AZIMUTH, instant);
  };
  const findMe = () => {
    if (own) flyTo(own, OWN_DISTANCE, controls.current?.getAzimuthalAngle() ?? 0);
  };

  useImperativeHandle(ref, () => ({ reset: () => home(), findMe }));

  // Frame on mount and whenever the screen turns; a resize within one orientation keeps the view.
  useLayoutEffect(() => {
    home(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portrait]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (ignoredKey(e)) return;
      const key = e.key.toLowerCase();
      if (key === "r") home();
      else if (key === "f" && own) findMe();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useFrame((_, delta) => {
    const c = controls.current;
    if (!c) return;
    const g = goal.current;
    if (g) {
      const k = 1 - Math.exp(-delta * 4);
      c.target.lerp(g.target, k);
      c.object.position.lerp(g.position, k);
      if (c.object.position.distanceToSquared(g.position) < 0.01) {
        c.target.copy(g.target);
        c.object.position.copy(g.position);
        goal.current = null;
      }
    }
    const m = motion.current;
    if (m.drift && !m.reducedMotion && !g && performance.now() - idleSince.current > IDLE_MS) {
      // Turn by the change of 0.1·sin(0.06t): a slow sway around where the visitor left it.
      const next = Math.sin((sway.current + delta) * 0.06) * 0.1;
      const turn = next - Math.sin(sway.current * 0.06) * 0.1;
      sway.current += delta;
      c.object.position.sub(c.target);
      offset.copy(c.object.position).applyAxisAngle(Y, turn);
      c.object.position.copy(offset).add(c.target);
    } else {
      sway.current = 0;
    }
    // Keep the target over the table; move the camera with it so the angle holds.
    const [x, z] = clampTarget(c.target.x, c.target.z);
    if (x !== c.target.x || z !== c.target.z) {
      c.object.position.x += x - c.target.x;
      c.object.position.z += z - c.target.z;
      c.target.x = x;
      c.target.z = z;
    }
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      screenSpacePanning={false}
      minDistance={MIN_DISTANCE}
      maxDistance={MAX_DISTANCE}
      minPolarAngle={MIN_POLAR}
      maxPolarAngle={MAX_POLAR}
      // Left drags the ground; three already turns Shift/Ctrl+left into an orbit.
      mouseButtons={{ LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE }}
      touches={{ ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_PAN }}
      onStart={() => { goal.current = null; idleSince.current = performance.now(); }}
      onEnd={() => { idleSince.current = performance.now(); }}
    />
  );
}
