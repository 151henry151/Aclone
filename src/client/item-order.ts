// SPDX-License-Identifier: GPL-3.0-or-later
import type { Stock } from '../shared/types';
const names = new Intl.Collator('en', { sensitivity: 'base', numeric: true });
/** Presentation only: stock decides the group; displayed world names decide order.
 * Never mutate the source or use prices/quantities as alphabetical tie breakers. */
export function itemEntries<T>(
  values: Record<string, T>,
  definitions: Record<string, { name: string }>,
  ...stocks: Stock[]
): [string, T][] {
  const available = (id: string) => stocks.some((stock) => (stock[id] ?? 0) > 0);
  return Object.entries(values).sort(
    ([a], [b]) =>
      Number(available(b)) - Number(available(a)) ||
      names.compare(definitions[a]?.name ?? a, definitions[b]?.name ?? b) ||
      (a < b ? -1 : a > b ? 1 : 0),
  );
}
