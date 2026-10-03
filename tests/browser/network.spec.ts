// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { createApp, type AppOptions } from '../../src/server/app.ts';
import { addPlayer } from '../../src/shared/simulation.ts';
import { slowLink } from '../fixtures/slow-link.ts';

test('parked neighbours and a throttled internet link retain playable controls and chat', async ({
  page,
}, info) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-browser-network-'));
  const options: AppOptions = { dataDir: dir, port: 0, dev: true };
  const app = await createApp(options);
  const port = await app.listen();
  options.publicOrigin = `http://127.0.0.1:${port}`;
  const proxy = await slowLink(port, {
    downBytesPerSecond: 8000,
    upBytesPerSecond: 2000,
    oneWayMs: 200,
    jitterMs: 150,
  });
  const neighbours: WebSocket[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    const pilot = app.universe.register('Network browser');
    const w = app.worlds.get('puddlewick')!;
    w.script = '';
    const p = addPlayer(w, pilot.account.id, pilot.account.name);
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'puddlewick');
        localStorage.setItem('aclone.quality', 'balanced');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token: pilot.token },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await expect(page.locator('#world-hud')).toBeVisible({ timeout: 60000 });
    await expect(page.locator('#driving')).toContainText('FPS');
    const sample = async () => {
      const samples: number[] = [];
      for (let i = 0; i < 5; i++) {
        await page.waitForTimeout(1100);
        const text = await page.locator('#driving').innerText();
        samples.push(Number(text.match(/(\d+) FPS/)?.[1]));
      }
      return {
        fpsSamples: samples,
        drawCalls: Number(await page.locator('#viewport canvas').getAttribute('data-draw-calls')),
      };
    };
    const alone = await sample();
    for (let i = 0; i < 2; i++) {
      const other = app.universe.register('Parked neighbour ' + i);
      const q = addPlayer(w, other.account.id, other.account.name);
      q.x = p.x + (i ? -6 : 6);
      q.z = p.z;
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      neighbours.push(ws);
      await new Promise<void>((resolve) => ws.once('open', resolve));
      ws.send(JSON.stringify({ type: 'hello', protocol: 2, token: other.token, world: w.id }));
    }
    await expect(page.locator('#player-count')).toHaveText('3');
    const three = await sample();
    // Shape only gameplay traffic; first-time asset loading is a separate measurement.
    await page.addInitScript(
      ({ proxyPort }) => {
        const NativeWebSocket = window.WebSocket;
        window.WebSocket = class extends NativeWebSocket {
          constructor(url: string | URL, protocols?: string | string[]) {
            const address = new URL(url);
            if (address.pathname === '/ws') address.port = String(proxyPort);
            super(address, protocols);
          }
        };
      },
      { proxyPort: proxy.port },
    );
    await page.reload();
    await expect(page.locator('#world-hud')).toBeVisible({ timeout: 60000 });
    await expect(page.locator('#player-count')).toHaveText('3', { timeout: 20000 });
    const initialZ = p.z;
    await page.keyboard.down('ArrowDown');
    await expect.poll(() => p.z, { timeout: 10000 }).toBeGreaterThan(initialZ + 2);
    await expect(page.locator('#driving')).not.toContainText(/^0 MPH/);
    await page.keyboard.up('ArrowDown');
    await expect.poll(() => Math.abs(p.speed), { timeout: 10000 }).toBeLessThan(0.1);
    await page.locator('#chat-input').fill('Testing the slow connection');
    await page.locator('#chat-input').press('Enter');
    await expect(page.locator('#chat-log')).toContainText('Testing the slow connection', {
      timeout: 10000,
    });
    const slow = await sample();
    await page.screenshot({ path: 'test-results/slow-network.png' });
    expect(errors).toEqual([]);
    await info.attach('network-and-rendering-measurements', {
      body: JSON.stringify({ alone, three, slow, transport: proxy.metrics }, null, 2),
      contentType: 'application/json',
    });
    console.log('Network browser measurements:', JSON.stringify({ alone, three, slow }));
  } finally {
    await page.close();
    for (const socket of neighbours) socket.terminate();
    await proxy.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
