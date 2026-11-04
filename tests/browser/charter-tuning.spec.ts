// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, act } from '../../src/shared/simulation';
import { ensurePuddlewickBoatyard } from '../../src/server/puddlewick-boatyard';
import { boatLandings } from '../../src/shared/boathouse';
import { travelHeight } from '../../src/shared/dock';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';

test('charter boarding and its panel use the saved vehicle editor berths and tank', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-charter-tuning-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    const captain = app.universe.register('Charter builder');
    const guest = app.universe.register('Waiting guest');
    const w = createWorld('puddlewick', 'Puddlewick', 'server');
    w.script = '';
    w.settings.vehicleLicences = w.settings.requireCaptainSkill = false;
    w.settings.hungerRate = w.settings.thirstRate = 0;
    w.settings.dayLength = 0;
    w.settings.time = 43200;
    ensurePuddlewickBoatyard(w);
    w.creator = creatorSchema.parse({ scenery: false, roads: false, weather: 'clear' });
    w.owner = captain.account.id;
    const dock = boatLandings(w).find((d) => d.building)!;
    w.buildings = w.buildings.filter((b) => b.id === dock.id);
    const shorePlayer = (id: string, name: string) => {
      const p = addPlayer(w, id, name);
      Object.assign(p, dock.land, {
        y: travelHeight(w, dock.land.x, dock.land.z),
        cash: 3000000,
        online: true,
        fleet: [0, 5],
      });
      return p;
    };
    const c = shorePlayer(captain.account.id, captain.account.name);
    act(w, c.id, { type: 'vehicle', slot: 31, building: dock.id });
    c.engine = false;
    app.worlds.set(w.id, w);
    const port = await app.listen();
    await page.addInitScript(
      ({ token }) => {
        if (!localStorage.getItem('aclone.pilot')) localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'puddlewick');
        localStorage.setItem('aclone.quality', 'low');
      },
      { token: captain.token },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    const tune = async (seats: number) => {
      await page.keyboard.press('F10');
      await page.getByRole('button', { name: 'Vehicles', exact: true }).click();
      const form = page.locator('[data-vehicle-editor]');
      await form.locator('[name="slot"]').selectOption('31');
      await form.getByText('Performance, fuel and economy', { exact: true }).click();
      await form.locator('[name="hitch"]').fill(String(seats));
      await form.locator('[name="tank"]').fill('300');
      await form.getByRole('button', { name: 'Save vehicle configuration' }).click();
      await expect.poll(() => w.vehicleTuning?.[31]?.hitch).toBe(seats);
      expect(w.vehicleTuning?.[31]?.tank).toBe(300);
      await page.keyboard.press('Escape');
      await page.keyboard.press('i');
    };
    await tune(0);
    const panel = page.locator('.charter-panel');
    await expect(panel).toContainText('0 passenger places.');
    await expect(panel).toContainText('Passengers 0/0');
    await expect(panel).toContainText('Tank 0.0/300');
    await expect(panel).toContainText('No passengers waiting on shore at this dock.');
    await panel.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: 'test-results/charter-tuning-empty.png' });
    await page.keyboard.press('Escape');
    await tune(2);
    const p = shorePlayer(guest.account.id, guest.account.name);
    for (let i = 0; i < 2; i++) {
      const q = shorePlayer(`boarded-${i}`, `Boarded ${i}`);
      act(w, c.id, { type: 'charter', operation: 'offer', player: q.id, fare: 7500, minutes: 60 });
      act(w, q.id, { type: 'charter', operation: 'accept', captain: c.id });
    }
    await expect(panel).toContainText('Passengers 2/2');
    await page.getByRole('button', { name: 'Invite Waiting guest', exact: true }).click();
    await expect.poll(() => c.charter?.offers[p.id]?.fare).toBe(7500);
    await panel.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: 'test-results/charter-tuning-full.png' });
    await page.evaluate((token) => localStorage.setItem('aclone.pilot', token), guest.token);
    await page.reload();
    await waitForWorld(page);
    c.online = true;
    await page.keyboard.press('i');
    await page.getByRole('button', { name: 'Accept & board', exact: true }).press('Enter');
    await expect(
      page.getByText('All 2 passenger places are occupied', { exact: true }),
    ).toBeVisible();
    // A refused action rolls the server back to a cloned world. Use that live state.
    const live = app.worlds.get(w.id)!;
    expect(live.players[p.id].hitch).toBeUndefined();
    expect(live.players[p.id].cash).toBe(3000000);
    await page.screenshot({ path: 'test-results/charter-tuning-refused.png' });
    act(live, c.id, { type: 'charter', operation: 'cancel' });
    act(live, c.id, { type: 'charter', operation: 'offer', player: p.id, fare: 7500, minutes: 60 });
    await page.getByRole('button', { name: 'Accept & board', exact: true }).press('Enter');
    await expect.poll(() => app.worlds.get(w.id)!.players[p.id].hitch).toBe(c.id);
    await expect(page.getByRole('heading', { name: 'Your charter' })).toBeVisible();
    expect(app.worlds.get(w.id)!.players[p.id].cash).toBe(2992500);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
