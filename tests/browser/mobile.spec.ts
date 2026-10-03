// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect, type Page } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation.ts';
import { say } from '../../src/shared/messages.ts';

async function tap(page: Page, selector: string) {
  await page.locator(selector).tap();
}
async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const dialog = page.getByRole('dialog');
  if (await dialog.count()) {
    await expect(async () => {
      await expect(dialog).toBeVisible();
      const box = (await dialog.boundingBox())!;
      const view = page.viewportSize()!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(view.width + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(view.height + 1);
      expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    }).toPass({ timeout: 10000 });
  }
}

test('phone controls, mobile sheets and touch conversations support real gameplay in both orientations', async ({
  browser,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-mobile-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Mobile pilot');
    const w = createWorld('mobile', 'Touch parish', account.id);
    w.script = '';
    w.settings.hungerRate = w.settings.thirstRate = 0;
    const p = addPlayer(w, account.id, account.name);
    p.x = 0;
    p.z = 40;
    p.cash = 1000000;
    const shop = makeBuilding('shop', 'market', 0, 0);
    shop.stock = { bread: 100, water: 100 };
    shop.investment = 100000;
    const mill = makeBuilding('mill', 'mill', 45, 0);
    mill.owner = p.id;
    mill.investment = 20000;
    w.buildings = [shop, mill];
    app.worlds.set(w.id, w);
    const port = await app.listen();
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'mobile');
        localStorage.setItem('aclone.quality', 'low');
      },
      { token },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await expect(page.locator('html')).toHaveClass(/mobile-ui/);
    await expect(page.locator('.mobile-nav')).toBeVisible();
    await expect(page.locator('.left-panel')).toBeHidden();
    await expect(page.locator('.chat-panel')).toBeHidden();
    await page.screenshot({ path: 'test-results/mobile-portrait.png' });
    // Real simultaneous touches, rather than synthetic clicks on a desktop D-pad.
    const cdp = await context.newCDPSession(page);
    const point = async (selector: string, id: number) => {
      const b = (await page.locator(selector).boundingBox())!;
      return { x: b.x + b.width / 2, y: b.y + b.height / 2, id };
    };
    const forward = await point('[data-hold=forward]', 1);
    const left = await point('[data-hold=left]', 2);
    const start = { x: p.x, z: p.z, heading: p.heading };
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [forward, left],
    });
    await expect.poll(() => Math.hypot(p.x - start.x, p.z - start.z)).toBeGreaterThan(0.5);
    await expect.poll(() => Math.abs(p.heading - start.heading)).toBeGreaterThan(0.1);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('[data-hold=forward]')).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => Math.abs(p.speed)).toBeLessThan(0.2);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [forward] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await expect(page.locator('[data-hold=forward]')).toHaveAttribute('aria-pressed', 'false');
    await tap(page, '[data-do=mobile-actions]');
    await fits(page);
    await page.getByRole('button', { name: 'Stop engine', exact: true }).tap();
    await expect.poll(() => p.engine).toBe(false);
    await page.getByRole('button', { name: 'Start engine', exact: true }).tap();
    await expect.poll(() => p.engine).toBe(true);
    await page.getByRole('button', { name: 'Walk on foot', exact: true }).tap();
    await expect.poll(() => p.vehicle).toBe(5);
    await tap(page, '[data-do=mobile-actions]');
    await page.getByRole('button', { name: 'Return to tractor', exact: true }).tap();
    await expect.poll(() => p.vehicle).toBe(0);
    // Nearby interaction, repeated trading and retained drafts.
    p.x = 0;
    p.z = 12;
    p.speed = 0;
    await page.locator('#mobile-target [data-do=building]').tap();
    await fits(page);
    await page.locator('#trade-quantity').fill('2');
    const buy = page.locator('[data-do=trade][data-direction=buy][data-item=bread]');
    const before = p.inventory.bread ?? 0;
    await buy.tap();
    await expect.poll(() => p.inventory.bread).toBe(before + 2);
    await buy.tap();
    await expect.poll(() => p.inventory.bread).toBe(before + 4);
    await expect(page.locator('#trade-quantity')).toHaveValue('2');
    await page.screenshot({ path: 'test-results/mobile-trading.png' });
    await page.getByRole('button', { name: 'Close dialog', exact: true }).tap();
    p.x = 45;
    p.z = 12;
    await expect(page.locator('#mobile-target')).toContainText(mill.name);
    await page.locator('#mobile-target [data-do=building]').tap();
    await page.getByRole('button', { name: 'Building Admin', exact: true }).tap();
    await fits(page);
    const cash = page.locator('form[data-action=investment]');
    await cash.locator('[name=direction]').selectOption('withdraw');
    await cash.locator('[name=denarii]').fill('10');
    await cash.getByRole('button', { name: 'Transfer cash' }).tap();
    await expect.poll(() => mill.investment).toBe(19000);
    await expect(cash.locator('[name=direction]')).toHaveValue('withdraw');
    await page.getByRole('button', { name: 'Close dialog', exact: true }).tap();
    await tap(page, '#mobile-chat');
    await expect(page.locator('#chat-input')).not.toBeFocused();
    await page.locator('#chat-input').fill('Hello from a phone');
    await page.getByRole('button', { name: 'Send message' }).tap();
    await expect(page.locator('#chat-log')).toContainText('Hello from a phone');
    await expect(page.locator('#chat-input')).toBeFocused();
    for (let i = 0; i < 40; i++)
      say(w, 'Neighbour', `Earlier message ${i}: the parish keeps going.`);
    await expect(page.locator('#chat-log')).toContainText('Earlier message 39');
    const log = await point('#chat-log', 4);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ ...log, y: log.y - 80 }],
    });
    for (let step = 0; step < 6; step++)
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ ...log, y: log.y - 80 + step * 25 }],
      });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect
      .poll(() =>
        page
          .locator('#chat-log')
          .evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight),
      )
      .toBeGreaterThan(40);
    await page.screenshot({ path: 'test-results/mobile-chat.png' });
    await page.getByRole('button', { name: 'Close parish chat' }).tap();
    await expect(page.locator('.chat-panel')).toBeHidden();
    await tap(page, '#mobile-status');
    await expect(page.locator('#needs')).toBeVisible();
    await page.getByRole('button', { name: 'Close pilot & parish' }).tap();
    await tap(page, '.mobile-nav [data-do=map]');
    await fits(page);
    await page.getByRole('button', { name: 'Zoom in', exact: true }).tap();
    await expect(page.getByLabel('Map zoom')).toContainText('150%');
    await page.getByRole('button', { name: 'Close dialog', exact: true }).tap();
    await page.setViewportSize({ width: 844, height: 390 });
    await fits(page);
    await expect(page.locator('.mobile-nav')).toBeVisible();
    await page.screenshot({ path: 'test-results/mobile-landscape.png' });
    // All gameplay menus remain reachable and fit a short landscape viewport.
    for (const name of [
      'Resources',
      'Activities',
      'Build',
      'Skills & employment',
      'World editor',
      'Pilot & preferences',
      'How to play',
    ]) {
      await tap(page, '[data-do=mobile-actions]');
      await page.getByRole('button', { name, exact: true }).tap();
      await fits(page);
      await page.getByRole('button', { name: 'Close dialog', exact: true }).tap();
    }
    expect(errors).toEqual([]);
  } finally {
    await context.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
