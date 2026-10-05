import { expect, it, vi } from "vitest";
import { BoxGeometry, Group, Mesh, MeshToonMaterial, Raycaster, Vector3 } from "three";
import { batch, LIVE } from "@/components/scene/rooms/Details";

it("batches colours within each moving pivot and restores raycastable originals on cleanup", () => {
  const root = new Group();
  const pivot = new Group();
  pivot.userData = LIVE;
  pivot.position.x = 4;
  root.add(pivot);
  const geometry = new BoxGeometry();
  const red = new MeshToonMaterial({ color: "red" });
  const blue = new MeshToonMaterial({ color: "blue" });
  const originals = [root, pivot].flatMap(parent => [red, blue].map((material, i) => {
    const mesh = new Mesh(geometry, material);
    mesh.position.x = i * 2;
    parent.add(mesh);
    return mesh;
  }));
  const animated = new Mesh(geometry, red);
  animated.userData = LIVE;
  root.add(animated);
  const cleanup = batch(root);
  const merged = [root, pivot].map(parent => parent.children.find(child =>
    child instanceof Mesh && child !== animated && !originals.includes(child)) as Mesh);
  expect(originals.every(mesh => !mesh.visible)).toBe(true);
  expect(animated.visible).toBe(true);
  for (const mesh of merged) {
    const colors = mesh.geometry.getAttribute("color");
    expect([colors.getX(0), colors.getY(0), colors.getZ(0)]).toEqual([1, 0, 0]);
    expect([colors.getX(colors.count - 1), colors.getY(colors.count - 1), colors.getZ(colors.count - 1)]).toEqual([0, 0, 1]);
    mesh.geometry.computeBoundingBox();
    expect(mesh.geometry.boundingBox!.max.x).toBe(2.5);
  }
  expect(merged[1]!.parent).toBe(pivot);
  pivot.position.x = 7;
  root.updateMatrixWorld(true);
  expect(merged[1]!.getWorldPosition(new Vector3()).x).toBe(7);
  expect(new Raycaster(new Vector3(0, 0, 5), new Vector3(0, 0, -1)).intersectObject(originals[0]!).length).toBeGreaterThan(0);
  const disposals = merged.map(mesh => vi.spyOn(mesh.geometry, "dispose"));
  const sharedDisposal = vi.spyOn(geometry, "dispose");
  cleanup();
  expect(originals.every(mesh => mesh.visible)).toBe(true);
  expect(merged.every(mesh => mesh.parent === null)).toBe(true);
  disposals.forEach(dispose => expect(dispose).toHaveBeenCalledOnce());
  expect(sharedDisposal).not.toHaveBeenCalled();
  geometry.dispose(); red.dispose(); blue.dispose();
});
