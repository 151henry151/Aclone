// SPDX-License-Identifier: GPL-3.0-or-later
import { buildings } from './catalog.ts';
import type { Building, World } from './types.ts';

/** Resolve rather than copy into saves, so existing properties receive balancing
 * changes without resetting their stock, prices, wages or employee roster. */
export function idealEmployees(w: World, b: Building): number {
  const template = b.templateId ? w.catalogue?.templates[b.templateId] : undefined;
  return template?.idealEmployees ?? buildings[b.kind]?.idealEmployees ?? 1;
}
export function staffingEfficiency(active: number, ideal: number): number {
  return active <= 0 ? 0 : Math.min(active / ideal, ideal / active);
}
