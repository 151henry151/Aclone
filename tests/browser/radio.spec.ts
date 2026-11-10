// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect, type Page } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, act } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
import { radioView } from '../../src/shared/radio';
test.use({
  launchOptions: {
    args: [
      '--no-sandbox',
      '--enable-webgl',
      '--enable-gpu',
      '--use-angle=gl',
      '--ignore-gpu-blocklist',
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
    ],
  },
});
async function login(page: Page, token: string, port: number) {
  page.setDefaultTimeout(15000);
  await page.addInitScript(
    ({ token }) => {
      localStorage.setItem('aclone.pilot', token);
      localStorage.setItem('aclone.world', 'radio-ui');
      localStorage.setItem('aclone.quality', 'low');
      localStorage.setItem('aclone.sound', 'off');
    },
    { token },
  );
  await page.goto(`http://127.0.0.1:${port}`);
  await waitForWorld(page);
}
async function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-radio-ui-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const first = app.universe.register('Alice radio'),
    second = app.universe.register('Bob radio'),
    w = createWorld('radio-ui', 'Radio field', first.account.id);
  w.script = '';
  w.buildings = [];
  w.towns = [];
  w.roads = [];
  Object.assign(w.settings, {
    mapSize: 6000,
    seaLevel: -10,
    hungerRate: 0,
    thirstRate: 0,
    dayLength: 0,
    time: 43200,
    vehicleMaintenance: false,
  });
  w.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array(1089).fill(0),
  };
  const a = addPlayer(w, first.account.id, first.account.name),
    b = addPlayer(w, second.account.id, second.account.name);
  for (const [i, p] of [a, b].entries())
    Object.assign(p, { x: i * 100, y: 0, z: 0, vehicle: 0, engine: false, speed: 0 });
  app.worlds.set(w.id, w);
  const port = await app.listen();
  return { app, dir, first, second, w, a, b, port };
}
test('CB dashboard exchanges keyboard traffic, retains controls, explains refusals and offers manual rescue', async ({
  browser,
}) => {
  test.setTimeout(240000);
  const f = await fixture(),
    ca = await browser.newContext(),
    cb = await browser.newContext(),
    a = await ca.newPage(),
    b = await cb.newPage();
  const errors: string[] = [];
  for (const p of [a, b]) p.on('pageerror', (e) => errors.push(e.message));
  const current = () => f.app.worlds.get(f.w.id)!;
  const pilotA = () => current().players[f.a.id],
    pilotB = () => current().players[f.b.id];
  try {
    await login(a, f.first.token, f.port);
    await login(b, f.second.token, f.port);
    await a.getByRole('button', { name: 'CB radio', exact: false }).click({ timeout: 10000 });
    await b.keyboard.press('v');
    const ar = a.locator('.radio-console'),
      br = b.locator('.radio-console');
    await expect(ar).toContainText('No received traffic');
    await expect(ar.getByRole('log')).toBeInViewport();
    await expect(ar.getByRole('button', { name: 'Hold to transmit', exact: true })).toBeEnabled();
    await ar.getByLabel('Call sign', { exact: true }).fill('Marsh tractor');
    await ar.getByLabel('Call sign', { exact: true }).press('Tab');
    await expect.poll(() => pilotA().radios?.[0]?.handle).toBe('Marsh tractor');
    await ar.getByRole('button', { name: 'Hold to transmit', exact: true }).focus();
    await a.keyboard.down('t');
    await expect(br.locator('[data-radio-keyed]')).toContainText('Marsh tractor');
    await a.waitForTimeout(350);
    await a.keyboard.up('t');
    await expect(br.getByRole('log')).toContainText('Voice transmission');
    expect(current().messages.some((m) => m.text.includes('Voice transmission'))).toBe(false);
    await a.screenshot({ path: 'test-results/radio-tractor.png' });
    await br.getByLabel('Channel', { exact: true }).selectOption('9');
    await expect.poll(() => pilotB().radios?.[0]?.channel).toBe(9);
    const receivedBefore = radioView(current(), pilotB()).traffic.length;
    await a.keyboard.down('t');
    await a.waitForTimeout(2100);
    await a.keyboard.up('t');
    expect(radioView(current(), pilotB()).traffic.length).toBe(receivedBefore);
    await br.getByLabel('Channel', { exact: true }).selectOption('19');
    await expect.poll(() => pilotB().radios?.[0]?.channel).toBe(19);
    await br.getByRole('button', { name: 'Hold to transmit', exact: true }).focus();
    await b.keyboard.down('t');
    await expect(ar.locator('[data-radio-keyed]')).toContainText('Bob radio');
    await a.waitForTimeout(250);
    await a.keyboard.down('t');
    await expect(ar.locator('[data-radio-error]')).toContainText('busy');
    await a.keyboard.up('t');
    await b.keyboard.up('t');
    await expect.poll(() => radioView(current(), pilotA()).keyed.length).toBe(0);
    // Both keys share a simulation instant; inspect the actual received UI for doubling.
    act(current(), pilotA().id, {
      type: 'radio',
      operation: 'key',
      text: 'First overlapping carrier',
    });
    act(current(), pilotB().id, {
      type: 'radio',
      operation: 'key',
      text: 'Second overlapping carrier',
    });
    await expect(br.getByRole('log')).toContainText('doubling');
    pilotB().x = 2400;
    const squelch = br.getByLabel('Squelch', { exact: true });
    await squelch.focus();
    await squelch.press('Home');
    await expect.poll(() => pilotB().radios?.[0]?.squelch).toBe(0);
    await ar.getByRole('button', { name: 'Hold to transmit', exact: true }).focus();
    await a.keyboard.down('t');
    await expect(ar.locator('[data-radio-audio]')).toContainText('Microphone live');
    await a.waitForTimeout(350);
    await a.keyboard.up('t');
    await expect(br.getByRole('log')).toContainText(/static|weak reception/);
    await br.getByRole('log').scrollIntoViewIfNeeded();
    await b.screenshot({ path: 'test-results/radio-weak.png' });
    current().settings.chatLocked = true;
    await a.keyboard.down('t');
    await expect(ar.locator('[data-radio-error]')).toContainText('muted');
    await a.keyboard.up('t');
    current().settings.chatLocked = false;
    pilotA().vehicle = 5;
    await expect(ar).toContainText('Board a vehicle');
    await expect(ar.getByRole('log')).toContainText('No received traffic');
    pilotA().vehicle = 0;
    current().settings.radioEnabled = false;
    await expect(ar).toContainText('disabled in this world');
    current().settings.radioEnabled = true;
    for (const slot of [33, 2]) {
      pilotA().vehicle = slot;
      await expect(ar.getByRole('button', { name: 'Hold to transmit', exact: true })).toBeEnabled();
      await expect(ar.locator('[data-radio-vehicle]')).toContainText(
        slot === 33 ? 'motorboat' : 'Biplane',
      );
      await a.screenshot({ path: `test-results/radio-vehicle-${slot}.png` });
    }
    Object.assign(pilotA(), { vehicle: 33, x: 0, z: 0, y: 1, fuel: 0 });
    Object.assign(pilotB(), { vehicle: 33, x: 5, z: 0, y: 1 });
    current().settings.seaLevel = 1;
    await ar.getByLabel('Channel', { exact: true }).selectOption('9');
    await br.getByLabel('Channel', { exact: true }).selectOption('9');
    await expect.poll(() => pilotA().radios?.[33]?.channel).toBe(9);
    await expect.poll(() => pilotB().radios?.[33]?.channel).toBe(9);
    await ar.getByRole('button', { name: 'Hold to transmit', exact: true }).focus();
    await a.keyboard.down('t');
    await expect(ar.locator('[data-radio-audio]')).toContainText('Microphone live');
    await a.waitForTimeout(350);
    await a.keyboard.up('t');
    await expect(
      br.getByRole('button', { name: 'Open rescue options', exact: true }),
    ).toBeVisible();
    await a.keyboard.up('t');
    await br.getByRole('button', { name: 'Open rescue options', exact: true }).click();
    await expect(b.getByRole('dialog')).toContainText('Alice radio');
    await a.reload();
    await waitForWorld(a);
    await a.keyboard.press('v');
    await expect(a.locator('.radio-console').getByLabel('Channel', { exact: true })).toHaveValue(
      '9',
    );
    expect(errors).toEqual([]);
  } finally {
    await ca.close();
    await cb.close();
    await f.app.close();
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test('mobile touch and configurable controller bindings hold and release the CB microphone', async ({
  browser,
}) => {
  test.setTimeout(180000);
  const f = await fixture();
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    }),
    page = await context.newPage();
  try {
    await page.addInitScript(() => {
      const pad = {
        connected: true,
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0, touched: false })),
      };
      (window as any).testPad = pad;
      Object.defineProperty(navigator, 'getGamepads', { value: () => [pad] });
    });
    await login(page, f.first.token, f.port);
    await page.getByRole('button', { name: 'Actions', exact: true }).click();
    await page.getByRole('button', { name: 'CB radio', exact: true }).click();
    const radio = page.locator('.radio-console'),
      ptt = radio.getByRole('button', { name: 'Hold to transmit', exact: true });
    const keyed = () =>
      radioView(f.app.worlds.get(f.w.id)!, f.app.worlds.get(f.w.id)!.players[f.a.id]).keyed.length;
    expect(keyed()).toBe(0);
    await ptt.focus();
    await ptt.scrollIntoViewIfNeeded();
    const box = (await ptt.boundingBox())!,
      cdp = await context.newCDPSession(page);
    const touch = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch] });
    await expect.poll(keyed).toBe(1);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(keyed).toBe(0);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch] });
    await expect.poll(keyed).toBe(1);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await expect.poll(keyed).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: 'test-results/radio-mobile.png' });
    const press = async (i: number, down: boolean) => {
      await page.evaluate(
        ({ i, down }) => {
          (window as any).testPad.buttons[i].pressed = down;
        },
        { i, down },
      );
      await page.waitForTimeout(150);
    };
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await press(8, true);
    await press(8, false);
    await expect(radio).toBeVisible();
    await ptt.focus();
    await press(7, true);
    await expect.poll(keyed).toBe(1);
    await press(7, false);
    await expect.poll(keyed).toBe(0);
    await press(7, true);
    await expect.poll(keyed).toBe(1);
    await page.evaluate(() => {
      (window as any).testPad.connected = false;
    });
    await expect.poll(keyed).toBe(0);
    await press(7, false);
    await page.evaluate(() => {
      (window as any).testPad.connected = true;
    });
    await radio.getByLabel('Channel', { exact: true }).focus();
    await press(15, true);
    await press(15, false);
    await expect(radio.getByLabel('Channel', { exact: true })).toHaveValue('20');
    await ptt.focus();
    await press(7, true);
    await expect.poll(keyed).toBe(1);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect.poll(keyed).toBe(0);
    await press(7, false);
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await page.evaluate(() =>
      localStorage.setItem('aclone.controller', JSON.stringify({ radio: 6, radioTransmit: 4 })),
    );
    await page.reload();
    await waitForWorld(page);
    await press(6, true);
    await press(6, false);
    await expect(radio).toBeVisible();
    await ptt.focus();
    await press(4, true);
    await expect.poll(keyed).toBe(1);
    await press(4, false);
    await expect.poll(keyed).toBe(0);
  } finally {
    await context.close();
    await f.app.close();
    rmSync(f.dir, { recursive: true, force: true });
  }
});
