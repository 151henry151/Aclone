// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect, type Page } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, act } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
import { radioView } from '../../src/shared/radio';
async function login(page: Page, token: string, port: number) {
  page.setDefaultTimeout(15000);
  await page.addInitScript(
    ({ token }) => {
      localStorage.setItem('aclone.pilot', token);
      localStorage.setItem('aclone.world', 'radio-ui');
      localStorage.setItem('aclone.quality', 'low');
      localStorage.setItem('aclone.sound', 'on');
    },
    { token },
  );
  await page.goto(`http://127.0.0.1:${port}`);
  await waitForWorld(page);
}
async function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-radio-ui-')),
    app = await createApp({
      dataDir: dir,
      port: 0,
      dev: process.env.TEST_RADIO_PRODUCTION !== '1',
    });
  const first = app.universe.register('Alice radio'),
    second = app.universe.register('Bob radio'),
    w = createWorld('radio-ui', 'Radio field', first.account.id);
  w.script = '';
  w.buildings = [];
  w.towns = [];
  w.roads = [];
  Object.assign(w.settings, {
    mapSize: 6000,
    seaLevel: -10,
    hungerRate: 0,
    thirstRate: 0,
    dayLength: 0,
    time: 43200,
    vehicleMaintenance: false,
  });
  w.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array(1089).fill(0),
  };
  const a = addPlayer(w, first.account.id, first.account.name),
    b = addPlayer(w, second.account.id, second.account.name);
  for (const [i, p] of [a, b].entries())
    Object.assign(p, { x: i * 100, y: 0, z: 0, vehicle: 0, engine: false, speed: 0 });
  app.worlds.set(w.id, w);
  const port = await app.listen();
  return { app, dir, first, second, w, a, b, port };
}
test.use({
  launchOptions: {
    args: [
      '--no-sandbox',
      '--enable-webgl',
      '--enable-gpu',
      '--use-angle=gl',
      '--ignore-gpu-blocklist',
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
    ],
  },
});
async function instrument(page: Page) {
  await page.addInitScript(() => {
    const probe = { frames: 0, audible: 0, streams: [] as MediaStream[] };
    (window as any).voiceProbe = probe;
    const get = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (options) => {
      const stream = await get(options);
      probe.streams.push(stream);
      return stream;
    };
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args: Parameters<typeof start>) {
      if (this.buffer && this.buffer.sampleRate === 16000) {
        probe.frames++;
        if (this.buffer.getChannelData(0).some((n) => Math.abs(n) > 0.001)) probe.audible++;
      }
      return start.apply(this, args);
    };
  });
}
test('microphone samples play on the other radio and release closes capture', async ({
  browser,
}) => {
  test.setTimeout(180000);
  const f = await fixture(),
    ca = await browser.newContext(),
    cb = await browser.newContext();
  const a = await ca.newPage(),
    b = await cb.newPage();
  try {
    await instrument(a);
    await instrument(b);
    await login(a, f.first.token, f.port);
    await login(b, f.second.token, f.port);
    await a.keyboard.press('v');
    await b.keyboard.press('v');
    const ar = a.locator('.radio-console'),
      br = b.locator('.radio-console');
    await expect(ar.getByLabel('Radio message', { exact: true })).toHaveCount(0);
    await a.keyboard.down('t');
    await expect(br.locator('[data-radio-keyed]')).toContainText('Alice radio');
    await expect
      .poll(() => b.evaluate(() => (window as any).voiceProbe.audible))
      .toBeGreaterThan(2);
    await a.keyboard.up('t');
    await expect.poll(() => radioView(f.w, f.a).keyed.length).toBe(0);
    await expect
      .poll(() =>
        a.evaluate(() =>
          (window as any).voiceProbe.streams.every((s: MediaStream) =>
            s.getTracks().every((t) => t.readyState === 'ended'),
          ),
        ),
      )
      .toBe(true);
    await expect(br.getByRole('log')).toContainText('Voice transmission');
    expect(f.w.messages.some((m) => m.text.includes('Voice transmission'))).toBe(false);
    mkdirSync('output/radio-voice', { recursive: true });
    await b.screenshot({ path: 'output/radio-voice/received-voice.png' });
    // Reception continues outside the dashboard and obeys the ordinary game sound switch.
    await b.keyboard.press('Escape');
    const audible = await b.evaluate(() => (window as any).voiceProbe.audible);
    await a.keyboard.down('t');
    await expect
      .poll(() => b.evaluate(() => (window as any).voiceProbe.audible))
      .toBeGreaterThan(audible + 2);
    await b.locator('button[data-do="sound"]').first().click();
    await expect(b.locator('button[data-do="sound"]').first()).toContainText('off');
    await b.waitForTimeout(250);
    const mutedFrames = await b.evaluate(() => (window as any).voiceProbe.frames);
    await b.waitForTimeout(350);
    expect(await b.evaluate(() => (window as any).voiceProbe.frames)).toBe(mutedFrames);
    await a.keyboard.up('t');
  } finally {
    await ca.close();
    await cb.close();
    await f.app.close();
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test('microphone denial, absence, delayed permission and disconnect leave no live capture', async ({
  browser,
}) => {
  test.setTimeout(180000);
  const f = await fixture(),
    context = await browser.newContext(),
    page = await context.newPage();
  try {
    await instrument(page);
    await login(page, f.first.token, f.port);
    await page.keyboard.press('v');
    const root = page.locator('.radio-console');
    await page.evaluate(() => {
      (window as any).realMicrophone = navigator.mediaDevices.getUserMedia;
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException('Denied', 'NotAllowedError'));
    });
    await page.keyboard.down('t');
    await expect(root.getByRole('alert')).toContainText('permission denied');
    await page.keyboard.up('t');
    expect(radioView(f.w, f.a).keyed).toHaveLength(0);
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException('Missing', 'NotFoundError'));
    });
    await page.keyboard.down('t');
    await expect(root.getByRole('alert')).toContainText('No microphone');
    await page.keyboard.up('t');
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = (options) =>
        new Promise((resolve) => {
          (window as any).releasePermission = async () =>
            resolve(await (window as any).realMicrophone(options));
        });
    });
    await page.keyboard.down('t');
    await expect(root.locator('[data-radio-audio]')).toContainText('Preparing');
    await page.keyboard.up('t');
    await page.evaluate(() => (window as any).releasePermission());
    await expect.poll(() => page.evaluate(() => (window as any).voiceProbe.streams.length)).toBe(1);
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as any).voiceProbe.streams[0]
            .getTracks()
            .every((t: MediaStreamTrack) => t.readyState === 'ended'),
        ),
      )
      .toBe(true);
    expect(radioView(f.w, f.a).keyed).toHaveLength(0);
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = (window as any).realMicrophone;
    });
    f.w.settings.radioVoiceMaxSeconds = 1;
    await page.keyboard.down('t');
    await expect.poll(() => radioView(f.w, f.a).keyed.length).toBe(1);
    await expect.poll(() => radioView(f.w, f.a).keyed.length).toBe(0);
    await page.keyboard.up('t');
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as any).voiceProbe.streams.every((s: MediaStream) =>
            s.getTracks().every((t) => t.readyState === 'ended'),
          ),
        ),
      )
      .toBe(true);
    f.w.settings.radioVoiceMaxSeconds = 30;
    await page.keyboard.down('t');
    await expect.poll(() => radioView(f.w, f.a).keyed.length).toBe(1);
    await page.keyboard.press('Escape');
    await page.keyboard.up('t');
    await expect.poll(() => radioView(f.w, f.a).keyed.length).toBe(0);
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as any).voiceProbe.streams.every((s: MediaStream) =>
            s.getTracks().every((t) => t.readyState === 'ended'),
          ),
        ),
      )
      .toBe(true);
    await page.keyboard.press('v');
    await page.keyboard.down('t');
    await expect.poll(() => radioView(f.w, f.a).keyed.length).toBe(1);
    await page.reload();
    await waitForWorld(page);
    await expect.poll(() => radioView(f.w, f.a).keyed.length).toBe(0);
  } finally {
    await context.close();
    await f.app.close();
    rmSync(f.dir, { recursive: true, force: true });
  }
});
