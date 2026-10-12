// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';

test('coloured fog attenuates streetlamp pools without illuminating their square corners', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-glow-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  try {
    const port = await app.listen();
    await page.route('**/__glow_test', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<script type="module" src="/tests/browser/fixtures/light-pools.ts"></script>',
      }),
    );
    await page.goto(`http://127.0.0.1:${port}/__glow_test`);
    await page.waitForFunction(() => typeof (window as any).renderGlows === 'function');
    const render = (mode: string, colour: string) =>
      page.evaluate(({ mode, colour }) => (window as any).renderGlows(mode, colour), {
        mode,
        colour,
      });
    const clear = await render('none', '#000000');
    expect(clear.centre[0]).toBeGreaterThan(20);
    expect(clear.skirt[0]).toBeGreaterThan(0);
    expect(clear.skirt[0]).toBeLessThan(clear.centre[0]);
    for (const colour of ['#edaa83', '#9c473e', '#819098']) {
      for (const mode of ['linear', 'exponential']) {
        const fog = await render(mode, colour);
        expect(fog.draws).toBe(1);
        for (const corner of fog.corners) expect(Math.max(...corner)).toBeLessThanOrEqual(1);
        expect(fog.centre[0]).toBeGreaterThan(0);
        expect(fog.centre[0]).toBeLessThan(clear.centre[0]);
      }
      const opaque = await render('opaque', colour);
      expect(Math.max(...opaque.centre)).toBeLessThanOrEqual(1);
    }
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
