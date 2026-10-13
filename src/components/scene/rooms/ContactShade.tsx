import { CircleGeometry, Float32BufferAttribute } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const disk = new CircleGeometry(1, 20);
disk.setAttribute("color", new Float32BufferAttribute(Array.from({ length: 22 }, (_, i) => [0.025,0.014,0.035,i === 0 ? 0.65 : 0]).flat(),4));
const parts = ([[-1.35,0.75,0.6],[0.5,1.0,0.65],[1.45,0.45,0.45]] as [number,number,number][]).map(([x,sx,sy]) => disk.clone().scale(sx,sy,1).rotateX(-Math.PI/2).translate(x,0.025,-0.3));
const roomShade = mergeGeometries(parts);
parts.forEach(part => part.dispose());
export function ContactShade({ room = false }: { room?: boolean }) {
  return <mesh geometry={room ? roomShade : disk} dispose={null} rotation={room ? [0,0,0] : [-Math.PI/2,0,0]} scale={room ? 1 : [0.4,0.25,1]}>
    <meshBasicMaterial vertexColors transparent depthWrite={false} toneMapped={false} />
  </mesh>;
}
