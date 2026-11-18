// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('garage notifications fit a phone throughout the responsive transition', async ({ page }) => {
  const css = ['style.css', 'mobile.css']
    .map((file) => readFileSync(`src/client/${file}`, 'utf8'))
    .join('\n');
  // Parse styles with the markup, as on initial page load, so no artificial
  // entrance transition is created by injecting styles after a visible toast.
  await page.setContent(
    `<style>${css}</style><main id="app"><div id="toast" class="show">Stored in the garage. Fuel, condition and cargo stay with the vehicle.</div></main>`,
  );
  await expect(page.locator('#toast')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  // Apply the same compact-layout class as MobileControls. Freeze each actual CSS
  // transition so even a fast machine checks intermediate geometry, not just its end.
  await page.evaluate(() => {
    document.documentElement.classList.add('mobile-ui', 'mobile-modal');
    for (const animation of document.getElementById('toast')!.getAnimations()) animation.pause();
  });
  for (const time of [0, 50, 100, 150, 200]) {
    const bounds = await page.evaluate((time) => {
      const toast = document.getElementById('toast')!;
      for (const animation of toast.getAnimations()) animation.currentTime = time;
      const box = toast.getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        scroll: document.documentElement.scrollWidth,
        width: innerWidth,
      };
    }, time);
    expect(bounds.left, `left edge at ${time} ms`).toBeGreaterThanOrEqual(0);
    expect(bounds.right, `right edge at ${time} ms`).toBeLessThanOrEqual(bounds.width);
    expect(bounds.scroll, `document width at ${time} ms`).toBeLessThanOrEqual(bounds.width);
  }
});
