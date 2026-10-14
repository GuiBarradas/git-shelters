import { ExtrudeGeometry, Shape, Vector2 } from "three";

import type { Region } from "@/lib/regions/catalog";
import { regionHeight, toWorld } from "@/lib/regions/look";

/**
 * A region's plateau. The shape is drawn in the XY plane as (x, -z) and
 * extruded along +Z by the height; rotateX(-PI/2) then stands it up, so
 * the extrusion becomes +Y and -(-z) is the original world z again.
 * Groups: 0 = caps (top), 1 = walls (side).
 */
export function plateauGeometry(region: Region): ExtrudeGeometry {
  const shape = new Shape(region.shape.map((p) => {
    const [x, z] = toWorld(p);
    return new Vector2(x, -z);
  }));
  const geometry = new ExtrudeGeometry(shape, { depth: regionHeight(region.id), bevelEnabled: false });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}
