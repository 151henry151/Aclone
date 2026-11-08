import { fuelCapacity } from '../../src/shared/tractors';
// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { addPlayer, act } from '../../src/shared/simulation';
import { completedBridgeSite } from '../fixtures/bridge-site';
import { travelHeight } from '../../src/shared/dock';
import { maintainBridges } from '../../src/shared/bridges';
import { DAY_SECONDS } from '../../src/shared/environment';
import { waitForWorld } from './fixtures/ready';
import type { Point } from '../../src/shared/town';

test.use({ video: { mode: 'on', size: { width: 1440, height: 900 } } });
test('enforce bridge passage, repair and removal while boats sail underneath', async ({ page }) => {
  test.setTimeout(240000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-bridge-access-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const fixture = completedBridgeSite(),
    initial = fixture.w,
    { a, b, point } = fixture;
  initial.id = 'bridge-access';
  initial.name = 'River crossing test';
  initial.script = '';
  initial.creator!.weather = 'clear';
  Object.assign(initial.settings, {
    dayLength: 0,
    time: 43200,
    hungerRate: 0,
    thirstRate: 0,
    arrivalAnimation: 'off',
    roadGrowthPerDay: 0,
    cityPaving: false,
    bridgeToll: 300,
  });
  const { account, token } = app.universe.register('River traveller');
  const owner = addPlayer(initial, 'owner', 'Bridge keeper');
  Object.assign(owner, point(0));
  owner.y = fixture.bridge.deckY;
  const initialPlayer = addPlayer(initial, account.id, account.name),
    heading = Math.atan2(b.x - a.x, b.z - a.z),
    ux = (b.x - a.x) / 40,
    uz = (b.z - a.z) / 40;
  Object.assign(initialPlayer, {
    x: fixture.bridge.approachA.x - ux * 7,
    z: fixture.bridge.approachA.z - uz * 7,
    heading,
    vehicle: 5,
    fleet: [0, 5, 33],
    cash: 1000000,
    inventory: {},
    speed: 0,
  });
  initialPlayer.y = travelHeight(initial, initialPlayer.x, initialPlayer.z);
  app.worlds.set(initial.id, initial);
  const world = () => app.worlds.get(initial.id)!,
    player = () => world().players[account.id],
    bridge = () => world().bridges![0];
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const evidence = 'output/player-bridges/access';
  mkdirSync(evidence, { recursive: true });
  const panel = page.getByRole('dialog', { name: 'Build a river bridge.', exact: true });
  const open = async () => {
    await page.getByRole('button', { name: 'Build', exact: true }).click();
    await page.getByRole('button', { name: 'River bridges', exact: true }).click();
  };
  const pose = (q: Point, vehicle = 5, h = heading) =>
    Object.assign(player(), q, {
      vehicle,
      heading: h,
      y: travelHeight(world(), q.x, q.z),
      speed: 0,
      engine: true,
      fuel: fuelCapacity({ ...player(), vehicle, fuelVehicle: vehicle }, world()),
      fuelVehicle: vehicle,
      bridgePasses: {},
    });
  const along = () =>
    (player().x - bridge().approachA.x) * ux + (player().z - bridge().approachA.z) * uz;
  const centre = point(0),
    axis = point(0, 1),
    side = () =>
      (player().x - centre.x) * (axis.x - centre.x) + (player().z - centre.z) * (axis.z - centre.z);
  try {
    const port = await app.listen();
    await page.addInitScript(
      ({ token, id }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', id);
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token, id: initial.id },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await expect.poll(() => bridge().closure).toBeUndefined();
    await open();
    const before = player().cash;
    await panel.locator('[data-bridge-op="passage"]').click();
    await expect.poll(() => player().cash).toBe(before - 300);
    await expect(panel.locator('[data-bridge-op="passage"]')).toBeDisabled();
    await page.keyboard.press('Escape');
    await page.keyboard.down('w');
    try {
      await expect.poll(along, { timeout: 10000 }).toBeGreaterThan(5);
    } finally {
      await page.keyboard.up('w');
    }
    act(world(), 'owner', { type: 'settings', patch: { bridgePublicAccess: false } });
    await page.keyboard.down('s');
    try {
      await expect.poll(along, { timeout: 15000 }).toBeLessThan(-3);
    } finally {
      await page.keyboard.up('s');
    }
    expect(player().cash).toBe(before - 300);
    await expect.poll(() => player().bridgePasses?.[bridge().id]).toBeUndefined();
    await open();
    await expect(panel).toContainText('owner access only');
    await expect(panel.locator('[data-bridge-op="passage"]')).toBeDisabled();
    await page.screenshot({ path: evidence + '/private-entry-refused.png' });
    act(world(), 'owner', {
      type: 'settings',
      patch: { bridgePublicAccess: true, bridgeToll: 0, bridgeWearPerDay: 100 },
    });
    world().time += DAY_SECONDS;
    maintainBridges(world());
    await expect(panel).toContainText('Bridge closed for maintenance');
    await panel.locator('[data-bridge-op="repair"]').click();
    await expect(page.locator('#toast')).toContainText('Not enough steel');
    expect(player().cash).toBe(before - 300);
    player().inventory = { steel: 20 };
    await expect(panel).toContainText('Condition 0.0%');
    await expect.poll(() => bridge().closure).toBeUndefined();
    await panel.locator('[data-bridge-op="repair"]').click();
    await expect.poll(() => bridge().condition).toBe(25);
    await page.screenshot({ path: evidence + '/repaired-public-bridge.png' });
    player().authority = 20;
    await page.keyboard.press('Escape');
    pose(bridge().a);
    await page.waitForTimeout(750);
    await open();
    await panel.locator('[data-bridge-op="bank"]').click();
    const svg = panel.locator('[data-bridge-map]');
    await svg.scrollIntoViewIfNeeded();
    const click = await svg.evaluate(
      (el, q) => {
        const p = new DOMPoint(q.x, q.z).matrixTransform((el as SVGSVGElement).getScreenCTM()!);
        return { x: p.x, y: p.y };
      },
      { x: bridge().b.x - player().x, z: bridge().b.z - player().z },
    );
    await page.mouse.click(click.x, click.y);
    await panel.getByRole('button', { name: 'Survey selected span', exact: true }).click();
    await expect(panel.getByRole('alert')).toContainText('overlaps');
    await panel.locator('[data-bridge-op="remove"]').click();
    await expect(page.locator('#toast')).toContainText('occupied');
    expect(world().bridges).toHaveLength(1);
    await page.keyboard.press('Escape');
    const boatHeading = Math.atan2(axis.x - centre.x, axis.z - centre.z);
    pose(point(0, -18), 33, boatHeading);
    player().y = fixture.level;
    Object.assign(world().players.owner, point(-30, 30));
    await expect(page.locator('#toast')).not.toHaveClass(/show/);
    await page.waitForTimeout(1000);
    await page.keyboard.down('w');
    try {
      await expect.poll(side, { timeout: 15000 }).toBeGreaterThan(-2);
    } finally {
      await page.keyboard.up('w');
    }
    await page.keyboard.press('F4');
    await page.screenshot({ path: evidence + '/boat-under-the-bridge.png' });
    await page.keyboard.press('F4');
    await page.keyboard.down('w');
    try {
      await expect.poll(side, { timeout: 15000 }).toBeGreaterThan(12);
    } finally {
      await page.keyboard.up('w');
    }
    expect(player().y).toBeLessThan(bridge().deckY - 5);
    expect(player().bridgePasses?.[bridge().id]).toBeUndefined();
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Vehicles', exact: true }).click();
    let form = page.locator('[data-vehicle-editor]');
    await form.locator('[name="slot"]').selectOption('33');
    await form.getByText('Performance, fuel and economy', { exact: true }).click();
    await expect(form.locator('[name="airDraft"]')).toHaveValue('2');
    await form.locator('[name="airDraft"]').fill('30');
    await form.getByRole('button', { name: 'Save vehicle configuration' }).click();
    await expect.poll(() => world().vehicleTuning?.[33]?.airDraft).toBe(30);
    await page.keyboard.press('Escape');
    await page.reload();
    await waitForWorld(page);
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Vehicles', exact: true }).click();
    form = page.locator('[data-vehicle-editor]');
    await form.locator('[name="slot"]').selectOption('33');
    await form.getByText('Performance, fuel and economy', { exact: true }).click();
    await expect(form.locator('[name="airDraft"]')).toHaveValue('30');
    await page.screenshot({ path: evidence + '/saved-vessel-clearance.png' });
    await page.keyboard.press('Escape');
    pose(point(0, -18), 33, boatHeading);
    player().y = fixture.level;
    await page.waitForTimeout(750);
    await page.keyboard.down('w');
    try {
      await page.waitForTimeout(5000);
    } finally {
      await page.keyboard.up('w');
    }
    expect(side()).toBeLessThan(-4);
    await page.screenshot({ path: evidence + '/overheight-vessel-stopped.png' });
    pose({ x: bridge().approachA.x - ux * 7, z: bridge().approachA.z - uz * 7 });
    await page.waitForTimeout(750);
    await open();
    await panel.locator('[data-bridge-op="remove"]').click();
    await expect.poll(() => world().bridges?.length).toBe(0);
    await expect(panel).toContainText('No bridge projects');
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
