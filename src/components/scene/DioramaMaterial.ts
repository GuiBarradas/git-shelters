import { extend, type ThreeElement } from "@react-three/fiber";
import { Color, MeshStandardMaterial, type WebGLProgramParametersWithUniforms } from "three";

/** Two local diffuse sources, constant cost regardless of how many rooms are visible.
 * This is approximate lighting, not baked occlusion; contact shadows are separate. */
export class DioramaMaterial extends MeshStandardMaterial {
  private powerUniform = { value: 1 };
  private concreteUniform = { value: 0 };
  private wearUniform = { value: 0.5 };
  private warmUniform = { value: new Color("#ffb570") };
  private coolUniform = { value: new Color("#bd93f9") };
  get wear() { return this.wearUniform.value; }
  set wear(value: number) { this.wearUniform.value = value; this.userData.wear = value; }
  get warmTint() { return `#${this.warmUniform.value.getHexString()}`; }
  set warmTint(value: string) { this.warmUniform.value.set(value); this.userData.warmTint = value; }
  get coolTint() { return `#${this.coolUniform.value.getHexString()}`; }
  set coolTint(value: string) { this.coolUniform.value.set(value); this.userData.coolTint = value; }
  private simpleValue = false;
  constructor() { super({ roughness: 0.86, metalness: 0 }); }
  get power() { return this.powerUniform.value; }
  set power(value: number) { this.powerUniform.value = value; this.userData.power = value; }
  get concrete() { return this.concreteUniform.value; }
  set concrete(value: number) { this.concreteUniform.value = value; this.userData.concrete = value; }
  get simpleLighting() { return this.simpleValue; }
  set simpleLighting(value: boolean) { if (value !== this.simpleValue) { this.simpleValue = value; this.needsUpdate = true; } }
  override copy(source: this) {
    super.copy(source);
    this.power = source.power; this.concrete = source.concrete;
    this.wear = source.wear; this.warmTint = source.warmTint; this.coolTint = source.coolTint;
    this.simpleLighting = source.simpleLighting;
    return this;
  }
  override customProgramCacheKey() { return `shelter-local-light-v3-${this.simpleLighting}`; }
  override onBeforeCompile(shader: WebGLProgramParametersWithUniforms) {
    shader.uniforms.shelterPower = this.powerUniform;
    shader.uniforms.shelterConcrete = this.concreteUniform;
    shader.uniforms.shelterWear = this.wearUniform;
    shader.uniforms.shelterWarm = this.warmUniform;
    shader.uniforms.shelterCool = this.coolUniform;
    shader.vertexShader = `varying vec3 shelterPosition; varying vec3 shelterLocalLight; varying vec3 shelterFill;
      uniform vec3 shelterWarm; uniform vec3 shelterCool;
      vec3 shelterLamp(vec3 p, vec3 n, vec3 source, vec3 tint, float intensity) {
        vec3 d = source - p;
        return tint * intensity * (0.14 + max(0.0, dot(n, normalize(d)))) / (1.0 + dot(d,d) * 1.65);
      }
      ${shader.vertexShader}`
      .replace("#include <project_vertex>", `#include <project_vertex>
        vec4 shelterVertex = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          shelterVertex = instanceMatrix * shelterVertex;
        #endif
        shelterPosition = (modelMatrix * shelterVertex).xyz;
        shelterPosition.x = mod(shelterPosition.x + 2.275, 4.55) - 2.275;
        shelterPosition.y = mod(shelterPosition.y + 0.5, 4.0) - 0.5;
        vec3 shelterNormal = inverseTransformDirection(transformedNormal, viewMatrix);
        shelterLocalLight = shelterLamp(shelterPosition,shelterNormal,vec3(0.15,2.55,-0.35),shelterWarm,2.8);
        shelterLocalLight += shelterLamp(shelterPosition,shelterNormal,vec3(0.65,1.18,-0.15),shelterCool,0.48);
        shelterFill = vec3(0.12,0.09,0.16) + vec3(0.42,0.34,0.28) * max(0.0,dot(shelterNormal,normalize(vec3(-0.3,0.8,1.0))));`);
    // Low overview keeps the same diffuse light direction without the PBR BRDF.
    // Close-ups retain physical prop lights and the full Standard response.
    if (this.simpleLighting) shader.fragmentShader = shader.fragmentShader.replace(
      "vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;",
      "vec3 outgoingLight = diffuseColor.rgb * shelterFill * mix(0.25,1.0,shelterPower) + totalEmissiveRadiance;",
    );
    shader.fragmentShader = `varying vec3 shelterPosition; varying vec3 shelterLocalLight; varying vec3 shelterFill;
      uniform float shelterPower; uniform float shelterConcrete; uniform float shelterWear;
      float shelterNoise(vec3 p) { return fract(sin(dot(floor(p), vec3(127.1,311.7,74.7))) * 43758.5453); }
      ${shader.fragmentShader}`.replace("#include <opaque_fragment>", `
        vec3 p = shelterPosition;
        float corner = smoothstep(0.0,0.32,min(2.02-abs(p.x),p.z+1.32));
        float contact = mix(0.65,1.0,corner);
        outgoingLight = (outgoingLight + diffuseColor.rgb * shelterLocalLight * shelterPower) * contact;
        if (shelterConcrete > 0.5) {
          float wear = mix(0.97,1.03,shelterNoise(p * 24.0));
          float patches = mix(0.95,1.03,shelterNoise(p * 3.0));
          outgoingLight *= mix(1.0, wear * patches, 0.3 + shelterWear * 0.7);
        }
        #include <opaque_fragment>`);
  }
}

extend({ DioramaMaterial });
declare module "@react-three/fiber" {
  interface ThreeElements { dioramaMaterial: ThreeElement<typeof DioramaMaterial> }
}
