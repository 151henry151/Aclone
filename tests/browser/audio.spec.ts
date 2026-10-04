import { creatorSchema } from '../../src/shared/creator.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { createApp } from '../../src/server/app.ts';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation.ts';

test('audible engines, shared horns and supplied machinery through the real browser mixer', async ({
  page,
}) => {
  // This exercises sound and controls, not full-resolution scenery capture.
  await page.setViewportSize({ width: 960, height: 600 });
  const dir = mkdtempSync(join(tmpdir(), 'aclone-audio-test-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  let neighbour: WebSocket | undefined;
  try {
    const { account, token } = app.universe.register('Sound driver');
    const w = createWorld('audio-test', 'Audio test', account.id);
    w.script = '';
    w.creator = creatorSchema.parse({ scenery: false, weather: 'clear' });
    // Keep the audio fixture supplied and independent of weather/production clocks.
    w.settings.productionSeconds = 3600;
    w.settings.dayLength = 0;
    w.settings.time = 43200;
    const p = addPlayer(w, account.id, account.name);
    p.x = -220;
    p.z = -180;
    p.heading = 0;
    const saw = makeBuilding('saw', 'sawmill', p.x + 15, p.z);
    saw.government = true;
    saw.stock = {};
    w.buildings = [saw];
    app.worlds.set(w.id, w);
    const port = await app.listen();
    await page.addInitScript(
      ({ token, world }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', world);
        localStorage.setItem('aclone.quality', 'low');
        // Observe actual rendered PCM after the game's limiter, not a mocked AudioContext.
        const probe: {
          contexts: AudioContext[];
          sources: { source: AudioBufferSourceNode; ended: boolean }[];
          analyser?: AnalyserNode;
          peaks: number[];
          peak: number;
          ready: boolean;
        } = ((window as any).__audioProbe = {
          contexts: [],
          sources: [],
          analyser: undefined,
          peaks: [],
          peak: 0,
          ready: false,
        });
        const Native = window.AudioContext;
        window.AudioContext = class extends Native {
          constructor(...args: ConstructorParameters<typeof AudioContext>) {
            super(...args);
            probe.contexts.push(this);
            probe.analyser = this.createAnalyser();
            probe.analyser.fftSize = 2048;
            // Measure in the audio thread: a short horn can finish while software
            // WebGL blocks the main thread, between two AnalyserNode samples.
            const url = URL.createObjectURL(
              new Blob(
                [
                  `
              class Meter extends AudioWorkletProcessor {
                peak = 0;
                frames = 0;
                process(inputs) {
                  const samples = inputs[0]?.[0];
                  if (samples) this.peak = Math.max(this.peak, Math.sqrt(samples.reduce((sum, x) => sum + x*x, 0) / samples.length));
                  if (++this.frames === 8) { this.port.postMessage(this.peak); this.frames = 0; this.peak = 0; }
                  return true;
                }
              }
              registerProcessor('test-meter', Meter);
            `,
                ],
                { type: 'text/javascript' },
              ),
            );
            void this.audioWorklet.addModule(url).then(() => {
              URL.revokeObjectURL(url);
              const meter = new AudioWorkletNode(this, 'test-meter');
              meter.port.onmessage = ({ data }) => {
                probe.peak = Math.max(probe.peak, data);
              };
              probe.analyser!.connect(meter);
              // The meter outputs silence; it observes rather than doubles playback.
              meter.connect(this.destination);
              probe.ready = true;
            });
          }
          createBufferSource() {
            const source = super.createBufferSource();
            const entry = { source, ended: false };
            probe.sources.push(entry);
            source.addEventListener('ended', () => {
              entry.ended = true;
            });
            return source;
          }
        };
        const connect = AudioNode.prototype.connect;
        AudioNode.prototype.connect = function (this: AudioNode, ...args: any[]) {
          const result = (connect as any).apply(this, args);
          if (
            args[0] === this.context.destination &&
            probe.analyser &&
            !(this instanceof AudioWorkletNode)
          )
            (connect as any).call(this, probe.analyser);
          return result;
        } as typeof connect;
        setInterval(() => {
          if (!probe.analyser) return;
          const samples = new Float32Array(2048);
          probe.analyser.getFloatTimeDomainData(samples);
          const rms = Math.sqrt(samples.reduce((sum, x) => sum + x * x, 0) / samples.length);
          probe.peaks.push(rms);
          if (probe.peaks.length > 30) probe.peaks.shift();
        }, 20);
      },
      { token, world: w.id },
    );
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${port}`);
    await expect(page.locator('#world-hud')).toBeVisible({ timeout: 60000 });
    const soundButton = page.locator('.bottom-left [data-do="sound"]');
    await expect(soundButton).toHaveText('Sound: tap to start');
    expect(await page.evaluate(() => (window as any).__audioProbe.contexts.length)).toBe(0);
    await soundButton.click();
    await expect(soundButton).toHaveText('Sound: on');
    await expect.poll(() => page.evaluate(() => (window as any).__audioProbe.ready)).toBe(true);
    const rms = () =>
      page.evaluate(() => {
        const values: number[] = (window as any).__audioProbe.peaks;
        return values.length ? values.at(-1)! : 0;
      });
    const loops = () =>
      page.evaluate(
        () =>
          (window as any).__audioProbe.sources.filter((s: any) => s.source.loop && !s.ended)
            .length as number,
      );
    const shots = () =>
      page.evaluate(
        () =>
          (window as any).__audioProbe.sources.filter((s: any) => !s.source.loop).length as number,
      );
    await expect.poll(rms).toBeGreaterThan(0.005);
    await expect.poll(loops).toBe(1);
    await page.keyboard.down('ArrowUp');
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            Math.max(
              ...(window as any).__audioProbe.sources
                .filter((s: any) => s.source.loop && !s.ended)
                .map((s: any) => s.source.playbackRate.value),
            ),
          ),
        { timeout: 15000 },
      )
      .toBeGreaterThan(1.1);
    await page.keyboard.up('ArrowUp');
    await page.keyboard.press('F4');
    await expect.poll(loops, { timeout: 15000 }).toBe(0);
    await expect.poll(rms).toBeLessThan(0.0001);
    // A second real connection: only its engine can now produce continuous sound.
    const other = app.universe.register('Sound neighbour');
    const q = addPlayer(w, other.account.id, other.account.name);
    q.x = p.x + 8;
    q.z = p.z;
    q.engine = true;
    neighbour = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await new Promise<void>((resolve) => neighbour!.once('open', resolve));
    neighbour.send(JSON.stringify({ type: 'hello', protocol: 2, token: other.token, world: w.id }));
    await expect.poll(loops).toBe(1);
    await expect.poll(rms).toBeGreaterThan(0.002);
    q.x = p.x + 500;
    await expect.poll(loops, { timeout: 15000 }).toBe(0);
    q.x = p.x + 8;
    q.engine = false;
    const beforeHorn = await shots();
    await page.evaluate(() => {
      (window as any).__audioProbe.peak = 0;
    });
    neighbour.send(JSON.stringify({ type: 'action', action: { type: 'horn' } }));
    await expect.poll(shots).toBe(beforeHorn + 1);
    await expect
      .poll(() => page.evaluate(() => (window as any).__audioProbe.peak))
      .toBeGreaterThan(0.005);
    await page.waitForTimeout(600);
    expect(await shots()).toBe(beforeHorn + 1); // repeated snapshots must not repeat a honk
    await page.getByRole('button', { name: 'Parp Space' }).click();
    await expect.poll(shots).toBe(beforeHorn + 2);
    // Stocked government sawmill runs; exhausted input/output storage stops it.
    saw.stock = { logs: 30 };
    await expect.poll(loops).toBe(1);
    await expect.poll(rms).toBeGreaterThan(0.001);
    saw.stock.wood = saw.capacity;
    await expect.poll(loops, { timeout: 15000 }).toBe(0);
    saw.stock.wood = 0;
    await expect.poll(loops).toBe(1);
    await page.locator('#brand-button').click();
    await page.locator('[data-do="options"]').click();
    const volume = page.getByRole('slider', { name: 'Sound volume' });
    await volume.fill('0');
    await expect.poll(rms).toBeLessThan(0.0001);
    await volume.fill('35');
    await expect.poll(rms).toBeGreaterThan(0.0005);
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await soundButton.click();
    await expect(soundButton).toHaveText('Sound: off');
    await expect.poll(rms).toBeLessThan(0.0001);
    await page.reload();
    await expect(soundButton).toHaveText('Sound: off');
    expect(await page.evaluate(() => localStorage.getItem('aclone.volume'))).toBe('0.35');
    await page.locator('[data-do="camera"]').click();
    expect(await page.evaluate(() => (window as any).__audioProbe.contexts.length)).toBe(0);
    await soundButton.click();
    await expect.poll(rms).toBeGreaterThan(0.001);
    saw.stock = {};
    q.engine = true;
    await expect.poll(loops).toBe(1);
    neighbour.close();
    await expect.poll(loops, { timeout: 15000 }).toBe(0);
    await expect.poll(rms).toBeLessThan(0.0001);
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Audio zones', exact: true }).click();
    await page.getByLabel('Zone name', { exact: true }).fill('Nearby shore');
    await page.getByRole('combobox', { name: 'Sound', exact: true }).selectOption('shore');
    const form = page.locator('#creator-audio-form');
    await form.locator('[name=x]').fill(p.x.toFixed(1));
    await form.locator('[name=z]').fill(p.z.toFixed(1));
    await page.getByRole('button', { name: 'Save audio zone', exact: true }).click();
    await expect.poll(() => w.creator?.ambience.length).toBe(1);
    await expect.poll(loops, { timeout: 15000 }).toBe(1);
    await expect.poll(rms).toBeGreaterThan(0.0005);
    await page.keyboard.press('Escape');
    await page.locator('#brand-button').click();
    await page.locator('[data-do="options"]').click();
    await page.getByRole('slider', { name: 'Ambience', exact: true }).fill('0');
    await expect.poll(rms).toBeLessThan(0.0001);
    await page.getByRole('slider', { name: 'Ambience', exact: true }).fill('100');
    await expect.poll(rms).toBeGreaterThan(0.0005);
    expect(await page.evaluate(() => localStorage.getItem('aclone.volume.ambience'))).toBe('1');
    expect(errors).toEqual([]);
  } finally {
    neighbour?.terminate();
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
