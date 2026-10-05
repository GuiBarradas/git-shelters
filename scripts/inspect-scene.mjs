// Usage: node scripts/inspect-scene.mjs <url> <screenshot.png>
// Explicit D3D11 on Windows; always report the adapter, never assume hardware acceleration.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium', args: process.platform === 'win32' ? ['--enable-gpu', '--use-angle=d3d11'] : [] });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    window.__draws = 0;
    for (const type of [WebGLRenderingContext, WebGL2RenderingContext]) {
      for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
        const original = type.prototype[name];
        if (!original) continue;
        type.prototype[name] = function (...args) { window.__draws++; return original.apply(this, args); };
      }
    }
  });
  await page.goto(process.argv[2] ?? 'http://localhost:3000', { waitUntil: 'networkidle', timeout: 120000 });
  await page.locator('canvas').waitFor({ timeout: 60000 });
  await page.waitForTimeout(20000);
  const metrics = await page.evaluate(async () => {
    const canvas = document.querySelector('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const frames = [];
    const resolutionBefore = [canvas.width, canvas.height];
    const drawsBefore = window.__draws;
    await new Promise(resolve => {
      let prev;
      const frame = time => {
        if (prev !== undefined) frames.push(time - prev);
        prev = time;
        if (frames.length >= 600) resolve(); else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    const sorted = [...frames].sort((a, b) => a - b);
    return { renderer, frames: frames.length, meanMs: frames.reduce((a,b)=>a+b,0)/frames.length,
      medianMs: sorted[Math.floor(sorted.length*.5)], p95Ms: sorted[Math.floor(sorted.length*.95)],
      maxMs: sorted.at(-1), framesOver33ms: frames.filter(ms => ms > 33.4).length,
      framesOver25ms: frames.filter(ms => ms > 25).length,
      drawsPerFrame: (window.__draws-drawsBefore)/601,
      resolutionChanged: resolutionBefore[0] !== canvas.width || resolutionBefore[1] !== canvas.height,
      canvas: { width: canvas.width, height: canvas.height } };
  });
  if (process.argv[3]) await page.screenshot({ path: process.argv[3] });
  console.log(JSON.stringify({ ...metrics, errors }, null, 2));
} finally { await browser.close(); }
