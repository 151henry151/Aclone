// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect, type Page } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding, act } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { calendar, DAY_SECONDS } from '../../src/shared/environment';
import { winterDeadline } from '../../src/shared/farming';
import { waitForWorld } from './fixtures/ready';

const custom = {
  calendarYearDays: 120,
  calendarSpringDay: 10,
  calendarSpringDays: 30,
  calendarSummerDays: 40,
  calendarAutumnDays: 30,
};
async function setup(page: Page, kind: 'farm' | 'bank') {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-calendar-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const { account, token } = app.universe.register('Calendar tester');
  const w = createWorld(`calendar-${kind}`, 'Seasons workshop', account.id);
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
    parishOrders: false,
  });
  w.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array(1089).fill(0),
  };
  const b = makeBuilding(kind, kind, 0, 0);
  b.investment = 1000000;
  w.buildings = [b];
  const p = addPlayer(w, account.id, account.name);
  Object.assign(p, { x: 0, y: 0, z: 13, engine: false, cash: 1000000 });
  if (kind === 'farm') {
    b.owner = p.id;
    p.skills = ['farmer'];
  }
  app.worlds.set(w.id, w);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const port = await app.listen();
  await page.addInitScript(
    ({ token, world }) => {
      localStorage.setItem('aclone.pilot', token);
      localStorage.setItem('aclone.world', world);
      localStorage.setItem('aclone.quality', 'low');
      localStorage.setItem('aclone.sound', 'off');
    },
    { token, world: w.id },
  );
  await page.goto(`http://127.0.0.1:${port}`);
  await waitForWorld(page);
  return {
    w: () => app.worlds.get(w.id)!,
    p: () => app.worlds.get(w.id)!.players[p.id],
    b: () => app.worlds.get(w.id)!.buildings.find((v) => v.id === b.id)!,
    errors,
    close: async () => {
      await page.close();
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
const closeDialog = (page: Page) =>
  page.getByRole('button', { name: 'Close dialog', exact: true }).click();
async function editor(page: Page) {
  await page.keyboard.press('F10');
  await page.getByRole('button', { name: 'Rules', exact: true }).click();
  return page.getByRole('group', { name: 'Calendar', exact: true });
}
const apply = (page: Page) =>
  page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();

test('custom calendar validates boundaries, survives reload and moves empty/planted farms into winter', async ({
  page,
}) => {
  test.setTimeout(240000);
  const { w, p, b, errors, close } = await setup(page, 'farm');
  try {
    let group = await editor(page);
    for (const [key, value] of Object.entries({
      calendarYearDays: 365,
      calendarSpringDay: 59,
      calendarSpringDays: 92,
      calendarSummerDays: 92,
      calendarAutumnDays: 91,
    }))
      await expect(group.locator(`[name="${key}"]`)).toHaveValue(String(value));
    await expect(group).toContainText('Winter length: 90 days');
    for (const [key, value] of Object.entries(custom))
      await group.locator(`[name="${key}"]`).fill(String(value));
    await apply(page);
    await expect.poll(() => w().settings.calendarYearDays).toBe(120);
    await closeDialog(page);
    group = await editor(page);
    await expect(group).toContainText('Winter length: 20 days');
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'output/calendar-year-rules/browser/calendar.png' });
    await group.locator('[name="calendarYearDays"]').fill('100');
    await apply(page);
    await expect(page.locator('#toast')).toContainText('Leave at least one winter day');
    expect(w().settings.calendarYearDays).toBe(120);
    await group.locator('[name="calendarYearDays"]').fill('120');
    await group.locator('[name="calendarSpringDay"]').fill('21');
    await apply(page);
    await expect(page.locator('#toast')).toContainText('Spring start must fit');
    expect(w().settings.calendarSpringDay).toBe(10);
    await group.locator('[name="calendarSpringDay"]').fill('10');
    await closeDialog(page);
    expect(calendar(w()).season).toBe('Spring');
    await page.locator('#target').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Four seasons span 20.00 real hours');
    await expect(dialog.locator('select[name="crop"]')).toHaveCount(4);
    await dialog.locator('select[name="crop"]').first().selectOption('wheat');
    await dialog.getByRole('button', { name: 'Plant seeds', exact: true }).first().click();
    await expect.poll(() => b().plots?.[0]?.crop).toBe('wheat');
    w().time = winterDeadline(b().plots![0].planted, w().settings) + 1;
    await expect(dialog.locator('[data-planting-notice]')).toContainText(
      'No crops can be planted in winter',
    );
    await expect(dialog.getByText('Wheat lost to winter.', { exact: true })).toBeVisible();
    await expect(dialog.locator('select[name="crop"]')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Harvest', exact: true })).toHaveCount(0);
    await page.screenshot({ path: 'output/calendar-year-rules/browser/winter-farm.png' });
    await closeDialog(page);
    await page.reload();
    await waitForWorld(page);
    expect(w().settings.calendarYearDays).toBe(120);
    await expect(page.locator('body')).toContainText('Winter');
    await page.screenshot({ path: 'output/calendar-year-rules/browser/winter-world.png' });
    await page.locator('#target').click();
    await expect(dialog.getByText('Wheat lost to winter.', { exact: true })).toBeVisible();
    w().time += (120 - calendar(w()).dayOfYear + 10) * DAY_SECONDS;
    await expect(dialog.locator('select[name="crop"]')).toHaveCount(4);
    expect(p().skills).toContain('farmer');
    expect(errors).toEqual([]);
  } finally {
    await close();
  }
});

test('bank displays new calendar months, keeps signed periods and rejects a stale offer', async ({
  page,
}) => {
  test.setTimeout(240000);
  const { w, p, errors, close } = await setup(page, 'bank');
  try {
    const group = await editor(page);
    for (const [key, value] of Object.entries(custom))
      await group.locator(`[name="${key}"]`).fill(String(value));
    await apply(page);
    await expect.poll(() => w().settings.calendarYearDays).toBe(120);
    await closeDialog(page);
    await page.locator('#target').click();
    const dialog = page.getByRole('dialog'),
      result = page.locator('#loan-quote-result');
    await expect(dialog).toContainText('One bank month is 1.67 real hours (10.00 game days)');
    const quote = () => page.getByRole('button', { name: 'Get loan quote', exact: true }).click();
    const accept = async () => {
      await result.getByLabel('Pay automatically', { exact: true }).uncheck();
      await result.getByLabel('I accept this payment schedule and default terms').check();
      await result.getByRole('button', { name: 'Accept loan', exact: true }).click();
    };
    await quote();
    await expect(result.locator('[name="periodSeconds"]')).toHaveValue('6000');
    await accept();
    await expect.poll(() => p().loans?.length).toBe(1);
    // Wait for the first acceptance's browser refresh before requesting another
    // quote; server state can arrive before the scheduled panel refresh.
    await expect(dialog.locator('[data-loan-status]')).toHaveCount(1);
    const nextDue = p().loans![0].nextDue;
    await quote();
    await expect(result.locator('[name="periodSeconds"]')).toHaveValue('6000');
    act(w(), p().id, { type: 'settings', patch: { calendarYearDays: 240 } });
    await expect.poll(() => w().settings.calendarYearDays).toBe(240);
    await accept();
    await expect(page.locator('#toast')).toContainText('Loan terms changed; request a fresh quote');
    expect(p().loans).toHaveLength(1);
    expect(p().loans![0].periodSeconds).toBe(6000);
    expect(p().loans![0].nextDue).toBe(nextDue);
    await closeDialog(page);
    await page.reload();
    await waitForWorld(page);
    await page.locator('#target').click();
    await expect(dialog).toContainText('One bank month is 3.33 real hours (20.00 game days)');
    await expect(dialog).toContainText('every 1.67 real hours');
    await quote();
    await expect(result.locator('[name="periodSeconds"]')).toHaveValue('12000');
    await result.scrollIntoViewIfNeeded();
    await expect(page.locator('#toast')).toHaveCSS('opacity', '0');
    await page.screenshot({ path: 'output/calendar-year-rules/browser/bank.png' });
    expect(errors).toEqual([]);
  } finally {
    await close();
  }
});
