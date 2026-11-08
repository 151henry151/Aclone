// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect, type Page } from '@playwright/test';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { addPlayer } from '../../src/shared/simulation';
import { bridgeSite } from '../fixtures/bridge-site';
import { travelHeight } from '../../src/shared/dock';
import { waitForWorld } from './fixtures/ready';
import type { Point } from '../../src/shared/town';

test.use({ video: { mode: 'on', size: { width: 1440, height: 900 } } });
test('survey real banks, share funding, drive a loaded crossing and edit saved bridge policy', async ({
  page,
  browser,
}) => {
  test.setTimeout(300000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-bridges-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const { w, a, b, point } = bridgeSite();
  w.id = 'bridge-browser';
  w.name = 'Bridge workshop';
  w.script = '';
  w.creator!.weather = 'clear';
  Object.assign(w.settings, {
    dayLength: 0,
    time: 43200,
    hungerRate: 0,
    thirstRate: 0,
    arrivalAnimation: 'off',
    roadGrowthPerDay: 0,
    cityPaving: false,
  });
  const founder = app.universe.register('Bridge founder'),
    contributor = app.universe.register('Bridge neighbour');
  w.owner = founder.account.id;
  const p = addPlayer(w, founder.account.id, founder.account.name),
    donor = addPlayer(w, contributor.account.id, contributor.account.name);
  const heading = Math.atan2(b.x - a.x, b.z - a.z);
  for (const player of [p, donor])
    Object.assign(player, a, {
      y: travelHeight(w, a.x, a.z),
      heading,
      vehicle: 5,
      fleet: [0, 5],
      speed: 0,
      engine: false,
      cash: 0,
      inventory: {},
    });
  Object.assign(donor, point(-25, 15));
  donor.y = travelHeight(w, donor.x, donor.z);
  app.worlds.set(w.id, w);
  const evidence = 'output/player-bridges/browser';
  mkdirSync(evidence, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => {
    errors.push(e.message);
    console.log('Founder browser error:', e.message);
  });
  const second = await browser.newContext({ viewport: { width: 1440, height: 900 } }),
    other = await second.newPage();
  other.on('pageerror', (e) => {
    errors.push(e.message);
    console.log('Neighbour browser error:', e.message);
  });
  const openPanel = async (pg: Page) => {
    await pg.getByRole('button', { name: 'Build', exact: true }).click();
    await pg.getByRole('button', { name: 'River bridges', exact: true }).click();
  };
  const panel = page.getByRole('dialog', { name: 'Build a river bridge.', exact: true });
  const choose = async (q: Point) => {
    const svg = panel.locator('[data-bridge-map]');
    await svg.scrollIntoViewIfNeeded();
    const click = await svg.evaluate(
      (el, q) => {
        const svg = el as SVGSVGElement;
        const p = new DOMPoint(q.x, q.z).matrixTransform(svg.getScreenCTM()!);
        return { x: p.x, y: p.y };
      },
      { x: q.x - a.x, z: q.z - a.z },
    );
    await page.mouse.click(click.x, click.y);
  };
  try {
    const port = await app.listen();
    const enter = async (pg: Page, token: string) => {
      await pg.addInitScript(
        ({ token, id }) => {
          localStorage.setItem('aclone.pilot', token);
          localStorage.setItem('aclone.world', id);
          localStorage.setItem('aclone.quality', 'low');
          localStorage.setItem('aclone.sound', 'off');
        },
        { token, id: w.id },
      );
      await pg.goto(`http://127.0.0.1:${port}`);
      await waitForWorld(pg);
    };
    await enter(page, founder.token);
    await openPanel(page);
    await expect(panel).toContainText('No bridge projects');
    await choose(point(0));
    await panel.getByRole('button', { name: 'Survey selected span', exact: true }).click();
    await expect(panel.getByRole('alert')).toContainText(/bank.*dry|dry.*bank/i);
    await choose(b);
    await panel.getByRole('button', { name: 'Survey selected span', exact: true }).click();
    await expect(panel.locator('[data-bridge-quote]')).toBeVisible();
    await expect(panel).toContainText('Not enough cash');
    await expect(panel.locator('[data-bridge-op="found"]')).toBeDisabled();
    p.cash = 20_000_000;
    await expect(panel.locator('[data-bridge-op="found"]')).toBeEnabled();
    await page.screenshot({ path: evidence + '/survey-and-shared-bill.png' });
    await panel.locator('[data-bridge-op="found"]').click();
    await expect(panel.locator('[data-bridge-project]')).toContainText('Bridge project');
    await expect(panel).toContainText('No bridge materials carried');
    const bridge = w.bridges![0];
    const form = panel.locator('[data-bridge-contribute]');
    await form.locator('[name="cash"]').fill(String((bridge.bill.cash - bridge.paid.cash) / 100));
    await form.getByRole('button', { name: 'Contribute selected amounts' }).click();
    await expect.poll(() => bridge.paid.cash).toBe(bridge.bill.cash);
    expect(bridge.completedAt).toBeUndefined();
    console.log('Founder funded cash; opening neighbour browser');
    await enter(other, contributor.token);
    console.log('Neighbour entered');
    await openPanel(other);
    const otherPanel = other.getByRole('dialog', { name: 'Build a river bridge.', exact: true });
    Object.assign(donor, a);
    donor.y = travelHeight(w, donor.x, donor.z);
    donor.inventory = { ...bridge.bill.materials };
    const donation = otherPanel.locator('[data-bridge-contribute]');
    await expect(donation.locator('[name="steel"]')).toHaveAttribute(
      'max',
      String(bridge.bill.materials.steel),
    );
    for (const [k, n] of Object.entries(bridge.bill.materials))
      await donation.locator(`[name="${k}"]`).fill(String(n));
    await donation.getByRole('button', { name: 'Contribute selected amounts' }).click();
    await expect.poll(() => bridge.completedAt).toBeDefined();
    console.log('Bridge fully funded');
    await expect(panel.locator('[data-bridge-project]')).toContainText('Bridge complete');
    expect(Object.keys(bridge.contributors)).toHaveLength(2);
    await page.screenshot({ path: evidence + '/community-completed-bridge.png' });
    await second.close();
    await page.keyboard.press('Escape');
    const ux = (b.x - a.x) / 40,
      uz = (b.z - a.z) / 40;
    Object.assign(p, {
      x: bridge.approachA.x - ux * 10,
      z: bridge.approachA.z - uz * 10,
      heading,
      vehicle: 0,
      fuel: 64,
      fuelVehicle: 0,
      engine: true,
      speed: 0,
    });
    p.y = travelHeight(w, p.x, p.z);
    Object.assign(donor, point(-30, 30));
    w.trailers = {
      'bridge-load': {
        id: 'bridge-load',
        kind: 'dump',
        owner: p.id,
        attached: p.id,
        x: p.x - ux * 7,
        z: p.z - uz * 7,
        heading,
        cargo: { stone: 100 },
      },
    };
    await page.waitForTimeout(1500);
    await page.keyboard.down('w');
    try {
      await expect
        .poll(() => (p.x - bridge.a.x) * ux + (p.z - bridge.a.z) * uz, { timeout: 60000 })
        .toBeGreaterThan(12);
    } finally {
      await page.keyboard.up('w');
    }
    await expect.poll(() => Math.abs(p.speed)).toBeLessThan(0.2);
    await page.screenshot({ path: evidence + '/loaded-rig-on-bridge.png' });
    const deckStop = { x: p.x, z: p.z };
    await page.keyboard.down('s');
    try {
      await expect
        .poll(() => (p.x - deckStop.x) * ux + (p.z - deckStop.z) * uz, { timeout: 10000 })
        .toBeLessThan(-2);
    } finally {
      await page.keyboard.up('s');
    }
    await expect.poll(() => Math.abs(p.speed)).toBeLessThan(0.2);
    expect(p.y).toBeCloseTo(bridge.deckY, 1);
    expect(w.trailers['bridge-load'].cargo).toEqual({ stone: 100 });
    await page.screenshot({ path: evidence + '/loaded-rig-reversed-on-deck.png' });
    await page.keyboard.down('w');
    try {
      await expect
        .poll(() => (p.x - bridge.approachB.x) * ux + (p.z - bridge.approachB.z) * uz, {
          timeout: 60000,
        })
        .toBeGreaterThan(12);
    } finally {
      await page.keyboard.up('w');
    }

    await expect.poll(() => Math.abs(p.speed), { timeout: 10000 }).toBeLessThan(0.2);
    await page.screenshot({ path: evidence + '/loaded-rig-crossing.png' });
    expect(w.trailers['bridge-load'].cargo).toEqual({ stone: 100 });
    const stopped = { x: p.x, z: p.z };
    await page.keyboard.down('s');
    try {
      await expect
        .poll(() => (p.x - stopped.x) * ux + (p.z - stopped.z) * uz, { timeout: 10000 })
        .toBeLessThan(-1);
    } finally {
      await page.keyboard.up('s');
    }
    await expect.poll(() => Math.abs(p.speed)).toBeLessThan(0.2);
    await page.keyboard.press('m');
    const map = page.getByRole('dialog', { name: 'Parish map.', exact: true });
    await expect(map.locator('[data-paved-road]').first()).toBeAttached();
    await page.screenshot({ path: evidence + '/completed-crossing-map.png' });
    await page.keyboard.press('m');
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    const rules = page.getByRole('group', { name: 'Player-built bridges', exact: true });
    await rules.locator('[name="bridgeNarrowWidth"]').fill('12');
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect(page.locator('#toast')).toContainText(/Single-lane.*width/);
    expect(w.settings.bridgeNarrowWidth).toBe(4);
    await rules.locator('[name="bridgeNarrowWidth"]').fill('4');
    await rules.locator('[name="bridgeWearPerDay"]').fill('0');
    await rules.locator('[name="bridgeToll"]').fill('1200');
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => app.worlds.get(w.id)!.settings.bridgeToll).toBe(1200);
    await page.reload();
    await waitForWorld(page);
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    await expect(rules.locator('[name="bridgeToll"]')).toHaveValue('1200');
    await expect(rules.locator('[name="bridgeWearPerDay"]')).toHaveValue('0');
    expect(errors).toEqual([]);
  } finally {
    await second.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
