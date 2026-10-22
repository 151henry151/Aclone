// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';

test('roadside snow fades with the surrounding pack during the last centimetre of thaw', async ({
  page,
}) => {
  test.setTimeout(360000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-thaw-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  let hold: ReturnType<typeof setInterval> | undefined;
  try {
    const { account, token } = app.universe.register('Thaw preview');
    const w = createWorld('winter-preview', 'Spring thaw', account.id);
    w.script = '';
    w.settings.dayLength = 0;
    w.settings.time = 43200;
    w.time = (105 - 59) * 600;
    w.creator = creatorSchema.parse({ weather: 'clear' });
    const p = addPlayer(w, account.id, account.name);
    p.x = -68;
    p.z = 122;
    p.heading = Math.atan2(-10, -14);
    app.worlds.set(w.id, w);
    // Hold each climate snapshot steady while software WebGL captures it.
    // All terrain, roads, banks and lighting are the production GameScene.
    let depth = 0;
    const climate = () => {
      w.climate = {
        snow: Math.min(1, depth / 0.04),
        snowDepth: depth,
        winterBase: 0,
        wetness: 1,
        snowModel: 1,
      };
    };
    climate();
    hold = setInterval(climate, 25);
    const port = await app.listen();
    await page.addInitScript(
      ({ token, world }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', world);
        localStorage.setItem('aclone.quality', 'low');
      },
      { token, world: w.id },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await expect(page.locator('#world-hud')).toBeVisible({ timeout: 180000 });
    await expect(page.locator('#startup-loading')).toBeHidden({ timeout: 60000 });
    await page.mouse.move(720, 420);
    await page.mouse.down();
    await page.mouse.move(720, 520, { steps: 8 });
    await page.mouse.up();
    const images: string[] = [];
    for (const value of [0.04, 0.01, 0.003, 0]) {
      depth = value;
      climate();
      if (value) await expect(page.locator('#clock')).toContainText('Snow');
      else await expect(page.locator('#clock')).not.toContainText('Snow');
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            let n = 0;
            const frame = () => {
              if (++n >= 8) resolve();
              else requestAnimationFrame(frame);
            };
            requestAnimationFrame(frame);
          }),
      );
      const shot = await page.screenshot({
        path: `test-results/snow-thaw-${Math.round(value * 1000)}mm.png`,
      });
      images.push(shot.toString('base64'));
    }
    const differences = await page.evaluate(async (images) => {
      const samples: Uint8ClampedArray[] = [];
      for (const data of images) {
        const img = new Image();
        img.src = `data:image/png;base64,${data}`;
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        // Snow bank on the near side of the road; exclude HUD and the tractor.
        samples.push(ctx.getImageData(380, 520, 150, 100).data);
      }
      const bare = samples[3]!;
      return samples.slice(0, 3).map((sample) => {
        let sum = 0;
        for (let i = 0; i < sample.length; i++)
          if (i % 4 !== 3) sum += Math.abs(sample[i]! - bare[i]!);
        return sum / (sample.length * 0.75);
      });
    }, images);
    expect(differences[0]).toBeGreaterThan(15); // The chosen area actually contains snow.
    // Tone mapping makes displayed brightness nonlinear. Even allowing for
    // that, a thin bank must lose most of its visible contrast (previously the
    // 3mm strip retained roughly two thirds of the full pack's contrast).
    expect(differences[1]).toBeLessThan(differences[0]! * 0.65);
    expect(differences[2]).toBeLessThan(differences[0]! * 0.3);
    expect(errors).toEqual([]);
  } finally {
    clearInterval(hold);
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
