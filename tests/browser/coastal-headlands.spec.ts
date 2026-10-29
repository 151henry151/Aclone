// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { createServer } from 'vite';
import { coastPreviewHTML } from '../../scripts/coast-preview-scene';
test('coastal renderer shows clear-weather flashes, storm shafts and animated cliff surf without shader errors', async ({
  page,
}) => {
  test.setTimeout(240000);
  const server = await createServer({ server: { port: 0, host: '127.0.0.1' } });
  await server.listen();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  try {
    await page.route('**/__coast', (r) =>
      r.fulfill({ contentType: 'text/html', body: coastPreviewHTML }),
    );
    await page.goto(server.resolvedUrls!.local[0] + '__coast');
    await page.waitForFunction(() => (window as any).ready?.(), undefined, { timeout: 150000 });
    const shot = (mode: string, t = 2) =>
      page.evaluate(([mode, t]) => (window as any).shot(mode, t), [mode, t]);
    const day = await shot('day');
    expect(day.bluffs).toBe(15);
    expect(day.shaft).toBe(false);
    const far = await shot('distant');
    expect(far.signals.find((s: any) => s[0] === 'parish-harbour-light')[1]).toBeGreaterThan(0.1);
    const off = await shot('off');
    expect(off.signals.find((s: any) => s[0] === 'parish-harbour-light')[1]).toBeLessThan(0.001);
    const storm = await shot('storm');
    expect(storm.shaft).toBe(true);
    expect(storm.patches).toBeGreaterThan(5);
    const before = await page.evaluate(() =>
      Array.from(
        (window as any).game.ocean.surf.group.children.find((o: any) => o.isMesh).geometry
          .attributes.position.array,
      ),
    );
    await shot('storm', 3);
    const after = await page.evaluate(() =>
      Array.from(
        (window as any).game.ocean.surf.group.children.find((o: any) => o.isMesh).geometry
          .attributes.position.array,
      ),
    );
    expect(after).not.toEqual(before);
    await shot('night');
    const night = await page.evaluate(() => ({
      intensity: (window as any).game.lighthouseLights.spot.intensity,
      shaft: (window as any).game.lighthouseLights.shaft.visible,
    }));
    expect(night.intensity).toBeGreaterThan(0);
    expect(night.intensity).toBeLessThan(1);
    expect(night.shaft).toBe(false);
    const inland = await page.evaluate(() => {
      const { game, world, b, cliff } = window as any;
      const angle = Math.atan2(Math.cos(cliff.angle), -Math.sin(cliff.angle));
      const time = ((angle - b.x * 0.01 - b.rotation) * 8) / Math.PI;
      game.lighthouseLights.update(world, game.camera, time, 0, 1);
      return {
        intensity: game.lighthouseLights.spot.intensity,
        shaft: game.lighthouseLights.shaft.visible,
      };
    });
    expect(inland).toEqual({ intensity: 0, shaft: false });
    await shot('calm');
    expect(await page.evaluate(() => (window as any).game.ocean.surf.group.visible)).toBe(false);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await server.close();
  }
});
