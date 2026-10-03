// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation.ts';

test('touch input releases safely, aircraft and weapons work, and tablet/desktop layouts remain distinct', async ({
  browser,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-touch-safety-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const context = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  try {
    const { account, token } = app.universe.register('Touch safety');
    const w = createWorld('safety', 'Touch safety', account.id);
    w.script = '';
    w.buildings = [];
    w.zones = [];
    w.settings.fighting = true;
    w.settings.hungerRate = w.settings.thirstRate = 0;
    const p = addPlayer(w, account.id, account.name);
    app.worlds.set(w.id, w);
    const port = await app.listen();
    const setup = ({ token }: { token: string }) => {
      localStorage.setItem('aclone.pilot', token);
      localStorage.setItem('aclone.world', 'safety');
      localStorage.setItem('aclone.quality', 'low');
    };
    await page.addInitScript(setup, { token });
    const packets: {
      type: string;
      input?: { throttle: number; lift?: number };
      action?: { type: string };
    }[] = [];
    page.on('websocket', (ws) =>
      ws.on('framesent', ({ payload }) => {
        try {
          packets.push(JSON.parse(String(payload)));
        } catch {}
      }),
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await expect(page.locator('.mobile-nav')).toBeVisible();
    await expect(page.locator('.left-panel')).toBeHidden();
    await page.screenshot({ path: 'test-results/mobile-tablet.png' });
    const cdp = await context.newCDPSession(page);
    const point = async (selector: string, id = 1) => {
      const box = (await page.locator(selector).boundingBox())!;
      return { x: box.x + box.width / 2, y: box.y + box.height / 2, id };
    };
    const hold = async (selector: string) =>
      cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [await point(selector)],
      });
    const release = async (cancel = false) =>
      cdp.send('Input.dispatchTouchEvent', {
        type: cancel ? 'touchCancel' : 'touchEnd',
        touchPoints: [],
      });
    const input = () => packets.filter((v) => v.type === 'input').at(-1)?.input;
    await hold('[data-hold=forward]');
    await expect.poll(() => input()?.throttle).toBe(1);
    // The second thumb opens a menu while the first is still holding the pedal.
    const forward = await point('[data-hold=forward]');
    const menu = await point('[data-do=mobile-actions]', 2);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [forward, menu],
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [menu] });
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect.poll(() => input()?.throttle).toBe(0);
    await release();
    await page.getByRole('button', { name: 'Close dialog' }).tap();
    await expect(page.locator('[data-hold=forward]')).toHaveAttribute('aria-pressed', 'false');
    await hold('[data-hold=forward]');
    await expect.poll(() => input()?.throttle).toBe(1);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect.poll(() => input()?.throttle).toBe(0);
    await release();
    // Real flight physics responds to the previously keyboard-only lift action.
    p.vehicle = 2;
    p.speed = 12;
    p.fuel = 64;
    await expect(page.locator('#mobile-flight')).toBeVisible();
    const height = p.y;
    await hold('[data-hold=up]');
    await expect.poll(() => p.y).toBeGreaterThan(height + 0.2);
    await release();
    await expect.poll(() => input()?.lift).toBe(0);
    p.vehicle = 0;
    p.speed = 0;
    p.y = 0.15;
    await page.locator('[data-do=mobile-actions]').tap();
    await page.getByRole('button', { name: 'Javelin', exact: true }).tap();
    const shots = () => packets.filter((v) => v.action?.type === 'fire').length;
    const before = shots();
    await hold('[data-hold=fire]');
    await expect.poll(() => p.weaponCharge?.weapon).toBe('javelin');
    await release(true);
    expect(shots()).toBe(before);
    await hold('[data-hold=fire]');
    await release();
    await expect.poll(shots).toBe(before + 1);
    // A hardware keyboard can navigate mobile chat without releasing a weapon.
    await page.locator('#mobile-chat').tap();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(150);
    expect(shots()).toBe(before + 1);
    await page.getByRole('button', { name: 'Close parish chat' }).tap();
    // Finger pinch is a camera gesture, not a building selection or page zoom.
    const zoomBefore = await page.evaluate(() => window.visualViewport?.scale);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: 420, y: 300, id: 5 },
        { x: 600, y: 300, id: 6 },
      ],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: 380, y: 300, id: 5 },
        { x: 640, y: 300, id: 6 },
      ],
    });
    await release();
    expect(await page.evaluate(() => window.visualViewport?.scale)).toBe(zoomBefore);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // An indoors player always has a reachable exit and cannot press drive.
    const home = makeBuilding('home', 'home', p.x, p.z);
    home.owner = p.id;
    w.buildings.push(home);
    p.home = home.id;
    p.atHome = true;
    await expect(page.locator('[data-hold=forward]')).toBeDisabled();
    await page.getByRole('button', { name: 'At home · Go outside' }).tap();
    await expect.poll(() => p.atHome).toBe(false);
    // Narrow phone and reduced visual viewport (virtual-keyboard-sized) keep chat controls visible.
    await page.setViewportSize({ width: 320, height: 568 });
    await page.locator('#mobile-chat').tap();
    await page.locator('#chat-input').fill('Small screen');
    await page.setViewportSize({ width: 320, height: 310 });
    // visualViewport resize and the layout update arrive asynchronously.
    await expect
      .poll(async () => {
        const send = await page.getByRole('button', { name: 'Send message' }).boundingBox();
        return send ? send.y + send.height : Infinity;
      })
      .toBeLessThanOrEqual(310);
    await page.getByRole('button', { name: 'Send message' }).tap();
    await expect(page.locator('#chat-log')).toContainText('Small screen');
    await page.getByRole('button', { name: 'Close parish chat' }).tap();
    await page.setViewportSize({ width: 320, height: 568 });
    await page.screenshot({ path: 'test-results/mobile-small.png' });
    await context.close();
    // Same account and game on a fine-pointer laptop retains all desktop panels.
    const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    try {
      const pc = await desktop.newPage();
      await pc.addInitScript(setup, { token });
      await pc.goto(`http://127.0.0.1:${port}`);
      await expect(pc.locator('.left-panel')).toBeVisible();
      await expect(pc.locator('.status-panel')).toBeVisible();
      await expect(pc.locator('.inventory-panel')).toBeVisible();
      await expect(pc.locator('.quickbar')).toBeVisible();
      await expect(pc.locator('.mobile-nav')).toBeHidden();
      await expect(pc.locator('.chat-panel #target')).toHaveCount(1);
      await pc.screenshot({ path: 'test-results/mobile-desktop-regression.png' });
      await pc.setViewportSize({ width: 600, height: 800 });
      await expect(pc.locator('.mobile-nav')).toBeVisible();
      await pc.setViewportSize({ width: 1440, height: 900 });
      await expect(pc.locator('.left-panel')).toBeVisible();
      await expect(pc.locator('.chat-panel #target')).toHaveCount(1);
      await pc.keyboard.press('m');
      await expect(pc.getByRole('dialog', { name: 'Parish map.' })).toBeVisible();
    } finally {
      await desktop.close();
    }
  } finally {
    await context.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
