// Run: node scripts/measure-landing.mjs [url]
// Anonymous, cold browser context; simulated 4G, not a physical phone benchmark.
import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'https://git-shelters.vercel.app';
const profile = { latencyMs: 150, downloadMbps: 1.6, uploadMbps: 0.75, cpuSlowdown: 4 };
const browser = await chromium.launch();
const samples = [];
try {
  for (let run = 1; run <= 3; run++) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    try {
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false, latency: profile.latencyMs,
        downloadThroughput: profile.downloadMbps * 1_000_000 / 8,
        uploadThroughput: profile.uploadMbps * 1_000_000 / 8,
      });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuSlowdown });
      await page.addInitScript(() => {
        window.__landingLcp = null;
        new PerformanceObserver(list => {
          window.__landingLcp = list.getEntries().at(-1)?.startTime ?? null;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      });
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.getByRole('button', { name: 'Connect with GitHub' }).waitFor({ timeout: 60_000 });
      const ctaVisibleMs = await page.evaluate(() => performance.now());
      await page.locator('canvas').waitFor({ timeout: 60_000 });
      const canvasVisibleMs = await page.evaluate(() => performance.now());
      await page.waitForTimeout(5000);
      const timing = await page.evaluate(() => ({
        lcpMs: window.__landingLcp,
        fcpMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
        ttfbMs: performance.getEntriesByType('navigation')[0]?.responseStart ?? null,
      }));
      const sample = { run, status: response?.status(), ...timing, ctaVisibleMs, canvasVisibleMs };
      samples.push(sample);
      console.log(JSON.stringify(sample));
    } finally { await context.close(); }
  }
  console.log(JSON.stringify({ url, measuredAt: new Date().toISOString(), browser: browser.version(), profile, samples }, null, 2));
} finally { await browser.close(); }
