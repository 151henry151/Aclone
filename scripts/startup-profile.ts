// SPDX-License-Identifier: GPL-3.0-or-later
// Disposable local cold-load profile. No credentials or production data are recorded.
import { chromium } from '@playwright/test';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server/app.ts';
import { addPlayer } from '../src/shared/simulation.ts';
const dir = mkdtempSync(join(tmpdir(), 'aclone-startup-'));
const output = process.env.PROFILE_OUTPUT_DIR ?? 'test-results/startup';
mkdirSync(output, { recursive: true });
const app = await createApp({ dataDir: dir, port: 0 });
const { account, token } = app.universe.register('Startup observer');
const w = app.worlds.get('puddlewick')!;
w.script = '';
addPlayer(w, account.id, account.name);
for (let i = 0; i < 8; i++) {
  const p = addPlayer(w, 'fixture-' + i, 'Resident ' + i);
  p.x += i * 6;
  p.z += i * 3;
}
const port = await app.listen();
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH,
  args: [
    '--no-sandbox',
    ...(process.env.PROFILE_GPU === '1'
      ? ['--enable-gpu', '--use-angle=gl', '--ignore-gpu-blocklist']
      : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']),
  ],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(
    ({ token }) => {
      localStorage.setItem('aclone.pilot', token);
      localStorage.setItem('aclone.world', 'puddlewick');
    },
    { token },
  );
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(`
    window.startupProfile = {longTasks: [], frames: []};
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) window.startupProfile.longTasks.push({start:e.startTime,duration:e.duration});
    }).observe({type:'longtask',buffered:true});
    let previous = performance.now();
    function measure(at) {
      window.startupProfile.frames.push({start:at,duration:at-previous}); previous=at;
      if(at<65000) requestAnimationFrame(measure);
    }
    requestAnimationFrame(measure);
  `);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.start');
  await page.goto(`http://127.0.0.1:${port}`);
  await page.waitForTimeout(Number(process.env.PROFILE_SECONDS ?? 60) * 1000);
  const { profile } = await cdp.send('Profiler.stop');
  writeFileSync(join(output, 'cpu.json'), JSON.stringify(profile));
  const renderer = await page.locator('#viewport canvas').evaluate((canvas) => {
    const gl = (canvas as HTMLCanvasElement).getContext('webgl2')!,
      debug = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      name: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'Unavailable',
      drawCalls: (canvas as HTMLElement).dataset.drawCalls,
      triangles: (canvas as HTMLElement).dataset.triangles,
    };
  });
  const data = await page.evaluate(() => ({
    ...(window as unknown as { startupProfile: object }).startupProfile,
    marks: performance.getEntriesByType('mark').map((e) => ({ name: e.name, start: e.startTime })),
    resources: performance.getEntriesByType('resource').map((e) => {
      const r = e as PerformanceResourceTiming;
      return {
        name: new URL(r.name).pathname,
        start: r.startTime,
        duration: r.duration,
        bytes: r.transferSize,
      };
    }),
  }));
  writeFileSync(join(output, 'frames.json'), JSON.stringify({ ...data, renderer }));
  if (errors.length) throw Error(errors.join('\n'));
  console.log('Saved cold-load profile to', output);
} finally {
  await browser.close();
  await app.close();
  rmSync(dir, { recursive: true, force: true });
}
