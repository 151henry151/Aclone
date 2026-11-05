// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, act } from '../../src/shared/simulation';
import { tickLottery } from '../../src/shared/lottery';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('lottery calendar controls preserve paid rounds and show custom, empty, failed and disabled states', async ({
  page,
}) => {
  test.setTimeout(240000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-lottery-rules-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Lucky neighbour'),
      initial = createWorld('lottery-workshop', 'Parish prize night', account.id);
    initial.script = '';
    initial.buildings = [];
    initial.towns = [];
    initial.roads = [];
    initial.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array(1089).fill(3),
    };
    initial.creator = creatorSchema.parse({ weather: 'clear', roads: false, scenery: false });
    initial.time = 0;
    Object.assign(initial.settings, {
      lotteryEnabled: false,
      mapSize: 500,
      dayLength: 0,
      time: 64800,
      hungerRate: 0,
      thirstRate: 0,
    });
    Object.assign(addPlayer(initial, account.id, account.name), {
      x: 0,
      z: 0,
      y: 3,
      vehicle: 0,
      speed: 0,
      engine: false,
      cash: 350,
    });
    app.worlds.set(initial.id, initial);
    const w = () => app.worlds.get(initial.id)!,
      p = () => w().players[account.id];
    const port = await app.listen();
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
    const edit = async () => {
      await page.keyboard.press('F10');
      await page.getByRole('button', { name: 'Rules', exact: true }).click();
    };
    const close = () => page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    const apply = () =>
      page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    const openLottery = async () => {
      await page.keyboard.press('F9');
      await page.getByRole('button', { name: 'Parish lottery', exact: true }).click();
    };
    const group = page.getByRole('group', { name: 'Calendar', exact: true });
    const panel = page.getByRole('dialog', { name: 'Parish lottery', exact: true });
    await edit();
    await expect(group.locator('[name="lotteryDrawDays"]')).toHaveValue('365');
    await page.locator('[name="lotteryEnabled"]').check();
    await group.locator('[name="lotteryDrawDays"]').fill('7');
    await apply();
    await expect.poll(() => (w().settings as any).lotteryDrawDays).toBe(7);
    await close();
    await openLottery();
    await expect(panel).toContainText('every 7 game days');
    await expect(panel).toContainText('Draw in 7 game days');
    await expect(panel).toContainText('No draws yet.');
    await panel.getByLabel('Tickets to buy').fill('2');
    await panel.getByRole('button', { name: /Buy tickets/ }).click();
    await expect.poll(() => w().lottery?.tickets[account.id]).toBe(2);
    expect(p().cash).toBe(150);
    await panel.getByLabel('Jackpot contribution in denarii').fill('3.50');
    await panel.getByRole('button', { name: 'Contribute own cash', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Not enough cash');
    expect(w().lottery!.pot).toBe(200);
    await close();
    await edit();
    await group.locator('[name="lotteryDrawDays"]').fill('3');
    await apply();
    await expect.poll(() => (w().settings as any).lotteryDrawDays).toBe(3);
    expect(w().lottery!.drawAt).toBe(7 * 600);
    await close();
    await openLottery();
    await expect(panel).toContainText('every 3 game days');
    await expect(panel).toContainText('Draw in 7 game days');
    await expect(panel).toContainText('Existing round deadlines stay fixed');
    act(w(), account.id, { type: 'settings', patch: { lotteryEnabled: false } });
    // Reopening remembers the contribution field's focus; leave it before the
    // ordinary panel refresh, which preserves focused drafts.
    await panel.getByRole('heading', { name: 'Parish lottery', exact: true }).click();
    await expect(panel).toContainText('New entries are disabled');
    await expect(panel.getByRole('button', { name: /Buy tickets/ })).toHaveCount(0);
    mkdirSync('output/lottery-rules/browser', { recursive: true });
    await expect(page.locator('#toast')).toHaveCSS('opacity', '0');
    await page.screenshot({ path: 'output/lottery-rules/browser/paid-round.png' });
    w().time = w().lottery!.drawAt;
    tickLottery(w(), () => 0);
    await expect(panel).toContainText('round 2');
    await expect(panel).toContainText('Draw in 3 game days');
    await expect(panel).toContainText('Round 1: Lucky neighbour');
    expect(p().cash).toBe(350);
    await page.screenshot({ path: 'output/lottery-rules/browser/winner.png' });
    await page.reload();
    await waitForWorld(page);
    await openLottery();
    await expect(panel).toContainText('Round 1: Lucky neighbour');
    expect(p().cash).toBe(350);
    expect(w().lottery!.history.length).toBe(1);
    await close();
    await edit();
    await expect(group.locator('[name="lotteryDrawDays"]')).toHaveValue('3');
    await group.locator('[name="lotteryDrawDays"]').fill('0');
    await apply();
    expect(
      await group
        .locator('[name="lotteryDrawDays"]')
        .evaluate((el: HTMLInputElement) => el.validity.rangeUnderflow),
    ).toBe(true);
    expect((w().settings as any).lotteryDrawDays).toBe(3);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
