import { extend, type ThreeElement } from "@react-three/fiber";
import { MeshStandardMaterial, type WebGLProgramParametersWithUniforms } from "three";

/** Two local diffuse sources, constant cost regardless of how many rooms are visible.
 * This is approximate lighting, not baked occlusion; contact shadows are separate. */
export class DioramaMaterial extends MeshStandardMaterial {
  private powerUniform = { value: 1 };
  private concreteUniform = { value: 0 };
  constructor() { super({ roughness: 0.86, metalness: 0 }); }
  get power() { return this.powerUniform.value; }
  set power(value: number) { this.powerUniform.value = value; this.userData.power = value; }
  get concrete() { return this.concreteUniform.value; }
  set concrete(value: number) { this.concreteUniform.value = value; this.userData.concrete = value; }
  override copy(source: this) {
    super.copy(source);
    this.power = source.power; this.concrete = source.concrete;
    return this;
  }
  override customProgramCacheKey() { return "shelter-local-light-v1"; }
  override onBeforeCompile(shader: WebGLProgramParametersWithUniforms) {
    shader.uniforms.shelterPower = this.powerUniform;
    shader.uniforms.shelterConcrete = this.concreteUniform;
    shader.vertexShader = `varying vec3 shelterPosition; varying vec3 shelterNormal;\n${shader.vertexShader}`
      .replace("#include <project_vertex>", `#include <project_vertex>
        vec4 shelterVertex = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          shelterVertex = instanceMatrix * shelterVertex;
        #endif
        shelterPosition = (modelMatrix * shelterVertex).xyz;
        shelterNormal = inverseTransformDirection(transformedNormal, viewMatrix);`);
    shader.fragmentShader = `varying vec3 shelterPosition; varying vec3 shelterNormal;
      uniform float shelterPower; uniform float shelterConcrete;
      float shelterNoise(vec3 p) { return fract(sin(dot(floor(p), vec3(127.1,311.7,74.7))) * 43758.5453); }
      vec3 shelterLamp(vec3 p, vec3 n, vec3 source, vec3 tint, float intensity) {
        vec3 d = source - p;
        return tint * intensity * (0.14 + max(0.0, dot(n, normalize(d)))) / (1.0 + dot(d,d) * 1.65);
      }
      ${shader.fragmentShader}`.replace("#include <opaque_fragment>", `
        vec3 p = shelterPosition;
        p.x = mod(p.x + 2.275, 4.55) - 2.275;
        p.y = mod(p.y + 0.25, 4.0) - 0.25;
        vec3 n = normalize(shelterNormal);
        vec3 localLight = shelterLamp(p,n,vec3(0.15,2.55,-0.35),vec3(1.0,0.46,0.19),2.8);
        localLight += shelterLamp(p,n,vec3(0.65,1.18,-0.15),vec3(0.48,0.24,1.0),0.48);
        float corner = smoothstep(0.0,0.32,min(2.02-abs(p.x),p.z+1.32));
        float contact = mix(0.65,1.0,corner);
        outgoingLight = (outgoingLight + diffuseColor.rgb * localLight * shelterPower) * contact;
        float wear = mix(0.87,1.08,shelterNoise(p * 32.0));
        float patches = mix(0.86,1.04,shelterNoise(p * 5.0));
        outgoingLight *= mix(1.0,wear * patches,shelterConcrete);
        #include <opaque_fragment>`);
  }
}

extend({ DioramaMaterial });
declare module "@react-three/fiber" {
  interface ThreeElements { dioramaMaterial: ThreeElement<typeof DioramaMaterial> }
}
