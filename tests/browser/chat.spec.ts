// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { say } from '../../src/shared/simulation.ts';

test('chat scrollback survives updates, preserves privacy, and can jump back to live messages', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-chat-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const pilot = app.universe.register('Chat reader'),
      w = app.worlds.get('puddlewick')!;
    w.script = '';
    for (let i = 0; i < 30; i++) say(w, 'Neighbour', 'Earlier message ' + i, 'chat');
    say(w, 'Neighbour', 'A private secret', 'chat', 'somebody-else');
    const port = await app.listen();
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'puddlewick');
        localStorage.setItem('aclone.quality', 'low');
      },
      { token: pilot.token },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    const chat = page.getByRole('log');
    await expect(chat).toContainText('Earlier message 0');
    await expect(chat).not.toContainText('private secret');
    const bottom = () => chat.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight);
    // Software WebGL shader warm-up can briefly block the first DOM evaluation.
    await expect.poll(bottom, { timeout: 20000 }).toBeLessThan(12);
    // Real pointer input must hit the chat, not the canvas behind the HUD.
    await page.locator('#viewport canvas').evaluate((el) => {
      el.setAttribute('data-wheel-count', '0');
      el.addEventListener('wheel', () =>
        el.setAttribute(
          'data-wheel-count',
          String(Number(el.getAttribute('data-wheel-count')) + 1),
        ),
      );
    });
    const canvas = page.locator('#viewport canvas');
    await chat.click({ timeout: 10000 });
    await expect(chat).toBeFocused();
    const atLatest = await chat.evaluate((el) => el.scrollTop);
    await page.mouse.wheel(0, -180);
    await expect.poll(() => chat.evaluate((el) => el.scrollTop)).toBeLessThan(atLatest - 30);
    await expect(canvas).toHaveAttribute('data-wheel-count', '0');
    const input = page.getByRole('textbox', { name: 'Chat message' });
    await expect(input).toHaveAttribute('maxlength', '1200');
    await input.fill('Unsent draft');
    const beforePage = await chat.evaluate((el) => el.scrollTop);
    await page.keyboard.press('PageUp');
    await expect.poll(() => chat.evaluate((el) => el.scrollTop)).toBeLessThan(beforePage);
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('Unsent draft');
    const beforeDown = await chat.evaluate((el) => el.scrollTop);
    await page.keyboard.press('PageDown');
    await expect.poll(() => chat.evaluate((el) => el.scrollTop)).toBeGreaterThan(beforeDown);
    await input.hover();
    const beforeInputWheel = await chat.evaluate((el) => el.scrollTop);
    await page.mouse.wheel(0, -60);
    await expect.poll(() => chat.evaluate((el) => el.scrollTop)).toBeLessThan(beforeInputWheel);
    await expect(canvas).toHaveAttribute('data-wheel-count', '0');
    await chat.click({ timeout: 10000 });
    await page.keyboard.press('Home');
    await expect.poll(() => chat.evaluate((el) => el.scrollTop)).toBeLessThan(5);
    await chat.hover();
    await page.mouse.wheel(0, -180);
    await expect(canvas).toHaveAttribute('data-wheel-count', '0');
    say(w, 'Neighbour', 'A new arrival while reading', 'chat');
    await expect(chat).toContainText('A new arrival while reading');
    await expect.poll(() => chat.evaluate((el) => el.scrollTop)).toBeLessThan(5);
    await expect(
      page.getByRole('button', { name: 'New messages · jump to latest ↓' }),
    ).toBeVisible();
    await page.waitForTimeout(700);
    expect(await chat.evaluate((el) => el.scrollTop)).toBeLessThan(5);
    await page.getByRole('button', { name: 'New messages · jump to latest ↓' }).click();
    await expect.poll(bottom).toBeLessThan(12);
    await chat.evaluate((el) => {
      el.scrollTop = el.scrollHeight / 2;
    });
    // Roll the server ring forward and keep the retained reading position stable.
    for (let i = 0; i < 80; i++) say(w, 'Neighbour', 'Recent message ' + i, 'chat');
    await expect(chat).toContainText('Recent message 79');
    expect(await chat.locator('.chat-line').count()).toBeLessThanOrEqual(100);
    // Ordinary chat and switches should be quiet; errors must remain visible.
    await input.fill('Hello parish, no success flash please.');
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect(chat).toContainText('Hello parish, no success flash please.');
    await expect(page.locator('#toast')).not.toHaveClass(/show/);
    const engineBefore = w.players[pilot.account.id].engine;
    await page.locator('[data-do="engine"]').click();
    await expect.poll(() => w.players[pilot.account.id].engine).toBe(!engineBefore);
    await expect(page.locator('#toast')).not.toHaveClass(/show/);
    await input.fill('*cash Chat reader 100');
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect(page.locator('#toast')).toHaveClass(/error/);
    await page.screenshot({ path: 'test-results/chat-scrollback.png' });
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
