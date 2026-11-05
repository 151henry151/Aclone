// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { expandPuddlewickIsland } from '../../src/server/puddlewick-island';
import { creatorSchema } from '../../src/shared/creator';
import { terrainHeight } from '../../src/shared/terrain';
import { waitForWorld } from './fixtures/ready';

test('Alpine rules update near and distant snow, persist and reject invalid bounds', async ({
  page,
}) => {
  test.setTimeout(240000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-alpine-weather-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Alpine walker');
    const w = createWorld('puddlewick', 'Alpine weather audit', 'server');
    w.settings.mapSize = 18500;
    w.terrainMapSize = 12500;
    w.townLayout = 2;
    expandPuddlewickIsland(w);
    w.id = 'alpine-weather-audit';
    w.owner = account.id;
    w.script = '';
    w.buildings = [];
    w.creator = creatorSchema.parse({ scenery: false, weather: 'clear' });
    w.settings.dayLength = 0;
    w.settings.time = 43200;
    w.time = 130 * 600;
    w.climate = { snow: 0, snowDepth: 0, wetness: 0, snowModel: 1 };
    const p = addPlayer(w, account.id, account.name);
    const mountain = w.northernIsland!.mountain;
    Object.assign(p, {
      vehicle: 5,
      x: mountain.x,
      z: mountain.z,
      y: terrainHeight(w, mountain.x, mountain.z),
      engine: false,
    });
    app.worlds.set(w.id, w);
    // Observe the real application's scene without changing its behavior.
    await page.route('**/src/client/main.ts*', async (route) => {
      const response = await route.fetch();
      const observe = `import {GameScene as AuditScene} from '/src/client/scene.ts';
const auditSetWorld=AuditScene.prototype.setWorld;
AuditScene.prototype.setWorld=function(...args){globalThis.__alpineScene=this;return auditSetWorld.apply(this,args)};\n`;
      await route.fulfill({ response, body: observe + (await response.text()) });
    });
    for (const file of ['materials', 'horizon-land'])
      await page.route(`**/src/client/${file}.ts*`, async (route) => {
        const response = await route.fetch();
        let body = await response.text();
        body = body.replace(
          file === 'materials'
            ? 'mat.onBeforeCompile = (shader) => {'
            : 'material.onBeforeCompile = (shader) => {',
          file === 'materials'
            ? 'mat.onBeforeCompile = (shader) => { mat.userData.auditUniforms=shader.uniforms;'
            : 'material.onBeforeCompile = (shader) => { material.userData.auditUniforms=shader.uniforms;',
        );
        await route.fulfill({ response, body });
      });
    await page.addInitScript(
      ({ token, world }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', world);
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token, world: w.id },
    );
    const port = await app.listen();
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    mkdirSync('output/alpine-rules/browser', { recursive: true });
    const edit = async () => {
      await page.keyboard.press('F10');
      await page.getByRole('button', { name: 'Rules', exact: true }).click();
    };
    const close = () => page.getByRole('button', { name: 'Close dialog', exact: true }).click(),
      apply = () =>
        page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    const group = page.getByRole('group', { name: 'Alpine climate', exact: true });
    await edit();
    await expect(group.locator('[name="alpineSnowStart"]')).toHaveValue('1180');
    await close();
    const uniforms = () =>
      page.evaluate(() => {
        const s = (window as any).__alpineScene;
        const near = s.ground.meshes.find((m: any) => m.material.userData.auditUniforms)?.material;
        const far = s.horizon.group.children.find(
          (m: any) => m.material?.userData.auditUniforms,
        )?.material;
        return [near, far].map((m) => {
          const u = m?.userData.auditUniforms;
          return u
            ? {
                id: m.uuid,
                enabled: u.alpineEnabled.value,
                start: u.alpineSnowStart?.value,
                full: u.alpineSnowFull?.value,
                seasonal: u.snowCover.value,
              }
            : null;
        });
      });
    await expect.poll(async () => (await uniforms()).map((u) => u?.enabled)).toEqual([1, 1]);
    await page.screenshot({ path: 'output/alpine-rules/browser/snowy.png' });
    const before = await uniforms();
    await edit();
    await group.locator('[name="alpineSnowStart"]').fill('500');
    await group.locator('[name="alpineSnowFull"]').fill('700');
    await apply();
    await close();
    await expect
      .poll(async () => (await uniforms()).map((u) => [u?.start, u?.full]))
      .toEqual([
        [500, 700],
        [500, 700],
      ]);
    expect((await uniforms()).map((u) => u?.id)).toEqual(before.map((u) => u?.id));
    await edit();
    await group.locator('[name="alpinePermanentSnow"]').uncheck();
    await apply();
    await close();
    await expect.poll(async () => (await uniforms()).map((u) => u?.enabled)).toEqual([0, 0]);
    await page.screenshot({ path: 'output/alpine-rules/browser/disabled.png' });
    await page.reload();
    await waitForWorld(page);
    await edit();
    await expect(group.locator('[name="alpinePermanentSnow"]')).not.toBeChecked();
    await expect(group.locator('[name="alpineSnowStart"]')).toHaveValue('500');
    await expect(group.locator('[name="alpineSnowFull"]')).toHaveValue('700');
    await group.locator('[name="alpineSnowStart"]').fill('900');
    await group.locator('[name="alpineSnowFull"]').fill('600');
    await apply();
    await expect(page.locator('#toast')).toContainText(/snow/i);
    expect((app.worlds.get(w.id)!.settings as any).alpineSnowStart).toBe(500);
    expect((app.worlds.get(w.id)!.settings as any).alpineSnowFull).toBe(700);
    await page.screenshot({ path: 'output/alpine-rules/browser/invalid.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
