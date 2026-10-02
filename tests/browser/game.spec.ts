// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('aclone.quality', 'low'));
});
test('pilot registration, galaxy, landing, movement and persistent recovery', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const textures = new Set<string>();
  page.on('response', (r) => {
    if (r.ok() && /\/textures\/(meadow|gravel|stone|roof)\.webp$/.test(r.url()))
      textures.add(r.url().split('/').at(-1)!);
  });
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Welcome to Aclone.' })).toBeVisible();
  await page.screenshot({ path: 'test-results/welcome.png' });
  await page
    .getByLabel('Pilot name', { exact: true })
    .fill('Browser ' + Date.now().toString().slice(-8));
  await page.getByRole('button', { name: 'Make yourself at home' }).click();
  await expect(page.getByRole('heading', { name: 'Somewhere to call home.' })).toBeVisible();
  await page.screenshot({ path: 'test-results/galaxy.png' });
  await page.getByRole('button', { name: 'Land on this world' }).first().click();
  await expect(page.locator('#world-hud')).toBeVisible();
  await expect(page.locator('#cash')).toHaveText('18s 0d');
  // Exercise the built client and configured URL prefix as well as the isolated map fixture.
  await page.keyboard.press('m');
  const map = page.getByRole('dialog', { name: 'Parish map.', exact: true });
  await expect(map).toBeVisible();
  await expect(map.getByRole('button', { name: 'Harbour stores', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(map).toHaveCount(0);
  await expect.poll(() => textures.size).toBe(4);
  await expect
    .poll(
      async () => Number(await page.locator('#viewport canvas').getAttribute('data-triangles')),
      { timeout: 30000 },
    )
    .toBeGreaterThan(1000);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/parish.png' });
  await page.keyboard.press('h');
  await expect(page.locator('#world-hud')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('#world-hud')).toBeVisible();
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(1800);
  await expect(page.locator('#driving')).not.toContainText(/^0 MPH/);
  await page.keyboard.up('ArrowDown');
  await page.keyboard.press('c');
  await page.screenshot({ path: 'test-results/cockpit.png' });
  await page.keyboard.press('c');
  await page.screenshot({ path: 'test-results/overhead.png' });
  await page.keyboard.press('c');
  await page.getByRole('button', { name: 'World F9' }).click();
  await page.getByRole('button', { name: 'Return to town centre' }).click();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Activities', exact: true }).click();
  await page.getByRole('button', { name: 'Join Hornball' }).click();
  await page.waitForTimeout(500);
  await expect(page.locator('#clock')).toContainText('RUST 0 : 0 MOSS');
  await page.getByRole('button', { name: 'Parp Space' }).click();
  await page.reload();
  await expect(page.locator('#world-hud')).toBeVisible();
  await expect(page.locator('#clock')).toContainText('RUST');
  expect(errors).toEqual([]);
});
test('world creation, owner editor, safe Lua and live terrain changes', async ({ page }) => {
  let terrainRequest: number | undefined;
  let terrainAccepted = false;
  page.on('websocket', (socket) => {
    socket.on('framesent', ({ payload }) => {
      const message = JSON.parse(String(payload));
      if (message.type === 'action' && message.action?.type === 'terrain')
        terrainRequest = message.request;
    });
    socket.on('framereceived', ({ payload }) => {
      const message = JSON.parse(String(payload));
      if (
        message.type === 'result' &&
        terrainRequest !== undefined &&
        message.request === terrainRequest
      )
        terrainAccepted = message.ok === true;
    });
  });
  await page.goto('./');
  await page
    .getByLabel('Pilot name', { exact: true })
    .fill('Builder ' + Date.now().toString().slice(-8));
  await page.getByRole('button', { name: 'Make yourself at home' }).click();
  await page.getByRole('button', { name: 'Create a world', exact: true }).click();
  await page.getByLabel('World name', { exact: true }).fill('Browser Parish');
  await page.getByRole('button', { name: 'Create world', exact: true }).click();
  await expect(page.locator('#world-hud')).toBeVisible();
  await page.getByRole('button', { name: 'Editor F10' }).click();
  await expect(
    page.getByRole('heading', { name: 'Your world. Your peculiar rules.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Landscape', exact: true }).click();
  await page.getByRole('button', { name: 'Apply terrain brush' }).click();
  // Routine success intentionally has no toast; verify the matching server acknowledgement.
  await expect.poll(() => terrainAccepted).toBe(true);
  await expect(page.locator('#toast')).not.toContainText('Done');
  await page.getByRole('button', { name: 'Script', exact: true }).click();
  await page
    .getByLabel('World script', { exact: true })
    .fill('on("ScriptReload", function(e) announce("It works.") end)');
  await page.getByRole('button', { name: 'Validate & reload Lua' }).click();
  await expect(page.locator('#toast')).toContainText('Script validated');
  await page.screenshot({ path: 'test-results/editor.png' });
  await page.getByRole('button', { name: 'Close dialog' }).click();
  const key = await page.evaluate(() => localStorage.getItem('aclone.pilot'));
  const session = await page.request.get('./api/session', {
    headers: { authorization: 'Bearer ' + key },
  });
  const identity = (await session.json()).account.id;
  await page.locator('#chat-input').fill('*teleport ' + identity + ' -8 -97');
  await page.locator('#chat-input').press('Enter');
  await expect(page.locator('#target')).toContainText('Odd Jobs Office');
  await page.keyboard.press('e');
  await page.getByRole('button', { name: 'Work a shift · 45d' }).click();
  await expect(page.locator('#target')).toContainText('LABOUR');
  await expect(page.locator('#cash')).toHaveText('18s 45d', { timeout: 22000 });
});
test('small viewport can register and navigate', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Welcome to Aclone.' })).toBeVisible();
  await page
    .getByLabel('Pilot name', { exact: true })
    .fill('Mobile ' + Date.now().toString().slice(-8));
  await page.getByRole('button', { name: 'Make yourself at home' }).click();
  await page.getByRole('button', { name: 'Land on this world' }).first().click();
  await expect(page.locator('#world-hud')).toBeVisible();
  await page.screenshot({ path: 'test-results/mobile.png' });
});

test('password setup, sign-out and sign-in return to the same pilot', async ({ page }) => {
  const name = 'Password ' + Date.now().toString().slice(-8);
  await page.goto('./');
  await page.getByLabel('Pilot name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Make yourself at home' }).click();
  await page.getByRole('button', { name: 'Pilot key & options' }).click();
  await page.getByLabel('New password', { exact: true }).fill('browser test long password');
  await page.getByRole('button', { name: 'Save account security' }).click();
  await expect(page.locator('#toast')).toContainText('Password saved');
  await page.getByRole('button', { name: 'Sign out of all devices' }).click();
  await page.getByText('Sign in with a password', { exact: true }).click();
  await page.getByLabel('Returning pilot name', { exact: true }).fill(name);
  await page.getByLabel('Password', { exact: true }).fill('browser test long password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('.pilot-card')).toContainText(name);
  await page.getByRole('button', { name: 'Land on this world' }).first().click();
  await expect(page.locator('#pilot-name')).toHaveText(name);
});

test('pilot nameplates and disconnects match the live parish list', async ({ page, baseURL }) => {
  const { WebSocket } = await import('ws');
  await page.goto('./');
  await page
    .getByLabel('Pilot name', { exact: true })
    .fill('Observer ' + Date.now().toString().slice(-8));
  await page.getByRole('button', { name: 'Make yourself at home' }).click();
  await page.getByRole('button', { name: 'Land on this world' }).first().click();
  await expect(page.locator('#world-hud')).toBeVisible();
  await expect(page.locator('#chat-log')).toContainText(
    'Welcome to the parish. Mind the tractor.',
    { timeout: 15000 },
  );
  const name = 'Launch Check ' + Date.now().toString().slice(-4);
  const registered = await page.request.post('./api/register', { data: { name } });
  expect(registered.ok()).toBeTruthy();
  const { token } = await registered.json();
  const address = new URL('ws', baseURL!.replace(/\/?$/, '/'));
  address.protocol = address.protocol === 'https:' ? 'wss:' : 'ws:';
  const pilot = new WebSocket(address);
  try {
    await new Promise<void>((resolve, reject) => {
      pilot.once('open', resolve);
      pilot.once('error', reject);
    });
    pilot.send(JSON.stringify({ type: 'hello', token, protocol: 2, world: 'puddlewick' }));
    await expect(page.locator('#players')).toContainText(name);
    await expect(page.locator('#player-count')).toHaveText('2');
    await page.screenshot({ path: 'test-results/pilot-nameplate.png' });
    pilot.close();
    await expect(page.locator('#players')).not.toContainText(name);
    await expect(page.locator('#player-count')).toHaveText('1');
    await expect(page.locator('#chat-log')).not.toContainText('Script error');
  } finally {
    pilot.terminate();
  }
});

test('walking character can move, change camera and return to the tractor', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('./');
  await page
    .getByLabel('Pilot name', { exact: true })
    .fill('Walker ' + Date.now().toString().slice(-8));
  await page.getByRole('button', { name: 'Make yourself at home' }).click();
  await page.getByRole('button', { name: 'Land on this world' }).first().click();
  await expect(page.locator('#world-hud')).toBeVisible();
  await page.getByRole('button', { name: 'Inventory I', exact: true }).click();
  await page.getByRole('button', { name: 'Switch to walking' }).click();
  await expect(page.locator('#driving')).toContainText('On foot');
  await page.keyboard.down('ArrowDown');
  await expect(page.locator('#driving')).not.toContainText(/^0 MPH/);
  await page.waitForTimeout(800);
  await page.keyboard.up('ArrowDown');
  await page.screenshot({ path: 'test-results/walking.png' });
  await page.keyboard.press('c');
  await page.screenshot({ path: 'test-results/walking-first-person.png' });
  await page.keyboard.press('c');
  await page.keyboard.press('c');
  await page.getByRole('button', { name: 'Inventory I', exact: true }).click();
  await page.getByRole('button', { name: 'Return to tractor' }).click();
  await expect(page.locator('#driving')).toContainText('Puddle tractor');
  await page.keyboard.press('c');
  await page.screenshot({ path: 'test-results/driver-first-person.png' });
  await page.reload();
  await expect(page.locator('#driving')).toContainText('Puddle tractor');
  expect(errors).toEqual([]);
});
