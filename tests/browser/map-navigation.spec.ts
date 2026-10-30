// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { aircraftHangarIcon } from '../../src/client/map-icons';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
test('crowded icons reveal names, while remote zoom and live snapshots preserve the explored place', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-map-nav-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const port = await app.listen();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.route('**/__map-nav', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/src/client/style.css"><style>body{padding:30px}#map{width:1100px;margin:auto}</style><h1>Parish map</h1><div id="map"></div><script type="module">
 import {ParishMap} from '/src/client/parish-map.ts';import {createWorld,makeBuilding,addPlayer} from '/src/shared/simulation.ts';
 const w=createWorld('map','Map','owner');w.settings.mapSize=20000;
 w.buildings=Array.from({length:48},(_,i)=>{const b=makeBuilding('site-'+i,['home','bakery','dairy','market','quarry','boathouse'][i%6],(i%8)*25-80,Math.floor(i/8)*25-60);b.name='Business '+i;return b;});
 w.buildings[0].kind='garage';w.buildings[0].aircraftHangar=true;
 const far=makeBuilding('far','market',4200,3600);far.name='Distant trading post';w.buildings.push(far);
 const p=addPlayer(w,'owner','Explorer');const map=new ParishMap(document.getElementById('map'),w,p,{get:()=>window.waypoint,set:p=>window.waypoint=p});
 window.testMap={map,w,p};</script>`,
      }),
    );
    await page.goto(`http://127.0.0.1:${port}/__map-nav`);
    await expect(page.locator('.map-icon[data-site="site-0"]')).toBeVisible();
    expect(await page.locator('.map-show-name').count()).toBe(0);
    const distance = page.locator('.parish-map-distance');
    await expect(distance).toHaveAccessibleName(/Map distance scale: [\d.]+ m$/);
    const checkDistance = async () => {
      const actual = await distance.evaluate((el) => {
        const text = el.querySelector('[data-distance-label]')!.textContent!;
        const metres = parseFloat(text) * (text.endsWith('km') ? 1000 : 1);
        return {
          width: el.getBoundingClientRect().width,
          expected: metres * (window as any).testMap.map.scale,
        };
      });
      expect(Math.abs(actual.width - actual.expected)).toBeLessThan(1);
    };
    await checkDistance();
    const icon = page.getByRole('button', { name: 'Business 0', exact: true });
    await expect(icon.locator('svg path')).toHaveAttribute('d', aircraftHangarIcon);
    await icon.hover();
    await expect(icon.locator('.map-icon-name')).toBeVisible();
    await icon.click();
    expect(await page.evaluate(() => (window as any).waypoint.name)).toBe('Business 0');
    await page.mouse.move(10, 10);
    await page.screenshot({ path: 'test-results/map-icons.png' });
    for (let i = 0; i < 5; i++)
      await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
    await expect(distance).toHaveAccessibleName(/Map distance scale: [\d.]+ km$/);
    await checkDistance();
    await page.screenshot({ path: 'test-results/map-scale-kilometres.png' });
    const far = page.getByRole('button', { name: 'Distant trading post', exact: true });
    await far.scrollIntoViewIfNeeded();
    await far.hover();
    await page.waitForTimeout(250);
    const before = await far.boundingBox();
    expect(before).not.toBeNull();
    const anchor = await page.evaluate((point) => {
      const m = (window as any).testMap.map,
        r = m.viewport.getBoundingClientRect();
      const px = Math.round(point.x + 12) - r.left - m.viewport.clientLeft,
        py = Math.round(point.y + 12) - r.top - m.viewport.clientTop;
      return {
        x: m.bounds.x + (m.viewport.scrollLeft + px - m.offsetX) / m.scale,
        z: m.bounds.z + (m.viewport.scrollTop + py - m.offsetY) / m.scale,
        px,
        py,
      };
    }, before!);
    await page.locator('.parish-map-viewport').evaluate(
      (el, point) =>
        el.dispatchEvent(
          new WheelEvent('wheel', {
            deltaY: -1600,
            clientX: Math.round(point.x + 12),
            clientY: Math.round(point.y + 12),
            bubbles: true,
            cancelable: true,
          }),
        ),
      before!,
    );
    await expect
      .poll(async () => parseInt((await page.locator('.parish-map-zoom').textContent())!))
      .toBeGreaterThan(100);
    const drift = await page.evaluate((a) => {
      const m = (window as any).testMap.map;
      return {
        x: Math.abs(m.offsetX + (a.x - m.bounds.x) * m.scale - m.viewport.scrollLeft - a.px),
        y: Math.abs(m.offsetY + (a.z - m.bounds.z) * m.scale - m.viewport.scrollTop - a.py),
      };
    }, anchor);
    expect(drift.x).toBeLessThan(2);
    expect(drift.y).toBeLessThan(2);
    const after = await far.boundingBox(); // A 55× wheel zoom magnifies subpixel rounding of synthetic event coordinates; the exact world anchor above must remain within two pixels.
    expect(Math.abs(after!.x - before!.x)).toBeLessThan(30);
    expect(Math.abs(after!.y - before!.y)).toBeLessThan(30);
    await page.evaluate(() => {
      const { map, w, p } = (window as any).testMap;
      p.x = 90;
      p.z = 80;
      w.time += 30;
      map.update(w, p);
    });
    const refreshed = await far.boundingBox();
    expect(Math.abs(refreshed!.x - after!.x)).toBeLessThan(4);
    await far.focus();
    await expect(far.locator('.map-icon-name')).toBeVisible();
    await page.screenshot({ path: 'test-results/map-remote-zoom.png' });
    await page.getByRole('button', { name: 'Find me', exact: true }).click();
    await expect(page.locator('[data-player-id="owner"]')).toBeInViewport();
    await expect(distance).toHaveAccessibleName(/Map distance scale: [\d.]+ m$/);
    await checkDistance();
    await page.getByRole('button', { name: 'Fit parish', exact: true }).click();
    for (let i = 0; i < 6; i++)
      await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect(page.locator('.parish-map-zoom')).toHaveText('400%');
    await page.mouse.move(10, 10);
    const inspectNames = () =>
      page.locator('.parish-map-viewport').evaluate((el) => {
        const r = el.getBoundingClientRect();
        return [...el.querySelectorAll<HTMLElement>('.map-icon')]
          .filter((b) => {
            const a = b.getBoundingClientRect();
            return (
              a.left >= r.left + 1 &&
              a.top >= r.top + 1 &&
              a.right < r.right - 1 &&
              a.bottom < r.bottom - 1
            );
          })
          .map((b) => getComputedStyle(b.querySelector('.map-icon-name')!).display !== 'none');
      });
    const names = await inspectNames();
    expect(names.length).toBeGreaterThan(0);
    expect(names.every(Boolean)).toBe(true);
    await page.screenshot({ path: 'test-results/map-close-labels.png' });
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect(page.locator('.parish-map-zoom')).toHaveText('500%');
    await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Fit parish', exact: true }).click();
    expect(await page.locator('.map-show-name').count()).toBe(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#map').evaluate((el) => {
      el.style.width = '100%';
    });
    await expect(distance).toBeInViewport();
    await checkDistance();
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
