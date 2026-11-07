// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test.use({ video: { mode: 'on', size: { width: 1440, height: 900 } } });
test('nearby pilot labels stay quiet, fade with proximity, and follow live world-builder rules', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-tags-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const { account, token } = app.universe.register('Ada Turnip');
  const initial = createWorld('pilot-tags', 'Village neighbours', account.id);
  initial.script = '';
  initial.roads = [];
  initial.towns = [];
  initial.zones = [];
  initial.buildings = [];
  initial.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array(1089).fill(0),
  };
  initial.creator = creatorSchema.parse({
    roads: false,
    scenery: false,
    weather: 'clear',
    models: [
      {
        id: 'rover',
        name: 'Local rover',
        width: 3,
        height: 2,
        depth: 4,
        parts: [{ shape: 'box', color: '#7b503a', sx: 3, sy: 1, sz: 4 }],
      },
    ],
    vehicleModels: { 24: 'rover' },
  });
  Object.assign(initial.settings, {
    mapSize: 1000,
    seaLevel: -10,
    time: 43200,
    dayLength: 0,
    hungerRate: 0,
    thirstRate: 0,
  });
  for (const [id, name, x, z, vehicle, npc] of [
    [account.id, account.name, 0, 0, 5, false],
    ['near', 'Rowan', 0.8, 8, 5, false],
    ['npc', 'Mabel', -0.8, 8, 5, true],
    ['middle', 'Distant neighbour', 0, 30, 0, false],
    ['far', 'Faraway pilot', 0, 80, 0, false],
    ['custom', 'Pat', 8, 10, 24, false],
  ] as const)
    Object.assign(addPlayer(initial, id, name), {
      x,
      z,
      y: 0,
      vehicle,
      npc,
      speed: 0,
      engine: false,
      heading: 0,
    });
  app.worlds.set(initial.id, initial);
  const w = () => app.worlds.get(initial.id)!;
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  mkdirSync('output/pilot-labels', { recursive: true });
  try {
    const port = await app.listen();
    await page.route('**/src/client/main.ts', async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body: (await response.text()) + '\nglobalThis.__tagScene=scene;\n',
      });
    });
    await page.addInitScript(
      ({ token, world }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', world);
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token, world: initial.id },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    const read = (id: string) =>
      page.evaluate((id) => {
        const s = (globalThis as any).__tagScene,
          tag = s.meshes.get(id)?.userData.pilotLabel;
        return tag
          ? {
              visible: tag.visible,
              opacity: tag.material.opacity,
              depth: tag.material.depthTest,
              height: tag.scale.y,
            }
          : null;
      }, id);
    await expect.poll(async () => (await read('near'))?.opacity).toBe(0.8);
    await expect.poll(async () => (await read('middle'))?.opacity).toBeCloseTo(0.4, 2);
    await expect.poll(async () => (await read('far'))?.visible).toBe(false);
    expect((await read('npc'))?.visible).toBe(true);
    expect((await read('custom'))?.depth).toBe(true);
    w().players.custom.x = 80;
    await expect.poll(async () => (await read('custom'))?.visible).toBe(false);
    await page.keyboard.press('h');
    await expect.poll(async () => (await read('near'))?.visible).toBe(false);
    await page.keyboard.press('h');
    await expect.poll(async () => (await read('near'))?.visible).toBe(true);
    await page.keyboard.press('c');
    await expect(page.locator('#toast')).toHaveCSS('opacity', '0');
    await page.screenshot({ path: 'output/pilot-labels/nearby-names.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('#clock')).not.toContainText('Day');
    await page.screenshot({ path: 'output/pilot-labels/phone-names.png' });
    await page.setViewportSize({ width: 1440, height: 900 });
    const edit = async () => {
      await page.keyboard.press('F10');
      await page.getByRole('button', { name: 'Rules', exact: true }).click();
    };
    const apply = () =>
      page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    const close = () => page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await edit();
    const group = page.getByRole('group', { name: 'Pilot name tags', exact: true });
    await group.locator('[name="pilotNameTagRange"]').fill('12');
    await group.locator('[name="pilotNameTagFadeStart"]').fill('6');
    await group.locator('[name="pilotNameTagOpacity"]').fill('0.5');
    await apply();
    await expect.poll(() => (w().settings as any).pilotNameTagRange).toBe(12);
    await close();
    await expect.poll(async () => (await read('middle'))?.visible).toBe(false);
    expect((await read('near'))!.opacity).toBeLessThan(0.5);
    await edit();
    await group.locator('[name="pilotNameTagFadeStart"]').fill('13');
    await apply();
    await expect(page.locator('#toast')).toContainText('Fade start');
    expect((w().settings as any).pilotNameTagFadeStart).toBe(6);
    await group.locator('[name="pilotNameTagFadeStart"]').fill('6');
    await group.locator('[name="pilotNameTags"]').uncheck();
    await apply();
    await expect.poll(() => (w().settings as any).pilotNameTags).toBe(false);
    await close();
    for (const id of ['near', 'npc', 'custom', 'middle', 'far'])
      await expect.poll(async () => (await read(id))?.visible).toBe(false);
    await expect(page.locator('#world-hud')).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
