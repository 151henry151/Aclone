// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { expandPuddlewickIsland } from '../../src/server/puddlewick-island';
import { terrainHeight } from '../../src/shared/terrain';
import { constructionSiteReason } from '../../src/shared/construction-site';
import { sceneryChunk } from '../../src/shared/scenery-obstacles';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';

test('grade a natural northern hillside, clear trees, meet a road and build using controller and touch controls', async ({
  page,
}) => {
  test.setTimeout(300000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-hillside-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true }),
    evidence = 'output/earthworks/hillside';
  mkdirSync(evidence, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Hillside builder');
    const w = createWorld('puddlewick', 'Northern earthworks', 'world-owner');
    expandPuddlewickIsland(w);
    w.script = '';
    w.creator = creatorSchema.parse({ weather: 'clear' });
    // Real island geometry and protections, with bounded, valid work rates for the test.
    Object.assign(w.settings, {
      dayLength: 0,
      time: 43200,
      hungerRate: 0,
      thirstRate: 0,
      arrivalAnimation: 'off',
      vehiclesPersist: true,
      earthworksDozerVolume: 10,
      earthworksWorkingSpeed: 2,
      earthworksStoneEffort: 1,
      earthworksFillVolume: 100,
      vehicleMaintenance: false,
    });
    const x = 984,
      z = -7432,
      target = terrainHeight(w, x, z) + 0.2;
    w.roads = [
      ...(w.roads ?? []),
      { a: { x: x + 23, z: z - 40 }, b: { x: x + 23, z: z + 40 }, width: 4 },
    ];
    const p = addPlayer(w, account.id, account.name);
    Object.assign(p, {
      x,
      z,
      y: terrainHeight(w, x, z),
      heading: 0,
      vehicle: 38,
      fleet: [0, 5, 38],
      skills: ['plant operator'],
      engine: true,
      fuel: 200,
      fuelVehicle: 38,
      online: true,
      inventory: { dirt: 2 },
      cash: 30_000_000,
    });
    expect(p.authority).toBeLessThan(20);
    expect(
      constructionSiteReason(w, { id: 'construction', kind: 'home', x, z, rotation: 0 }, p),
    ).toMatch(/^Ground rises/);
    const nearby = () => [...sceneryChunk(w, 3, -30), ...sceneryChunk(w, 3, -29)];
    const removed = nearby().filter((o) => Math.abs(o.x - x) < 19 && Math.abs(o.z - z) < 19);
    expect(removed.some((o) => o.kind === 'tree')).toBe(true);
    const roadSamples = Array.from({ length: 17 }, (_, i) => ({ x: x + 21, z: z - 40 + i * 5 }));
    const roadBefore = roadSamples.map((at) => terrainHeight(w, at.x, at.z));
    app.worlds.set(w.id, w);
    const port = await app.listen();
    await page.addInitScript(
      ({ token, id }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', id);
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
        const pad = {
          connected: true,
          axes: [0, 0, 0, 0],
          buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
        };
        (window as any).__testPad = pad;
        Object.defineProperty(navigator, 'getGamepads', { value: () => [pad] });
      },
      { token, id: w.id },
    );
    // Read rendered geometry without adding a debug API to the shipped client.
    await page.route('**/src/client/main.ts', async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body: (await response.text()) + '\nwindow.__earthScene=scene;',
      });
    });
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    const press = async (button: number, down: boolean) => {
      await page.evaluate(
        ({ button, down }) => {
          (window as any).__testPad.buttons[button].pressed = down;
        },
        { button, down },
      );
      await page.waitForTimeout(160);
    };
    // Default X/Square operates once while held, then the settings UI remaps it.
    await press(2, true);
    await expect.poll(() => p.earthmovingImplement).toBe(true);
    await page.waitForTimeout(400);
    expect(p.earthmovingImplement).toBe(true);
    await press(2, false);
    await press(2, true);
    await expect.poll(() => p.earthmovingImplement).toBe(false);
    await press(2, false);
    await page.keyboard.press('F9');
    await page.getByRole('button', { name: 'Controller settings', exact: true }).click();
    await page.locator('#controller-settings [name="implement"]').fill('3');
    await press(2, true);
    expect(p.earthmovingImplement).toBe(false);
    await press(2, false);
    await page.getByRole('button', { name: 'Save controller bindings', exact: true }).click();
    expect(
      await page.evaluate(() => JSON.parse(localStorage.getItem('aclone.controller')!).implement),
    ).toBe(3);
    await press(2, true);
    expect(p.earthmovingImplement).toBe(false);
    await press(2, false);
    await press(3, true);
    await expect.poll(() => p.earthmovingImplement).toBe(true);
    await press(3, false);
    await page.setViewportSize({ width: 430, height: 900 });
    await page.keyboard.press('i');
    await page.getByRole('button', { name: 'Raise implement (G)', exact: true }).click();
    await expect.poll(() => p.earthmovingImplement).toBe(false);
    await page.getByRole('button', { name: 'Lower implement (G)', exact: true }).click();
    await expect.poll(() => p.earthmovingImplement).toBe(true);
    await page.screenshot({ path: evidence + '/touch-implement.png' });
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('button', { name: 'Build', exact: true }).click();
    await expect(page.locator('[data-build-estimate]')).toContainText('Ground rises');
    await expect(
      page.getByRole('button', { name: 'Place foundation', exact: true }),
    ).toBeDisabled();
    await page.getByRole('button', { name: 'Earthworks', exact: true }).click();
    const root = page.locator('[data-earthworks-panel]');
    for (const [name, value] of Object.entries({
      width: '16',
      depth: '16',
      target: String(target),
      shoulder: '16',
    }))
      await root.locator(`[name="${name}"]`).fill(value);
    await expect(root.locator('[data-earthwork-survey]')).toContainText('clear of roads');
    await expect(root.getByRole('button', { name: 'Confirm pad', exact: true })).toBeDisabled();
    await root.locator('[name="shoulder"]').fill('12');
    await expect(root.getByRole('button', { name: 'Confirm pad', exact: true })).toBeEnabled();
    await page.screenshot({ path: evidence + '/survey.png' });
    await root.getByRole('button', { name: 'Confirm pad', exact: true }).click();
    await expect.poll(() => w.earthworks?.length).toBe(1);
    const site = root.locator('[data-earthwork-site]');
    await site.locator('[name="quantity"]').fill('2');
    await site.getByRole('button', { name: 'Deliver fill', exact: true }).click();
    await expect.poll(() => w.earthworks![0].work!.delivered).toBe(200);
    await expect(site).toContainText('Fill supplied');
    await page.keyboard.press('Escape');
    // Capture actual streamed instance transforms and stable distant chunk IDs.
    await expect
      .poll(() =>
        page.evaluate(
          () => !!(window as any).__earthScene.scene.getObjectByName('Countryside 3,-30'),
        ),
      )
      .toBe(true);
    const rendered = () =>
      page.evaluate(
        (points) => {
          const scene = (window as any).__earthScene.scene;
          const positions: { x: number; z: number }[] = [],
            chunks: Record<string, string> = {};
          scene.traverse((o: any) => {
            if (o.name.startsWith('Countryside ')) chunks[o.name] = o.uuid;
            if (o.isInstancedMesh && o.parent?.name.startsWith('Countryside ')) {
              const a = o.instanceMatrix.array;
              for (let i = 0; i < o.count; i++)
                positions.push({ x: a[i * 16 + 12], z: a[i * 16 + 14] });
            }
          });
          return {
            chunks,
            present: points.map((p) =>
              positions.some((at) => Math.hypot(at.x - p.x, at.z - p.z) < 0.01),
            ),
          };
        },
        removed.map(({ x, z }) => ({ x, z })),
      );
    await expect.poll(async () => (await rendered()).present.some(Boolean)).toBe(true);
    const before = await rendered();
    await page.keyboard.press('c');
    await page.keyboard.press('c');
    await page.mouse.move(650, 450);
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(800);
    await page.screenshot({ path: evidence + '/before.png' });
    for (let i = 0; i < 24 && w.earthworks![0].progress < 1; i++) {
      const forward = p.z < z,
        key = forward ? 'w' : 's';
      await page.keyboard.down(key);
      await expect
        .poll(() => w.earthworks![0].progress === 1 || (forward ? p.z >= z + 3 : p.z <= z - 3), {
          timeout: 15000,
          intervals: [150],
        })
        .toBe(true);
      await page.keyboard.up(key);
      await page.waitForTimeout(300);
    }
    await expect.poll(() => w.earthworks![0].progress).toBe(1);
    expect(nearby().filter((o) => removed.some((old) => old.id === o.id))).toEqual([]);
    await expect.poll(async () => (await rendered()).present.some(Boolean)).toBe(false);
    const after = await rendered();
    const far = Object.keys(before.chunks).filter(
      (name) => !['Countryside 3,-30', 'Countryside 3,-29'].includes(name),
    );
    expect(far.length).toBeGreaterThan(0);
    expect(far.every((name) => after.chunks[name] === before.chunks[name])).toBe(true);
    expect(roadSamples.map((at) => terrainHeight(w, at.x, at.z))).toEqual(roadBefore);
    for (const dx of [-6, 0, 6])
      for (const dz of [-6, 0, 6]) expect(terrainHeight(w, x + dx, z + dz)).toBeCloseTo(target, 5);
    await page.screenshot({ path: evidence + '/graded-road.png' });
    // Return toward the centre using input, so the whole house fits inside the pad.
    if (Math.abs(p.z - z) > 0.4) {
      const forward = p.z < z,
        key = forward ? 'w' : 's';
      await page.keyboard.down(key);
      await expect
        .poll(() => (forward ? p.z >= z - 0.4 : p.z <= z + 0.4), {
          timeout: 10000,
          intervals: [100],
        })
        .toBe(true);
      await page.keyboard.up(key);
      await page.waitForTimeout(500);
    }
    await page.getByRole('button', { name: 'Build', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Place foundation', exact: true })).toBeEnabled();
    const n = w.buildings.length;
    await page.getByRole('button', { name: 'Place foundation', exact: true }).click();
    await expect.poll(() => w.buildings.length).toBe(n + 1);
    const built = w.buildings.find((b) => b.owner === p.id)!;
    expect(built.foundationY).toBeCloseTo(target + 0.04, 4);
    await page.screenshot({ path: evidence + '/foundation.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
