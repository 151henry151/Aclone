// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('owners tune lessons and relief, and players see the changed school and labour terms', async ({
  page,
}) => {
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-survival-rules-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Survival owner'),
      w = createWorld('survival-ui', 'Survival rules', account.id);
    w.script = '';
    w.towns = [];
    w.roads = [];
    Object.assign(w.settings, {
      mapSize: 500,
      seaLevel: -10,
      hungerRate: 0,
      thirstRate: 0,
      dayLength: 0,
      time: 43200,
      maxSkills: 1,
    });
    w.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
    w.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array(1089).fill(0),
    };
    const school = makeBuilding('test-school', 'school', 0, 0),
      office = makeBuilding('test-office', 'workhouse', 80, 0);
    school.name = 'Test school';
    office.name = 'Test Odd Jobs';
    w.buildings = [school, office];
    const p = addPlayer(w, account.id, account.name);
    Object.assign(p, { x: 0, y: 0, z: 10, vehicle: 0, engine: false, cash: 100000, bank: 0 });
    app.worlds.set(w.id, w);
    const port = await app.listen();
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'survival-ui');
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    const group = page.getByRole('group', { name: 'Survival and needs', exact: true });
    await expect(group).toBeVisible();
    for (const [key, value] of Object.entries({
      schoolFirstPrice: 2500,
      schoolFirstSeconds: 8,
      schoolLaterPrice: 5000,
      schoolLaterSeconds: 16,
      labourReliefPay: 4321,
      labourReliefMeans: 150000,
      labourReliefCooldown: 60,
      labourShiftSeconds: 5,
    }))
      await group.locator(`[name="${key}"]`).fill(String(value));
    await group.locator('[name="licencesCountSkills"]').uncheck();
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w.settings.schoolFirstPrice).toBe(2500);
    await page.keyboard.press('Escape');
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    await expect(group.locator('[name="schoolLaterSeconds"]')).toHaveValue('16');
    await expect(group.locator('[name="licencesCountSkills"]')).not.toBeChecked();
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/survival-school-rules.png' });
    await page.keyboard.press('Escape');
    await page.keyboard.press('e');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Test school');
    await expect(dialog).toContainText('8 seconds');
    await expect(dialog).toContainText('16 seconds');
    const miller = dialog.locator('[data-do="learn"][data-id="miller"]');
    await expect(miller).toContainText('25d');
    await miller.click();
    await expect.poll(() => p.learning?.skill).toBe('miller');
    expect(p.cash).toBe(97500);
    await expect.poll(() => p.skills.includes('miller'), { timeout: 20000 }).toBe(true);
    await page.keyboard.press('Escape');
    await page.keyboard.press('e');
    await expect(dialog.locator('[data-do="learn"][data-id="farmer"]')).toBeDisabled();
    await expect(dialog.locator('[data-do="learn"][data-id="pilot"]')).toBeEnabled();
    await expect(dialog).toContainText('licences do not');
    await page.screenshot({ path: 'test-results/survival-school-limit.png' });
    await dialog.locator('[data-do="learn"][data-id="pilot"]').click();
    await expect.poll(() => p.learning?.skill).toBe('pilot');
    expect(p.cash).toBe(92500);
    await page.keyboard.press('Escape');
    Object.assign(p, { x: office.x, z: office.z + 10 });
    await expect(page.locator('#target')).toContainText('Test Odd Jobs');
    await page.keyboard.press('e');
    await expect(dialog).toContainText('5-second');
    await expect(dialog).toContainText('43.21d');
    await expect(dialog).toContainText('1 minutes');
    await page.screenshot({ path: 'test-results/survival-relief.png' });
    const cash = p.cash;
    await dialog.locator('[data-do="task"][data-id="labour"]').click();
    await expect.poll(() => p.task?.kind).toBe('labour');
    expect(p.task!.end - w.time).toBeGreaterThan(0);
    expect(p.task!.end - w.time).toBeLessThanOrEqual(5);
    await expect.poll(() => p.cash, { timeout: 15000 }).toBe(cash + 4321);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
