// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { waitForWorld } from './fixtures/ready';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import {
  createWorld,
  addPlayer,
  act,
  advance,
  terrainHeight,
} from '../../src/shared/simulation.ts';
import { buildings } from '../../src/shared/catalog.ts';
import { buildingDesignQuote } from '../../src/shared/building-designs.ts';
import { creatorSchema } from '../../src/shared/creator.ts';

test('waterworks build preview enforces shoreline placement and the finished building produces water', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-waterworks-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const { account, token } = app.universe.register('Pump builder');
    const w = createWorld('water-ui', 'Water Parish', account.id);
    w.script = '';
    w.buildings = [];
    w.settings.mapSize = 500;
    w.settings.hungerRate = w.settings.thirstRate = 0;
    w.creator = creatorSchema.parse({ scenery: false, roads: false, weather: 'clear' });
    const p = addPlayer(w, account.id, account.name);
    p.cash = 1000000;
    p.x = 0;
    // Inland, but outside the town/respawn reservation: test shoreline refusal itself.
    p.z = 60;
    p.y = terrainHeight(w, p.x, p.z);
    app.worlds.set(w.id, w);
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
    await waitForWorld(page);
    await page.getByRole('button', { name: 'Build', exact: true }).click();
    await page.getByLabel('Building type', { exact: true }).selectOption('waterworks');
    const build = page.getByRole('button', { name: 'Place foundation', exact: true });
    const status = page.locator('[data-build-estimate] [role="status"]');
    await expect(build).toBeDisabled();
    await expect(status).toContainText('dry shoreline ground');
    await page.getByRole('button', { name: 'Close dialog' }).click();
    p.z = 144;
    p.y = terrainHeight(w, p.x, p.z);
    await expect
      .poll(async () => {
        await page.getByRole('button', { name: 'Build', exact: true }).click();
        // The intake must face the sea, not just have water somewhere nearby.
        await page.getByLabel('Building rotation', { exact: true }).fill('180');
        await page.getByLabel('Building rotation', { exact: true }).dispatchEvent('change');
        const enabled = await build.isEnabled();
        if (!enabled) await page.getByRole('button', { name: 'Close dialog' }).click();
        return enabled;
      })
      .toBe(true);
    await expect(status).toHaveText('Site clear. Ready to place this design.');
    await page.getByLabel('Building rotation', { exact: true }).fill('0');
    await page.getByLabel('Building rotation', { exact: true }).dispatchEvent('change');
    await expect(build).toBeDisabled();
    await expect(status).toContainText('Rotate the intake toward water');
    await page.getByLabel('Building rotation', { exact: true }).fill('180');
    await page.getByLabel('Building rotation', { exact: true }).dispatchEvent('change');
    await expect(build).toBeEnabled();
    await build.click();
    await expect.poll(() => w.buildings.length).toBe(1);
    const b = w.buildings[0];
    expect(b.kind).toBe('waterworks');
    expect(b.rotation).toBeCloseTo(Math.PI);
    const quote = buildingDesignQuote(
      'waterworks',
      buildings.waterworks,
      'stone-gable',
      'standard',
      'model-1',
    );
    expect(b.construction).toEqual(quote.materials);
    p.inventory = { ...quote.materials };
    act(w, p.id, { type: 'supply', building: b.id });
    b.stock.fuel = 1;
    b.investment = 10000;
    const worker = addPlayer(w, 'worker', 'Pump operator');
    worker.x = b.x;
    worker.z = b.z - 10;
    worker.skills = ['pump operator'];
    act(w, worker.id, { type: 'job', building: b.id });
    // A lone operator is half of the ideal two-person crew.
    advance(w, 600);
    expect(b.stock.water ?? 0).toBe(0);
    advance(w, 600);
    expect(b.stock.water).toBe(12);
    expect(b.stock.fuel).toBe(0);
    // Move onto dry ground to inspect the original pump house and intake fittings.
    p.x = -8;
    p.z = 128;
    p.heading = 0.35;
    p.y = terrainHeight(w, p.x, p.z);
    if (await page.getByRole('button', { name: 'Close dialog' }).isVisible())
      await page.getByRole('button', { name: 'Close dialog' }).click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: 'test-results/shoreline-waterworks.png' });
    await page.keyboard.press('F9');
    await page.getByRole('button', { name: 'Directory', exact: true }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /Shoreline waterworks/ })
      .click();
    await expect(page.getByRole('dialog')).toContainText('12 Water');
    await expect(page.getByRole('dialog')).toContainText('pump operator');
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
