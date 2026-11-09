// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';

test('a client posts and a mobile operator accepts, refunds, resumes and earns an earthworks fee', async ({
  page,
  browser,
}) => {
  test.setTimeout(240000);
  page.setDefaultTimeout(10000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-earth-contract-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true }),
    mobile = await browser.newContext({ viewport: { width: 430, height: 900 } }),
    operatorPage = await mobile.newPage();
  operatorPage.setDefaultTimeout(10000);
  mkdirSync('output/earthworks/contracts', { recursive: true });
  const errors: string[] = [];
  for (const p of [page, operatorPage]) p.on('pageerror', (e) => errors.push(e.message));
  try {
    const client = app.universe.register('Earthwork client'),
      operator = app.universe.register('Earthwork operator');
    let w = createWorld('contracts-browser', 'Earthworks contracts', client.account.id);
    Object.assign(w, { buildings: [], towns: [], roads: [], terrain: [], zones: [], script: '' });
    Object.assign(w.settings, {
      mapSize: 500,
      seaLevel: -40,
      dayLength: 0,
      time: 43200,
      arrivalAnimation: 'off',
      hungerRate: 0,
      thirstRate: 0,
      vehicleMaintenance: false,
      earthworksDozerVolume: 10,
      earthworksWorkingSpeed: 2,
      vehiclesPersist: true,
    });
    w.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
    w.landscape = {
      paths: [],
      surfaces: [],
      scatter: [],
      barriers: [],
      heightmap: Array(1089).fill(10),
    };
    const clientPlayer = addPlayer(w, client.account.id, client.account.name);
    Object.assign(clientPlayer, { x: 80, z: 80, y: 10, vehicle: 5, cash: 50000, online: true });
    let op = addPlayer(w, operator.account.id, operator.account.name);
    Object.assign(op, {
      x: 83,
      z: 80,
      y: 10,
      vehicle: 38,
      fleet: [0, 5, 38],
      skills: [],
      fuel: 200,
      fuelVehicle: 38,
      engine: true,
      online: true,
      cash: 10000,
      heading: 0,
    });
    app.worlds.set(w.id, w);
    const port = await app.listen();
    for (const [p, account] of [
      [page, client],
      [operatorPage, operator],
    ] as const) {
      await p.addInitScript(
        ({ token, world }) => {
          localStorage.setItem('aclone.pilot', token);
          localStorage.setItem('aclone.world', world);
          localStorage.setItem('aclone.sound', 'off');
          localStorage.setItem('aclone.quality', 'low');
        },
        { token: account.token, world: w.id },
      );
      await p.goto(`http://127.0.0.1:${port}`);
      await waitForWorld(p);
    }
    await operatorPage.keyboard.press('F9');
    await operatorPage.getByRole('button', { name: 'Earthworks contracts', exact: true }).click();
    await expect(operatorPage.locator('[data-earthworks-panel]')).toContainText(
      'No earthwork sites',
    );
    await operatorPage.getByText('Survey a new pad', { exact: true }).click();
    await page.getByRole('button', { name: 'Build', exact: true }).click();
    await page.getByRole('button', { name: 'Earthworks', exact: true }).click();
    const root = page.locator('[data-earthworks-panel]');
    for (const [name, value] of Object.entries({ x: '80', width: '8', depth: '8', target: '9' }))
      await root.locator(`[name="${name}"]`).fill(value);
    await root.getByRole('button', { name: 'Confirm pad', exact: true }).click();
    await expect.poll(() => w.earthworks?.length).toBe(1);
    await root.getByText('Survey a new pad', { exact: true }).click();
    const site = root.locator('[data-earthwork-site]'),
      remote = operatorPage.locator('[data-earthwork-site]');
    await site.locator('[name="feeDenarii"]').fill('100');
    await site.locator('[name="fillBy"]').selectOption('operator');
    await site.getByRole('button', { name: 'Post contract', exact: true }).click();
    await expect.poll(() => w.earthworks![0].work!.contract?.state).toBe('offered');
    expect(clientPlayer.cash).toBe(50000);
    await expect(remote).toContainText('Operator supplies fill');
    await page.screenshot({ path: 'output/earthworks/contracts/client-offer.png' });
    await remote.getByRole('button', { name: 'Accept contract', exact: true }).click();
    await expect(operatorPage.locator('#toast')).toContainText('plant');
    w = app.worlds.get(w.id)!;
    op = w.players[operator.account.id];
    op.skills = ['plant operator'];
    await remote.getByRole('button', { name: 'Accept contract', exact: true }).click();
    await expect.poll(() => w.earthworks![0].work!.contract?.state).toBe('accepted');
    expect(w.players[client.account.id].cash).toBe(40000);
    await expect(remote).toContainText('Accepted by Earthwork operator');
    await expect(remote).toContainText('Held: 100d');
    await operatorPage.screenshot({ path: 'output/earthworks/contracts/mobile-accepted.png' });
    await remote.getByRole('button', { name: 'Abandon work', exact: true }).click();
    await expect.poll(() => w.players[client.account.id].cash).toBe(50000);
    await remote.getByRole('button', { name: 'Accept contract', exact: true }).click();
    await expect.poll(() => w.earthworks![0].work!.contract?.state).toBe('accepted');
    await operatorPage.keyboard.press('Escape');
    if (!op.engine) await operatorPage.keyboard.press('F4');
    await operatorPage.keyboard.press('g');
    await expect.poll(() => op.earthmovingImplement).toBe(true);
    for (let i = 0; i < 16 && w.earthworks![0].progress < 1; i++) {
      const forward = op.z < 80,
        key = forward ? 'w' : 's';
      await operatorPage.keyboard.down(key);
      await expect
        .poll(() => w.earthworks![0].progress === 1 || (forward ? op.z >= 82.5 : op.z <= 77.5), {
          timeout: 20000,
          intervals: [150],
        })
        .toBe(true);
      await operatorPage.keyboard.up(key);
      await operatorPage.waitForTimeout(300);
    }
    await expect.poll(() => w.earthworks![0].work!.contract?.state).toBe('complete');
    expect(op.cash).toBe(20000);
    expect(w.players[client.account.id].cash).toBe(40000);
    await expect(site).toContainText('Paid');
    await page.screenshot({ path: 'output/earthworks/contracts/paid.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await mobile.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a property owner can decline a survey, sees a protected-site refusal, and confirms a clear request', async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(10000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-earth-permission-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true }),
    context = await browser.newContext({ viewport: { width: 430, height: 900 } }),
    ownerPage = await context.newPage();
  ownerPage.setDefaultTimeout(10000);
  try {
    const client = app.universe.register('Survey client'),
      owner = app.universe.register('Property neighbour');
    let w = createWorld('permission-browser', 'Earthworks permissions', 'world-owner');
    Object.assign(w, { buildings: [], towns: [], roads: [], zones: [], terrain: [], script: '' });
    Object.assign(w.settings, {
      mapSize: 500,
      seaLevel: -40,
      dayLength: 0,
      time: 43200,
      arrivalAnimation: 'off',
      hungerRate: 0,
      thirstRate: 0,
      constructionMinimumSpacing: 40,
    });
    w.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
    w.landscape = {
      paths: [],
      surfaces: [],
      scatter: [],
      barriers: [],
      heightmap: Array(1089).fill(10),
    };
    const { makeBuilding } = await import('../../src/shared/simulation');
    const home = makeBuilding('neighbour-home', 'home', 120, 80);
    home.owner = owner.account.id;
    w.buildings.push(home);
    for (const a of [client, owner]) {
      const p = addPlayer(w, a.account.id, a.account.name);
      Object.assign(p, { x: a === client ? 80 : 140, z: 80, y: 10, vehicle: 5, online: true });
    }
    app.worlds.set(w.id, w);
    const port = await app.listen();
    for (const [p, a] of [
      [page, client],
      [ownerPage, owner],
    ] as const) {
      await p.addInitScript(
        ({ token, id }) => {
          localStorage.setItem('aclone.pilot', token);
          localStorage.setItem('aclone.world', id);
          localStorage.setItem('aclone.quality', 'low');
          localStorage.setItem('aclone.sound', 'off');
        },
        { token: a.token, id: w.id },
      );
      await p.goto(`http://127.0.0.1:${port}`);
      await waitForWorld(p);
      await p.keyboard.press('F9');
      await p.getByRole('button', { name: 'Directory', exact: true }).click();
      await p.getByRole('button', { name: 'Earthworks contracts', exact: true }).click();
    }
    const root = page.locator('[data-earthworks-panel]'),
      remote = ownerPage.locator('[data-earthwork-site]');
    for (const [name, value] of Object.entries({ width: '8', depth: '8', target: '9' }))
      await root.locator(`[name="${name}"]`).fill(value);
    await root.getByRole('button', { name: 'Confirm pad', exact: true }).click();
    await expect.poll(() => w.earthworks?.[0]?.work?.pendingApproval).toBe(true);
    await expect(remote).toContainText('target 9 m');
    await remote.getByRole('button', { name: 'Decline survey', exact: true }).click();
    await expect.poll(() => w.earthworks?.length).toBe(0);
    await root.getByRole('button', { name: 'Confirm pad', exact: true }).click();
    await expect.poll(() => w.earthworks?.[0]?.work?.pendingApproval).toBe(true);
    w.zones.push({ id: 'protected', kind: 'noBuild', x: 80, z: 80, radius: 20 } as any);
    await remote.getByRole('button', { name: 'Confirm property permission', exact: true }).click();
    await expect(ownerPage.locator('#toast')).toContainText('no-build');
    w = app.worlds.get(w.id)!;
    expect(w.earthworks![0].work!.pendingApproval).toBe(true);
    expect(w.earthworks![0].progress).toBe(0);
    w.zones = [];
    await remote.getByRole('button', { name: 'Confirm property permission', exact: true }).click();
    await expect.poll(() => w.earthworks![0].work!.pendingApproval).toBe(false);
    await expect(root.locator('[data-earthwork-site]')).toContainText('Reserved');
    await root.getByText('Survey a new pad', { exact: true }).click();
    await page.screenshot({ path: 'output/earthworks/contracts/property-approved.png' });
  } finally {
    await page.close();
    await context.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
