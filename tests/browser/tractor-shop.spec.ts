// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation.ts';
import { waitForWorld } from './fixtures/ready';
import { creatorSchema } from '../../src/shared/creator.ts';
import { tractorSlots } from '../../src/shared/tractors.ts';
for (const mobile of [false, true])
  test(`${mobile ? 'phone' : 'desktop'} garage previews, buys and recalls a specialist tractor`, async ({
    browser,
  }) => {
    const dir = mkdtempSync(join(tmpdir(), 'aclone-tractor-shop-'));
    const app = await createApp({ dataDir: dir, port: 0, dev: true });
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      const { account, token } = app.universe.register('Test tractor buyer');
      const w = createWorld('tractors', 'Tractors', account.id),
        p = addPlayer(w, account.id, account.name);
      w.script = '';
      w.creator = creatorSchema.parse({ scenery: false, roads: false, weather: 'clear' });
      w.settings.hungerRate = w.settings.thirstRate = 0;
      w.settings.dayLength = 0;
      w.settings.time = 43200;
      const garage = makeBuilding('test-garage', 'garage', 0, 0);
      w.buildings = [garage];
      p.x = 0;
      p.z = 10;
      p.inventory = { fuel: 8 };
      p.cash = 1000000;
      p.tractorPaint = 'blue';
      app.worlds.set(w.id, w);
      const port = await app.listen();
      await page.addInitScript(
        ({ token, id }) => {
          localStorage.setItem('aclone.pilot', token);
          localStorage.setItem('aclone.world', id);
          localStorage.setItem('aclone.quality', 'low');
        },
        { token, id: w.id },
      );
      await page.goto(`http://127.0.0.1:${port}`);
      await waitForWorld(page);
      await page.keyboard.press('e');
      const choice = page.getByLabel('Tractor model');
      await expect(choice).toBeVisible();
      for (const slot of tractorSlots) {
        await choice.selectOption(String(slot));
        await expect(page.locator('#tractor-preview canvas')).toBeVisible();
        await expect(page.locator('#tractor-specs h4')).toContainText(
          slot === 0
            ? 'Puddle'
            : slot === 24
              ? 'Orchard'
              : slot === 25
                ? 'Swift'
                : slot === 26
                  ? 'Barley'
                  : slot === 27
                    ? 'Fenlander'
                    : 'Lamplighter',
        );
      }
      await page.getByRole('button', { name: 'Buy Lamplighter', exact: true }).click();
      await expect.poll(() => p.vehicle).toBe(28);
      await expect.poll(() => p.fuel).toBe(0);
      await expect(page.locator('#tractor-specs')).toContainText('Currently driving');
      const paintShop = page.locator('#tractor-specs .vehicle-paint-shop');
      await expect(paintShop).toContainText('Factory colour');
      await paintShop.getByRole('button', { name: 'Plum purple', exact: true }).click();
      await expect.poll(() => p.vehiclePaints?.[28]).toBe('plum');
      await expect(paintShop).toContainText('Finish: Plum purple');
      await choice.selectOption('0');
      await expect(paintShop).toContainText('Finish: Harbour blue');
      await paintShop.getByRole('button', { name: 'Moss green', exact: true }).click();
      await expect.poll(() => p.vehiclePaints?.[0]).toBe('moss');
      expect(p.vehiclePaints?.[28]).toBe('plum');
      await choice.selectOption('28');
      await expect(paintShop).toContainText('Finish: Plum purple');

      // A paint acknowledgement may replace the preview once while scrolling.
      // Resolve the current locator again, retaining the viewport assertion.
      await expect(async () => {
        await page.locator('#tractor-preview').scrollIntoViewIfNeeded();
        await expect(page.locator('#tractor-preview')).toBeInViewport();
      }).toPass({ timeout: 10000 });
      await page.screenshot({
        path: `test-results/tractor-shop-${mobile ? 'phone' : 'desktop'}.png`,
      });
      await page.getByRole('button', { name: 'Close dialog' }).click();
      // Test authoritative recall through the regular UI, not a debug hook.
      await page.keyboard.press('i');
      await page.getByRole('button', { name: 'Switch to walking', exact: true }).click();
      await expect.poll(() => p.vehicle).toBe(5);
      await page.keyboard.press('i');
      await page.getByRole('button', { name: 'Return to tractor', exact: true }).click();
      await expect.poll(() => p.vehicle).toBe(28);
      expect(p.fleet).toContain(28);
      await page.keyboard.press('c');
      await page.keyboard.press('h');
      await page.screenshot({
        path: `test-results/tractor-cockpit-${mobile ? 'phone' : 'desktop'}.png`,
      });
      if (!mobile) {
        const checks = await page.evaluate(async () => {
          const modelPath = '/src/client/tractor-fleet.ts',
            cockpitPath = '/src/client/tractor-cockpit.ts';
          const threePath = '/node_modules/three/build/three.module.js';
          const { fleetTractor } = await import(modelPath);
          const { updateTractorCockpit } = await import(cockpitPath);
          const T = await import(threePath);
          const results = [];
          for (const slot of [0, 24, 25, 26, 27, 28]) {
            const group = new T.Group();
            fleetTractor(group, slot);
            const steering = group.userData.steering;
            const top = new T.Vector3(0, 0.23, 0).applyEuler(steering.rotation);
            const panel = group.userData.cockpit.panel,
              base = panel.material.map;
            const pilot = { vehicle: slot, fuel: 20, speed: 4, engine: true, lights: false };
            updateTractorCockpit(group, pilot, 1);
            const live = panel.material.map,
              first = live.version;
            pilot.speed = 9;
            pilot.lights = true;
            updateTractorCockpit(group, pilot, 1.1);
            const throttled = live.version;
            updateTractorCockpit(group, pilot, 1.3);
            const changed = live.version;
            updateTractorCockpit(group, pilot, 1.6);
            let triangles = 0;
            group.traverse((o: any) => {
              if (o.isMesh)
                triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
            });
            results.push({
              slot,
              topForward: top.z > 0,
              topAbove: top.y > 0,
              faceTriangles: panel.geometry.index.count / 3,
              attached: !!panel.parent?.parent,
              privateTexture: live !== base && base.userData.shared && !live.userData.shared,
              throttled: first === throttled,
              updated: changed > first,
              unchanged: changed === live.version,
              lit: panel.material.emissiveIntensity > 0.1,
              triangles,
            });
            group.traverse((o: any) => {
              if (!o.isMesh) return;
              if (!o.geometry.userData.shared) o.geometry.dispose();
              for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
                if (m.userData.shared) continue;
                if (m.map && !m.map.userData.shared) m.map.dispose();
                m.dispose();
              }
            });
          }
          return results;
        });
        for (const check of checks) {
          expect(
            check.topForward && check.topAbove,
            `slot ${check.slot}: wheel tips away from driver`,
          ).toBe(true);
          expect(check.faceTriangles).toBeLessThanOrEqual(16);
          expect(
            check.attached &&
              check.privateTexture &&
              check.throttled &&
              check.updated &&
              check.unchanged &&
              check.lit,
          ).toBe(true);
          expect(check.triangles).toBeLessThan(14000);
        }
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
