// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { terrainHeight } from '../../src/shared/terrain';
import { waitForWorld } from './fixtures/ready';

test('coast launch, keyboard paddling, beaching and reboarding retain one hull; no-water and hold limits explain refusals', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-canoe-water-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Paddler'),
      w = createWorld('canoe-water', 'Canoe water', account.id);
    w.script = '';
    w.buildings = [];
    w.roads = [];
    w.towns = [];
    Object.assign(w.settings, {
      mapSize: 500,
      seaLevel: 0,
      tidalRange: 0,
      oceanWaves: 0,
      hungerRate: 0,
      thirstRate: 0,
      dayLength: 0,
      time: 43200,
    });
    w.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
    w.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array.from({ length: 1089 }, (_, i) => (16 - (i % 33)) * 2),
    };
    const p = addPlayer(w, account.id, account.name);
    Object.assign(p, {
      x: -1,
      z: -40,
      y: terrainHeight(w, -1, -40),
      heading: 0,
      vehicle: 5,
      inventory: { canoe: 1, fuel: 13 },
      speed: 0,
      engine: false,
    });
    app.worlds.set(w.id, w);
    const port = await app.listen();
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'canoe-water');
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await page.keyboard.press('i');
    const panel = page.locator('.canoe-panel');
    await panel.getByRole('button', { name: 'Lift inventory canoe' }).click();
    await expect.poll(() => p.carrying).toBeTruthy();
    const id = p.carrying!;
    await expect(panel.getByRole('button', { name: 'Launch canoe', exact: true })).toBeDisabled();
    await expect(panel).toContainText('holds 12');
    p.inventory.fuel = 12;
    await expect(panel.getByRole('button', { name: 'Launch canoe', exact: true })).toBeEnabled();
    await panel.getByRole('button', { name: 'Launch canoe', exact: true }).click();
    await expect.poll(() => p.vehicle).toBe(34);
    await page.keyboard.press('Escape');
    const start = p.z;
    await page.keyboard.down('w');
    await page.waitForTimeout(2400);
    await page.keyboard.up('w');
    await expect.poll(() => p.z - start).toBeGreaterThan(1);
    await page.screenshot({ path: 'test-results/canoe-paddling.png' });
    await expect.poll(() => Math.abs(p.speed)).toBeLessThan(0.5);
    await page.keyboard.press('i');
    await panel.getByRole('button', { name: 'Beach canoe', exact: true }).click();
    await expect.poll(() => p.vehicle).toBe(5);
    expect(w.smallCraft![id].state).toBe('moored');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'test-results/canoe-moored.png' });
    await page.keyboard.press('i');
    await panel.getByRole('button', { name: 'Board canoe', exact: true }).click();
    await expect.poll(() => p.vehicle).toBe(34);
    expect(p.smallCraft).toBe(id);
    await panel.getByRole('button', { name: 'Beach canoe', exact: true }).click();
    await expect.poll(() => p.vehicle).toBe(5);
    await panel.getByRole('button', { name: 'Pick up canoe', exact: true }).click();
    await expect.poll(() => p.carrying).toBe(id);
    Object.assign(p, { x: -60, z: -40, y: terrainHeight(w, -60, -40), speed: 0 });
    await expect(panel.getByRole('button', { name: 'Launch canoe', exact: true })).toBeDisabled();
    await expect(panel).toContainText('No clear water');
    await page.screenshot({ path: 'test-results/canoe-no-water.png' });
    Object.assign(p, { x: -1, z: -40, y: terrainHeight(w, -1, -40), speed: 0 });
    await page.keyboard.press('Escape');
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    const rules = page.locator('#settings-form');
    await rules.locator('[name="canoeSpeed"]').fill('0.6');
    await rules.locator('[name="canoeCapacity"]').fill('2');
    await rules.locator('[name="canoeMinDepth"]').fill('1');
    await rules.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w.settings.canoeMinDepth).toBe(1);
    await rules
      .getByRole('group', { name: 'Portable canoes', exact: true })
      .evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: 'test-results/canoe-water-rules.png' });
    await page.keyboard.press('Escape');
    await page.keyboard.press('i');
    await expect(panel).toContainText('holds 2');
    p.inventory.fuel = 2;
    await expect(panel).toContainText('No clear water');
    await expect(panel.getByRole('button', { name: 'Launch canoe', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    await rules.locator('[name="canoeMinDepth"]').fill('0.08');
    await rules.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w.settings.canoeMinDepth).toBe(0.08);
    await page.keyboard.press('Escape');
    await page.keyboard.press('i');
    await panel.getByRole('button', { name: 'Launch canoe', exact: true }).click();
    await expect.poll(() => p.vehicle).toBe(34);
    await page.keyboard.press('Escape');
    await page.keyboard.down('w');
    await page.waitForTimeout(2400);
    expect(p.speed).toBeGreaterThan(0.5);
    expect(p.speed).toBeLessThanOrEqual(0.6);
    await page.keyboard.up('w');
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

import { expandPuddlewickIsland } from '../../src/server/puddlewick-island';
import { riverBanks } from '../../src/shared/inland-water';
import { canoeWater } from '../../src/shared/canoe-shore';
test('an elevated northern riverbank supports launch, keyboard paddling and beaching without a dock', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-canoe-river-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('River paddler'),
      w = createWorld('puddlewick', 'River canoe', account.id);
    w.settings.mapSize = 18500;
    w.terrainMapSize = 12500;
    w.townLayout = 2;
    expandPuddlewickIsland(w);
    w.buildings = [];
    w.script = '';
    w.roads = [];
    Object.assign(w.settings, {
      hungerRate: 0,
      thirstRate: 0,
      dayLength: 0,
      time: 43200,
      oceanWaves: 0,
      tidalRange: 0,
    });
    w.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
    const p = addPlayer(w, account.id, account.name);
    Object.assign(p, { vehicle: 5, speed: 0, inventory: { canoe: 1 } });
    const r = w.northernIsland!.rivers[0],
      banks = riverBanks(r.points);
    let found = false;
    for (let i = 3; i < r.points.length - 3 && !found; i++) {
      const at = r.points[i],
        prev = r.points[i - 1],
        heading = Math.atan2(prev.x - at.x, prev.z - at.z);
      if (at.level < w.settings.seaLevel + 5 || !canoeWater(w, at.x, at.z, heading)) continue;
      for (const side of ['left', 'right'] as const) {
        const bank = banks[i][side],
          len = Math.hypot(bank.x - at.x, bank.z - at.z),
          x = bank.x + ((bank.x - at.x) / len) * 0.5,
          z = bank.z + ((bank.z - at.z) / len) * 0.5,
          y = terrainHeight(w, x, z);
        if (y <= at.level || y - at.level > 1.5) continue;
        Object.assign(p, { x, z, y, heading });
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
    app.worlds.set(w.id, w);
    const port = await app.listen();
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'puddlewick');
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await page.keyboard.press('i');
    const panel = page.locator('.canoe-panel');
    await panel.getByRole('button', { name: 'Lift inventory canoe' }).click();
    await expect.poll(() => p.carrying).toBeTruthy();
    await panel.getByRole('button', { name: 'Launch canoe', exact: true }).click();
    await expect.poll(() => p.vehicle).toBe(34);
    const start = { x: p.x, z: p.z };
    await page.keyboard.press('Escape');
    await page.keyboard.down('w');
    await page.waitForTimeout(2200);
    await page.keyboard.up('w');
    await expect.poll(() => Math.hypot(p.x - start.x, p.z - start.z)).toBeGreaterThan(0.8);
    await page.screenshot({ path: 'test-results/canoe-river-paddling.png' });
    await expect.poll(() => Math.abs(p.speed)).toBeLessThan(0.5);
    await page.keyboard.press('i');
    await panel.getByRole('button', { name: 'Beach canoe', exact: true }).click();
    await expect.poll(() => p.vehicle).toBe(5);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'test-results/canoe-river-bank.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

import { act } from '../../src/shared/simulation';
test('a server restart preserves a bank-moored canoe and its real boarding control', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-canoe-restart-'));
  let app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const { account, token } = app.universe.register('Returning paddler'),
      w = createWorld('canoe-restart', 'Saved canoe', account.id);
    w.script = '';
    w.buildings = [];
    w.towns = [];
    w.roads = [];
    Object.assign(w.settings, {
      mapSize: 500,
      seaLevel: 0,
      tidalRange: 0,
      oceanWaves: 0,
      hungerRate: 0,
      thirstRate: 0,
      dayLength: 0,
      time: 43200,
    });
    w.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
    w.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array.from({ length: 1089 }, (_, i) => (16 - (i % 33)) * 2),
    };
    const p = addPlayer(w, account.id, account.name);
    Object.assign(p, {
      vehicle: 5,
      x: -1,
      z: -40,
      y: terrainHeight(w, -1, -40),
      heading: 0,
      speed: 0,
      inventory: { canoe: 1 },
    });
    act(w, p.id, { type: 'canoe', operation: 'carry' });
    const id = p.carrying!;
    w.smallCraft![id].paint = '#336699';
    act(w, p.id, { type: 'canoe', operation: 'launch' });
    act(w, p.id, { type: 'canoe', operation: 'beach' });
    const saved = structuredClone(w.smallCraft![id]);
    app.worlds.set(w.id, w);
    app.store.saveWorld(w);
    await app.close();
    app = await createApp({ dataDir: dir, port: 0, dev: true });
    const loaded = app.worlds.get(w.id)!;
    expect(loaded.smallCraft![id]).toEqual(saved);
    const restored = loaded.players[p.id],
      port = await app.listen();
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'canoe-restart');
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await page.keyboard.press('i');
    await page
      .locator('.canoe-panel')
      .getByRole('button', { name: 'Board canoe', exact: true })
      .click();
    await expect.poll(() => restored.smallCraft).toBe(id);
    expect(restored.vehicle).toBe(34);
    expect(loaded.smallCraft![id].paint).toBe('#336699');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'test-results/canoe-restarted.png' });
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
