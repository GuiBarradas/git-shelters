import { expect, it, vi } from "vitest";
import {
  AdditiveBlending, BoxGeometry, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, MeshToonMaterial, Raycaster,
  SphereGeometry, Vector3, type Object3D,
} from "three";
import { instanceMeshes } from "@/components/scene/SceneInstances";
import { DioramaMaterial } from "@/components/scene/DioramaMaterial";
import { LIVE } from "@/components/scene/rooms/Details";

const add = (parent: Object3D, mesh: Mesh, x = 0) => { mesh.position.x = x; parent.add(mesh); return mesh; };
const batches = (root: Object3D) => root.children.filter((child): child is InstancedMesh => child instanceof InstancedMesh);
const translations = (mesh: InstancedMesh) => Array.from({ length: mesh.count }, (_, i) => {
  const matrix = new Matrix4();
  mesh.getMatrixAt(i, matrix);
  return new Vector3().setFromMatrixPosition(matrix).x;
});
const colors = (mesh: InstancedMesh) => Array.from({ length: mesh.count }, (_, i) =>
  Array.from(mesh.instanceColor!.array.slice(i * 3, i * 3 + 3)));

it("instances twin shapes across moving pivots with per-instance HDR colour and restores originals", () => {
  const root = new Group();
  const pivot = new Group();
  pivot.userData = LIVE;
  pivot.position.x = 4;
  root.add(pivot);
  const boxA = new BoxGeometry();
  const boxB = new BoxGeometry(); // same shape, different uuid
  const red = new MeshToonMaterial({ color: "red" });
  const hdr = new MeshToonMaterial();
  hdr.color.setRGB(2, 0.5, 0);
  const originals = [add(root, new Mesh(boxA, red)), add(pivot, new Mesh(boxB, hdr), 2), add(pivot, new Mesh(boxA, red), -2)];
  const live = add(root, new Mesh(boxA, red));
  live.userData = LIVE;
  const glass = add(root, new Mesh(boxB, new MeshToonMaterial({ transparent: true, opacity: 0.5 })));
  const lone = add(root, new Mesh(new SphereGeometry(), red), 9);

  const instances = instanceMeshes(root);
  const [batch, ...rest] = batches(root);
  expect(rest).toHaveLength(0);
  expect(batch!.count).toBe(3);
  expect([boxA, boxB]).toContain(batch!.geometry); // shared, not cloned
  const tint = batch!.material as MeshToonMaterial;
  expect(tint).not.toBe(red);
  expect(tint.color.toArray()).toEqual([1, 1, 1]);
  expect(red.color.toArray()).toEqual([1, 0, 0]);
  expect(colors(batch!)).toEqual(expect.arrayContaining([[1, 0, 0], [2, 0.5, 0]]));
  expect(originals.every((mesh) => !mesh.visible)).toBe(true);
  expect([live, glass, lone].every((mesh) => mesh.visible)).toBe(true);
  expect(translations(batch!).sort()).toEqual([0, 2, 6]);

  // useFrame moves the pivot and recolours a material; the next render follows both.
  pivot.position.x = 7;
  hdr.color.setRGB(0, 0, 3);
  root.updateMatrixWorld(true);
  expect(instances.update()).toBe(true);
  expect(translations(batch!).sort()).toEqual([0, 5, 9]);
  expect(colors(batch!)).toContainEqual([0, 0, 3]);

  // Clicks land on the hidden originals, never on the instances.
  const hits = new Raycaster(new Vector3(0, 0, 5), new Vector3(0, 0, -1)).intersectObject(root, true).map((hit) => hit.object);
  expect(hits).toContain(originals[0]);
  expect(hits.some((object) => object instanceof InstancedMesh)).toBe(false);

  const sharedDisposals = [boxA, boxB, red, hdr].map((owned) => vi.spyOn(owned, "dispose"));
  const tintDisposal = vi.spyOn(tint, "dispose");
  instances.dispose();
  expect(batch!.parent).toBeNull();
  expect(originals.every((mesh) => mesh.visible)).toBe(true);
  expect(tintDisposal).toHaveBeenCalledOnce();
  sharedDisposals.forEach((dispose) => expect(dispose).not.toHaveBeenCalled());
});

