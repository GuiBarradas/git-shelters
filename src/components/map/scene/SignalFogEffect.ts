import { BlendFunction, Effect, EffectAttribute, KawaseBlurPass, KernelSize } from "postprocessing";
import {
  Color, type Camera, DataTexture, DepthTexture, FloatType, HalfFloatType, LinearFilter, Matrix4, RedFormat, RepeatWrapping,
  type Scene, Uniform, type WebGLRenderer, WebGLRenderTarget,
} from "three";

import { MASK_H, MASK_W } from "./fogMask";

/** Objects on this layer skip the fog: drawn after it, depth-tested against the terrain. */
export const SHARP_LAYER = 1;

const FRAGMENT = /* glsl */ `
  uniform sampler2D tBlur;
  uniform sampler2D tLights;
  uniform sampler2D tRegion;
  uniform sampler2D tCloud;
  uniform mat4 uInv;
  uniform float uTime;
  uniform float uFog;
  uniform float uBlurOn;
  uniform float uAberration;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  // The look was tuned on sRGB values in the prototype: the maths runs there, the result goes back to linear.
  vec3 toS(vec3 c) { return pow(max(c, 0.0), vec3(1.0 / 2.2)); }
  vec3 toL(vec3 c) { return pow(max(c, 0.0), vec3(2.2)); }
  const vec3 LUMA = vec3(0.299, 0.587, 0.114);

  void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
    vec3 sharp = toS(inputColor.rgb);
    float m = 0.0;
    if (depth < 0.9999) {
      // The terrain under this pixel, back in world space; the mask is looked up by its x, z.
      vec4 w = uInv * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
      w /= w.w;
      vec2 mu = vec2((w.x * 10.0 + 500.0) / 1000.0, (w.z * 10.0 + 300.0) / 600.0);
      if (mu.x > 0.0 && mu.x < 1.0 && mu.y > 0.0 && mu.y < 1.0) m = texture2D(tRegion, mu).r * (1.0 - smoothstep(11.0, 17.0, w.y));
      float patchy = texture2D(tCloud, w.xz * 0.018 + vec2(uTime * 0.004, uTime * 0.0025)).r;
      m *= mix(0.55, 1.0, smoothstep(0.15, 0.75, patchy));
    }
    m *= uFog;
    vec3 col = sharp;
    if (m > 0.001) {
      vec2 off = vec2(uAberration * texelSize.x, 0.0);
      vec3 blur = uBlurOn > 0.5 ? toS(vec3(texture2D(tBlur, uv + off).r, texture2D(tBlur, uv).g, texture2D(tBlur, uv - off).b)) : sharp;
      vec3 soft = mix(blur, sharp, 0.18);
      vec3 fogc = mix(soft, vec3(dot(soft, LUMA)), 0.4) * 0.9 + vec3(0.035, 0.024, 0.06);
      // Lights shine through the static; without a blur there is nothing soft to bleed.
      fogc += max(blur - 0.05, 0.0) * 1.7 * uBlurOn;
      fogc += (hash(floor(uv * resolution * 0.34) + floor(uTime * 20.0)) - 0.5) * 0.035;
      fogc += sin(uv.y * resolution.y * 0.8 - uTime * 18.0) * 0.008;
      col = mix(sharp, fogc, m * 0.9);
    }
    // Sharp lights after the fog, then the prototype's vignette and grain over everything.
    vec3 s = toS(toL(col) + texture2D(tLights, uv).rgb);
    float vig = smoothstep(1.05, 0.3, length((uv - 0.5) * vec2(1.0, 1.15)) * 1.35);
    s *= mix(0.5, 1.0, vig);
    s += (hash(uv * resolution + fract(uTime) * 37.0) - 0.5) * 0.018;
    outputColor = vec4(toL(s), inputColor.a);
  }`;

export type FogQuality = "low" | "medium" | "high";

/**
 * The 404 Lands' signal fog (map brief): locked regions seen through a
 * bad signal — blurred, desaturated, lifted toward violet, with static
 * and a faint scanline — while open ground stays sharp. Which pixels fog
 * comes from the depth buffer: each pixel's terrain is rebuilt in world
 * space and looked up in the region mask, so the fog follows the ground.
 *
 * Additive lights do not write depth, so a beam standing in front of a
 * locked region would be fogged with the ground behind it. Lights on
 * {@link SHARP_LAYER} avoid that: the main render skips them, and this
 * effect draws them into their own target over a copy of the terrain's
 * depth (so hills still hide them) and adds them after the fog.
 *
 * Low skips the blur (grading, static and cards only); Medium blurs at
 * half resolution; High adds a slight colour split inside the fog.
 */
