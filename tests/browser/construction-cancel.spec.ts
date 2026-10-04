// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { createWorld, addPlayer, act } from '../../src/shared/simulation.ts';
import { creatorSchema } from '../../src/shared/creator.ts';
import { constructionRefund } from '../../src/shared/construction.ts';
for (const mobile of [false, true]) {
  test(`${mobile ? 'phone' : 'desktop'} owner can review and cancel unfinished construction for the quoted refund`, async ({
    browser,
  }) => {
    const context = await browser.newContext(
      mobile
        ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
        : { viewport: { width: 960, height: 600 } },
    );
    const page = await context.newPage();
    const dir = mkdtempSync(join(tmpdir(), 'aclone-cancel-'));
    const app = await createApp({ dataDir: dir, port: 0, dev: true });
    try {
      const { account, token } = app.universe.register('Builder');
      const w = createWorld('cancel', 'Construction', account.id);
      w.buildings = [];
      w.zones = [];
      w.script = '';
      w.creator = creatorSchema.parse({ scenery: false, roads: false, weather: 'clear' });
      const p = addPlayer(w, account.id, account.name);
      p.cash = 1000000;
      act(w, p.id, { type: 'construct', kind: 'home' });
      const b = w.buildings[0],
        before = p.cash,
        refund = constructionRefund(w, b);
      p.z += 13;
      app.worlds.set(w.id, w);
      const port = await app.listen();
      await page.addInitScript(
        ({ token }) => {
          localStorage.setItem('aclone.pilot', token);
          localStorage.setItem('aclone.world', 'cancel');
          localStorage.setItem('aclone.quality', 'low');
        },
        { token },
      );
      await page.goto(`http://127.0.0.1:${port}`);
      await expect(page.locator('#world-hud')).toBeVisible({ timeout: 60000 });
      const target = page.locator('#target button');
      if (mobile) await target.tap();
      else await target.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toContainText('Materials still needed');
      await dialog.locator('summary', { hasText: 'Cancel construction' }).click();
      await expect(dialog).toContainText('75% of the base cash cost');
      await expect(dialog).toContainText('materials already delivered are not returned');
      const cancel = dialog.getByRole('button', { name: 'Cancel building and receive refund' });
      if (mobile) await cancel.tap();
      else await cancel.click();
      await expect.poll(() => w.buildings.length).toBe(0);
      expect(p.cash).toBe(before + refund);
      await expect(dialog).toHaveCount(0);
    } finally {
      await context.close();
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