it("shares one material, keeps distinct vertex colours apart and asks for a rebuild on unmount", () => {
  const root = new Group();
  const room = new Group();
  root.add(room);
  const painted = (shade: number) => {
    const geometry = new BoxGeometry();
    geometry.setAttribute("color", new Float32BufferAttribute(new Array(geometry.getAttribute("position").count * 3).fill(shade), 3));
    return geometry;
  };
  const material = new MeshToonMaterial({ vertexColors: true });
  const [dark, twin, light] = [painted(0.2), painted(0.2), painted(0.8)].map((geometry, i) => add(room, new Mesh(geometry, material), i));

  const instances = instanceMeshes(root);
  const [batch, ...rest] = batches(root);
  expect(rest).toHaveLength(0);
  expect(batch!.count).toBe(2);
  expect(batch!.material).toBe(material);
  expect(batch!.instanceColor).toBeNull();
  expect([dark!.visible, twin!.visible, light!.visible]).toEqual([false, false, true]);

  room.visible = false;
  expect(instances.update()).toBe(true);
  expect(translations(batch!)).toEqual([0, 0]);
  expect([...batch!.instanceMatrix.array.slice(0, 16)]).toEqual([0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,1]);

  twin!.removeFromParent();
  expect(instances.update()).toBe(false);
  instances.dispose();
  expect(twin!.visible).toBe(true);
});

it("ignores R3F instance metadata on materials", () => {
  const root = new Group();
  const geometry = new BoxGeometry();
  const meshes = ["#8a6", "#468"].map((color, x) => {
    const mesh = add(root, new Mesh(geometry, new MeshToonMaterial({ color })), x);
    // Shape of R3F's own `__r3f`: per-element props and a link back to the parent mesh.
    Object.assign(mesh.material, { __r3f: { type: "meshToonMaterial", props: { color }, parent: { props: { position: [x, 0, 0] }, object: mesh } } });
    return mesh;
  });

  const instances = instanceMeshes(root);
  expect(batches(root).map((mesh) => mesh.count)).toEqual([2]);
  // Hiding the originals or a React commit swapping props must not look like a material edit.
  (meshes[0]!.material as unknown as { __r3f: { props: object } }).__r3f.props = { color: "#8a6" };
  expect(instances.update()).toBe(true);
  instances.dispose();
});

it("never merges custom-shader materials once their uniforms drift", () => {
  const root = new Group();
  const geometry = new BoxGeometry();
  const [left, right] = ["#8a6", "#468"].map((color) => {
    const material = new DioramaMaterial();
    material.color.set(color);
    return material;
  }) as [DioramaMaterial, DioramaMaterial];
  add(root, new Mesh(geometry, left));
  add(root, new Mesh(geometry, right), 1);
  const dim = new DioramaMaterial();
  dim.power = 0.06;
  add(root, new Mesh(geometry, dim), 2);

  const instances = instanceMeshes(root);
  const [batch, ...rest] = batches(root);
  expect(rest).toHaveLength(0);
  expect(batch!.count).toBe(2);
  expect((batch!.material as DioramaMaterial).customProgramCacheKey()).toBe("shelter-local-light-v1");
  expect((batch!.material as DioramaMaterial).power).toBe(1);

  left.power = 0.06; // a room loses power in place: the batch must rebuild
  expect(instances.update()).toBe(false);
  instances.dispose();
  const rebuilt = instanceMeshes(root);
  expect(batches(root).map((mesh) => (mesh.material as DioramaMaterial).power)).toEqual([0.06]); // left now twins dim
  rebuilt.dispose();
});


it("instances only additive lights and explicitly ordered contact shadows among transparent meshes", () => {
  const root = new Group();
  const material = new MeshToonMaterial({ transparent: true, depthWrite: false });
  const geometry = new BoxGeometry();
  const meshes = Array.from({ length: 6 }, (_, i) => add(root, new Mesh(geometry, material.clone()), i));
  for (const mesh of meshes.slice(0, 2)) { mesh.userData.contactShade = true; mesh.renderOrder = 1; }
  for (const mesh of meshes.slice(2, 4)) { (mesh.material as MeshToonMaterial).blending = AdditiveBlending; mesh.renderOrder = 2; }
  const instances = instanceMeshes(root);
  expect(batches(root).map(mesh => [mesh.count, mesh.renderOrder])).toEqual([[2,1],[2,2]]);
  expect(meshes.slice(4).every(mesh => mesh.visible)).toBe(true);
  instances.dispose();
  expect(meshes.every(mesh => mesh.visible)).toBe(true);
});
