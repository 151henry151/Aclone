// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('CB world rules have a dedicated editable fieldset and retain changed values', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-radio-rules-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Radio owner'),
      w = createWorld('radio-rules', 'CB rules', account.id);
    w.script = '';
    w.buildings = [];
    w.roads = [];
    w.towns = [];
    Object.assign(w.settings, {
      mapSize: 500,
      seaLevel: -10,
      hungerRate: 0,
      thirstRate: 0,
      dayLength: 0,
      time: 43200,
    });
    w.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
    w.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array(1089).fill(0),
    };
    const p = addPlayer(w, account.id, account.name);
    Object.assign(p, { x: 0, y: 0, z: 0, vehicle: 0, speed: 0 });
    app.worlds.set(w.id, w);
    const port = await app.listen();
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'radio-rules');
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    const form = page.locator('#settings-form'),
      group = form.getByRole('group', { name: 'CB radios', exact: true });
    await expect(group).toBeVisible();
    await group.locator('[name="radioChannelCount"]').fill('20');
    await group.locator('[name="radioRange"]').fill('4500');
    await group.locator('[name="radioCharsPerSecond"]').fill('10');
    await group.locator('[name="radioVoiceSampleRate"]').fill('8000');
    await group.locator('[name="radioVoiceChunkMs"]').fill('80');
    await group.locator('[name="radioVoiceMaxSeconds"]').fill('15');
    await group.locator('[name="radioVoiceBufferMs"]').fill('400');
    await group.locator('[name="radioEnabled"]').uncheck();
    await form.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w.settings.radioRange).toBe(4500);
    expect(w.settings.radioChannelCount).toBe(20);
    expect(w.settings.radioCharsPerSecond).toBe(10);
    expect(w.settings.radioVoiceSampleRate).toBe(8000);
    expect(w.settings.radioVoiceChunkMs).toBe(80);
    expect(w.settings.radioVoiceMaxSeconds).toBe(15);
    expect(w.settings.radioVoiceBufferMs).toBe(400);
    expect(w.settings.radioEnabled).toBe(false);
    await page.keyboard.press('Escape');
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    await expect(group.locator('[name="radioRange"]')).toHaveValue('4500');
    await expect(group.locator('[name="radioEnabled"]')).not.toBeChecked();
    await expect(group.locator('[name="radioVoiceMaxSeconds"]')).toHaveValue('15');
    await group.evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: 'test-results/radio-rules.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
