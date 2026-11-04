// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect, type BrowserContext } from '@playwright/test';
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
test('charter rules control invitations and held fares through empty, full and cash-failure states', async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-charter-rules-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let guestContext: BrowserContext | undefined;
  try {
    const captain = app.universe.register('Captain'),
      guest = app.universe.register('Guest');
    const initial = createWorld('puddlewick', 'Charter rules', 'server');
    initial.script = '';
    Object.assign(initial.settings, {
      vehicleLicences: false,
      requireCaptainSkill: false,
      hungerRate: 0,
      thirstRate: 0,
      dayLength: 0,
      time: 43200,
    });
    ensurePuddlewickBoatyard(initial);
    initial.creator = creatorSchema.parse({ scenery: false, roads: false, weather: 'clear' });
    initial.owner = captain.account.id;
    const dock = boatLandings(initial).find((d) => d.building)!;
    initial.buildings = initial.buildings.filter((b) => b.id === dock.id);
    const shore = (id: string, name: string, cash = 1000) => {
      const q = addPlayer(initial, id, name);
      Object.assign(q, dock.land, {
        y: travelHeight(initial, dock.land.x, dock.land.z),
        cash,
        online: true,
        fleet: [0, 5],
        engine: false,
      });
      return q;
    };
    const initialCaptain = shore(captain.account.id, 'Captain', 3000000);
    act(initial, initialCaptain.id, { type: 'vehicle', slot: 31, building: dock.id });
    initialCaptain.engine = false;
    app.worlds.set(initial.id, initial);
    const w = () => app.worlds.get(initial.id)!,
      c = () => w().players[captain.account.id],
      p = () => w().players[guest.account.id];
    const port = await app.listen();
    const login = async (target: typeof page, token: string) => {
      await target.addInitScript(
        ({ token }) => {
          localStorage.setItem('aclone.pilot', token);
          localStorage.setItem('aclone.world', 'puddlewick');
          localStorage.setItem('aclone.quality', 'low');
          localStorage.setItem('aclone.sound', 'off');
        },
        { token },
      );
      await target.goto(`http://127.0.0.1:${port}`);
      await waitForWorld(target);
    };
    await login(page, captain.token);
    const close = () => page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    const edit = async () => {
      await page.keyboard.press('F10');
      await page.getByRole('button', { name: 'Rules', exact: true }).click();
    };
    const group = page.getByRole('group', { name: 'Charter offers', exact: true }),
      patch = {
        charterDefaultFare: 1234,
        charterMaximumFare: 2000,
        charterDefaultMinutes: 9,
        charterMinimumMinutes: 3,
        charterMaximumMinutes: 12,
        charterMaximumOffers: 1,
        charterReturnCooldown: 7,
      };
    await edit();
    for (const [k, v] of Object.entries(patch))
      await group.locator(`[name="${k}"]`).fill(String(v));
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w().settings.charterDefaultFare).toBe(1234);
    await close();
    await edit();
    for (const [k, v] of Object.entries(patch))
      await expect(group.locator(`[name="${k}"]`)).toHaveValue(String(v));
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/charter-offer-rules.png' });
    await close();
    await page.keyboard.press('i');
    const panel = page.locator('.charter-panel');
    await expect(panel.locator('#charter-fare')).toHaveValue('12.34');
    await expect(panel.locator('#charter-fare')).toHaveAttribute('max', '20');
    await expect(panel.locator('#charter-minutes')).toHaveValue('9');
    await expect(panel.locator('#charter-minutes')).toHaveAttribute('min', '3');
    await expect(panel.locator('#charter-minutes')).toHaveAttribute('max', '12');
    await expect(panel).toContainText('No passengers waiting on shore');
    await panel.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/charter-empty-shore.png' });
    shore(guest.account.id, 'Guest');
    shore('other', 'Other');
    await panel.getByRole('button', { name: 'Invite Guest', exact: true }).click();
    await expect.poll(() => c().charter?.offers[guest.account.id]?.fare).toBe(1234);
    await panel.getByRole('button', { name: 'Invite Other', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Too many outstanding offers');
    expect(Object.keys(c().charter!.offers)).toEqual([guest.account.id]);
    await page.screenshot({ path: 'test-results/charter-offer-limit.png' });
    guestContext = await page.context().browser()!.newContext();
    const guestPage = await guestContext.newPage();
    guestPage.setDefaultTimeout(15000);
    guestPage.on('pageerror', (e) => errors.push(e.message));
    await login(guestPage, guest.token);
    await guestPage.keyboard.press('i');
    await guestPage.getByRole('button', { name: 'Accept & board', exact: true }).click();
    await expect(guestPage.locator('#toast')).toContainText('Not enough cash for the agreed fare');
    expect(p().cash).toBe(1000);
    expect(p().hitch).toBeUndefined();
    await guestPage.screenshot({ path: 'test-results/charter-cash-failure.png' });
    await panel.locator('#charter-fare').fill('10');
    await panel.getByRole('button', { name: 'Invite Guest', exact: true }).click();
    await expect.poll(() => c().charter?.offers[guest.account.id]?.fare).toBe(1000);
    const captainCash = c().cash;
    await expect(guestPage.locator('.charter-panel')).toContainText('10.00d total fare');
    await guestPage.getByRole('button', { name: 'Accept & board', exact: true }).click();
    await expect.poll(() => p().hitch).toBe(captain.account.id);
    expect(p().cash).toBe(0);
    expect(c().cash).toBe(captainCash);
    expect(c().charter!.tickets[guest.account.id].fare).toBe(1000);
    await expect(
      guestPage.getByRole('heading', { name: 'Your charter', exact: true }),
    ).toBeVisible();
    await guestPage.screenshot({ path: 'test-results/charter-held-fare.png' });
    await panel.getByRole('button', { name: 'Cancel & refund everyone', exact: true }).click();
    await expect.poll(() => p().cash).toBe(1000);
    expect(c().cash).toBe(captainCash);
    expect(p().hitch).toBeUndefined();
    await expect(
      panel.getByRole('button', { name: 'Cancel & refund everyone', exact: true }),
    ).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await guestContext?.close();
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