export class SignalFogEffect extends Effect {
  private readonly scene: Scene;
  private readonly camera: Camera;
  private readonly blur = new KawaseBlurPass({ kernelSize: KernelSize.LARGE, resolutionScale: 0.5 });
  private readonly blurTarget = new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false });
  private readonly lights = new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthTexture: new DepthTexture(1, 1, FloatType) });
  readonly mask: DataTexture;
  readonly cloud: DataTexture;
  private quality: FogQuality = "medium";
  private readonly clear = new Color();

  constructor(scene: Scene, camera: Camera, mask: Uint8Array, cloud: Uint8Array, cloudSize: number) {
    const maskTexture = new DataTexture(mask, MASK_W, MASK_H, RedFormat);
    maskTexture.magFilter = maskTexture.minFilter = LinearFilter;
    maskTexture.needsUpdate = true;
    const cloudTexture = new DataTexture(cloud, cloudSize, cloudSize, RedFormat);
    cloudTexture.magFilter = cloudTexture.minFilter = LinearFilter;
    cloudTexture.wrapS = cloudTexture.wrapT = RepeatWrapping;
    cloudTexture.needsUpdate = true;
    super("SignalFogEffect", FRAGMENT, {
      attributes: EffectAttribute.DEPTH,
      blendFunction: BlendFunction.SRC,
      uniforms: new Map<string, Uniform>([
        ["tBlur", new Uniform(null)],
        ["tLights", new Uniform(null)],
        ["tRegion", new Uniform(maskTexture)],
        ["tCloud", new Uniform(cloudTexture)],
        ["uInv", new Uniform(new Matrix4())],
        ["uTime", new Uniform(0)],
        ["uFog", new Uniform(1)],
        ["uBlurOn", new Uniform(1)],
        ["uAberration", new Uniform(0)],
      ]),
    });
    this.scene = scene;
    this.camera = camera;
    this.mask = maskTexture;
    this.cloud = cloudTexture;
    // The blur's own targets default to 8 bits, which bands in a scene this dark. They are public
    // fields in postprocessing 6.39.5's build, only left out of its typings.
    const targets = this.blur as unknown as { renderTargetA: WebGLRenderTarget; renderTargetB: WebGLRenderTarget };
    targets.renderTargetA.texture.type = targets.renderTargetB.texture.type = HalfFloatType;
    this.uniforms.get("tBlur")!.value = this.blurTarget.texture;
    this.uniforms.get("tLights")!.value = this.lights.texture;
  }

  /** Scene time (the map clock) and fog amount (0 off, 1 on; eased by the caller). */
  setFrame(time: number, fog: number) {
    this.uniforms.get("uTime")!.value = time;
    this.uniforms.get("uFog")!.value = fog;
  }

  /** Uploads the mask again after its data was redrawn. */
  refreshMask() {
    this.mask.needsUpdate = true;
  }

  setQuality(quality: FogQuality) {
    this.quality = quality;
    this.uniforms.get("uBlurOn")!.value = quality === "low" ? 0 : 1;
    this.uniforms.get("uAberration")!.value = quality === "high" ? 2 : 0;
  }

  override update(renderer: WebGLRenderer, inputBuffer: WebGLRenderTarget) {
    const camera = this.camera;
    (this.uniforms.get("uInv")!.value as Matrix4).multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse);
    if (this.quality !== "low" && (this.uniforms.get("uFog")!.value as number) > 0.001) this.blur.render(renderer, inputBuffer, this.blurTarget);
    this.renderSharpLights(renderer, inputBuffer);
  }

  /** Draws {@link SHARP_LAYER} over the terrain's depth, copied from the frame the composer just rendered. */
  private renderSharpLights(renderer: WebGLRenderer, inputBuffer: WebGLRenderTarget) {
    const { scene, camera, lights } = this;
    if (lights.width !== inputBuffer.width || lights.height !== inputBuffer.height) lights.setSize(inputBuffer.width, inputBuffer.height);
    const gl = renderer.getContext() as WebGL2RenderingContext;
    const props = renderer.properties;
    renderer.setRenderTarget(lights);
    const src = (props.get(inputBuffer) as { __webglFramebuffer?: WebGLFramebuffer }).__webglFramebuffer;
    const dst = (props.get(lights) as { __webglFramebuffer?: WebGLFramebuffer }).__webglFramebuffer;
    if (src && dst) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, src);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dst);
      gl.blitFramebuffer(0, 0, inputBuffer.width, inputBuffer.height, 0, 0, lights.width, lights.height, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    }
    // Raw binds above left three's framebuffer cache stale: unbind and bind again through it.
    renderer.setRenderTarget(null);
    renderer.setRenderTarget(lights);

    const background = scene.background;
    const layers = camera.layers.mask;
    const autoClear = renderer.autoClear;
    const alpha = renderer.getClearAlpha();
    renderer.getClearColor(this.clear);
    try {
      scene.background = null;
      camera.layers.set(SHARP_LAYER);
      renderer.autoClear = false;
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, false, false);
      renderer.render(scene, camera);
    } finally {
      scene.background = background;
      camera.layers.mask = layers;
      renderer.autoClear = autoClear;
      renderer.setClearColor(this.clear, alpha);
      renderer.setRenderTarget(null);
    }
  }

  override setSize(width: number, height: number) {
    this.blur.setSize(width, height);
    this.blurTarget.setSize(Math.max(1, width >> 1), Math.max(1, height >> 1));
    this.lights.setSize(width, height);
  }

  override dispose() {
    super.dispose();
    this.blur.dispose();
    this.blurTarget.dispose();
    this.lights.depthTexture?.dispose();
    this.lights.dispose();
    this.mask.dispose();
    this.cloud.dispose();
  }
}
