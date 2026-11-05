// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('Communication controls update chat and CB limits, preserve drafts and reject invalid settings', async ({
  page,
}) => {
  test.setTimeout(240000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-communication-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true, tick: false });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Chat builder'),
      initial = createWorld('communication-preview', 'Neighbourhood conversations', account.id);
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
    Object.assign(initial.settings, {
      mapSize: 500,
      dayLength: 0,
      time: 43200,
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
    });
    app.worlds.set(initial.id, initial);
    const w = () => app.worlds.get(initial.id)!;
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
    const group = page.getByRole('group', { name: 'Communication', exact: true });
    const chat = page.locator('#chat-input');
    await chat.fill('A draft worth keeping');
    await chat.press('Escape');
    await edit();
    await expect(group.locator('[name="chatMaxLength"]')).toHaveValue('1200');
    await expect(group.locator('[name="npcGroupReplyCooldown"]')).toHaveValue('30');
    await group.locator('[name="chatMaxLength"]').fill('80');
    await group.locator('[name="npcGroupReplyCooldown"]').fill('5');
    mkdirSync('output/communication-rules/browser', { recursive: true });
    await group.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await expect(page.locator('#toast')).toHaveCSS('opacity', '0');
    await page.screenshot({ path: 'output/communication-rules/browser/controls.png' });
    await apply();
    await expect.poll(() => (w().settings as any).chatMaxLength).toBe(80);
    await close();
    await expect(chat).toHaveAttribute('maxlength', '80');
    await expect(chat).toHaveValue('A draft worth keeping');
    const message =
      'A neighbourly conversation can now have a length chosen by this world’s builder.';
    expect(message.length).toBe(80);
    await chat.fill(message);
    await chat.press('Enter');
    await expect.poll(() => w().messages.some((m) => m.text === message.trim())).toBe(true);
    const count = w().messages.length;
    await chat.fill('   ');
    await chat.press('Enter');
    await page.waitForTimeout(500);
    expect(w().messages.length).toBe(count);
    await chat.press('Escape');
    await page.getByRole('button', { name: 'CB radio', exact: false }).click();
    const radio = page.locator('.radio-console');
    await expect(radio).toContainText('No received traffic');
    await expect(
      radio.getByRole('button', { name: 'Hold to transmit', exact: true }),
    ).toBeDisabled();
    const draft = radio.getByLabel('Radio message', { exact: true });
    await expect(draft).toHaveAttribute('maxlength', '80');
    await draft.fill('Radio draft');
    await draft.press('Tab');
    w().settings.chatLocked = true;
    await page.keyboard.down('t');
    await expect(radio.locator('[data-radio-error]')).toContainText('muted');
    await page.keyboard.up('t');
    w().settings.chatLocked = false;
    await close();
    await edit();
    await group.locator('[name="chatMaxLength"]').fill('1600');
    await apply();
    await expect.poll(() => (w().settings as any).chatMaxLength).toBe(1600);
    await close();
    await expect(chat).toHaveAttribute('maxlength', '1600');
    await page.getByRole('button', { name: 'CB radio', exact: false }).click();
    await expect(draft).toHaveValue('Radio draft');
    await expect(draft).toHaveAttribute('maxlength', String(w().settings.radioMaxLength));
    await close();
    const long =
      'There is room for a proper story. '.repeat(38) + 'And this is the complete ending.';
    expect(long.length).toBeGreaterThan(1200);
    await chat.fill(long);
    await chat.press('Enter');
    await expect.poll(() => w().messages.some((m) => m.text === long)).toBe(true);
    await expect(page.locator('#chat-log')).toContainText('And this is the complete ending.');
    await chat.press('Escape');
    await expect(page.locator('#toast')).toHaveCSS('opacity', '0');
    await page.screenshot({ path: 'output/communication-rules/browser/conversation.png' });
    await page.keyboard.press('F9');
    await page.getByRole('button', { name: 'Mail, family & trades', exact: true }).click();
    await page.getByRole('button', { name: 'Family', exact: true }).click();
    await expect(page.locator('[data-social-pane="family"]')).toContainText('No invitations.');
    await page.locator('#family-create').getByLabel('Family name').fill('Neighbours');
    await page.getByRole('button', { name: 'Create family', exact: true }).click();
    const family = page.getByLabel('Family message', { exact: true });
    await expect(family).toHaveAttribute('maxlength', '1600');
    await family.fill(long);
    await page.getByRole('button', { name: 'Send to family chat', exact: true }).click();
    await expect
      .poll(() => w().messages.some((m) => m.text === long && m.to === account.id))
      .toBe(true);
    await close();
    await page.reload();
    await waitForWorld(page);
    await expect(page.locator('#chat-log')).toContainText('And this is the complete ending.');
    await edit();
    await expect(group.locator('[name="chatMaxLength"]')).toHaveValue('1600');
    await expect(group.locator('[name="npcGroupReplyCooldown"]')).toHaveValue('5');
    await group.locator('[name="chatMaxLength"]').fill('0');
    await apply();
    expect(
      await group
        .locator('[name="chatMaxLength"]')
        .evaluate((el: HTMLInputElement) => el.validity.rangeUnderflow),
    ).toBe(true);
    expect((w().settings as any).chatMaxLength).toBe(1600);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
