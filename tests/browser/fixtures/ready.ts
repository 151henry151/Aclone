// SPDX-License-Identifier: GPL-3.0-or-later
import { expect, type Page } from '@playwright/test';

/** The HUD is revealed during settling, before gameplay input is enabled. */
export async function waitForWorld(page: Page) {
  await expect(page.locator('#world-hud')).toBeVisible({ timeout: 60000 });
  await expect(page.locator('#startup-loading')).toBeHidden({ timeout: 60000 });
}
