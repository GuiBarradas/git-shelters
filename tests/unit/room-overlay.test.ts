import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";

import { fitDistance, viewOffsetY, type HudInset } from "@/components/scene/DioramaCamera";
import { placeCard, projectRect, type Rect } from "@/components/scene/RoomOverlay";
import { CELL } from "@/components/scene/rooms";

const W = 1440, H = 900;
const inset: HudInset = { top: 56, bottom: 152 };

/** A camera straight down -z at `distance`, with the HUD view offset applied the way DioramaCamera does. */
function camera(distance: number, hud: HudInset) {
  const cam = new PerspectiveCamera(28, W / H, 0.1, 250);
  cam.position.set(0, 0, distance);
  cam.lookAt(0, 0, 0);
  cam.setViewOffset(W, H, 0, viewOffsetY(hud), W, H);
  cam.updateMatrixWorld();
  return cam;
}
const toPx = (cam: PerspectiveCamera, x: number, y: number) => {
  const v = new Vector3(x, y, 0).project(cam);
  return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H };
};

describe("HUD camera reserve", () => {
  it("aligns CSS3D panels with the off-centre WebGL projection at every zoom", () => {
    for (const hud of [{ top: 56, bottom: 0 }, { top: 100, bottom: 0 }, { top: 152, bottom: 0 }, inset]) {
      for (const distance of [6, 12, 20]) {
        const webgl = camera(distance, hud);
        // Drei Html transform uses a centred perspective, without view.offsetY.
        const css3d = camera(distance, { top: 0, bottom: 0 });
        for (const y of [-1, 0, 1]) {
          expect(toPx(css3d, 0, y).y - viewOffsetY(hud)).toBeCloseTo(toPx(webgl, 0, y).y, 5);
        }
      }
    }
  });
  it("puts the look-at point in the middle of the free band", () => {
    for (const hud of [inset, { top: 100, bottom: 152 }, { top: 56, bottom: 0 }]) {
      const centre = toPx(camera(20, hud), 0, 0);
      expect(centre.y).toBeCloseTo((hud.top + H - hud.bottom) / 2, 3);
      expect(centre.x).toBeCloseTo(W / 2, 3);
    }
  });

  it("fits the whole box in the width and in the height left between the bars", () => {
    const [w, h] = [24, 9.5];
    const cam = camera(fitDistance(w, h, W, H, inset), inset);
    const tl = toPx(cam, -w / 2, h / 2), br = toPx(cam, w / 2, -h / 2);
    expect(tl.x).toBeGreaterThanOrEqual(0);
    expect(br.x).toBeLessThanOrEqual(W);
    expect(tl.y).toBeGreaterThanOrEqual(inset.top);
    expect(br.y).toBeLessThanOrEqual(H - inset.bottom);
    // Without the reserve the same box would only need the plain fit.
    expect(fitDistance(w, h, W, H, inset)).toBeGreaterThanOrEqual(fitDistance(w, h, W, H));
  });
});

describe("room overlay projection", () => {
  it("projects a cell's front face to a rect around its screen position", () => {
    const cam = camera(20, inset);
    const out: Rect = { left: 0, top: 0, right: 0, bottom: 0 };
    const r = projectRect(-CELL.w / 2, 0, cam, W, H, out);
    expect(r).toBe(out);
    const bottomMid = toPx(cam, 0, 0);
    expect((r.left + r.right) / 2).toBeCloseTo(W / 2, 0);
    // The floor edge sits on the view axis, so it lands on the band's centre whatever its depth.
    expect(r.bottom).toBeCloseTo(bottomMid.y, 3);
    expect(r.top).toBeLessThan(r.bottom);
    expect(r.right - r.left).toBeGreaterThan(0);
  });

  it("puts the card under the room, flips it above near the bottom band, and clamps it in the band", () => {
    const cardH = 110;
    expect(placeCard({ left: 300, top: 200, right: 500, bottom: 400 }, cardH, W, H, inset)).toEqual({ x: 300, y: 408 });
    expect(placeCard({ left: 300, top: 400, right: 500, bottom: 700 }, cardH, W, H, inset)).toEqual({ x: 300, y: 400 - 8 - cardH });
    const squeezed = placeCard({ left: 1400, top: 60, right: 1440, bottom: 700 }, cardH, W, H, inset);
    expect(squeezed.y).toBe(inset.top + 8);
    expect(squeezed.x).toBe(W - 252 - 8);
  });
});
