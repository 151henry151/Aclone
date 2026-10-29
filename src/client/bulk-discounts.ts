// SPDX-License-Identifier: GPL-3.0-or-later
import type { Building } from '../shared/types';
import { bulkDiscounts, validateBulkDiscounts } from '../shared/bulk-discounts';
export function bulkDiscountSummary(b: Building) {
  const tiers = bulkDiscounts(b);
  return tiers.length
    ? 'Bulk discounts: ' +
        tiers.map((t) => `${t.quantity}+ items: ${t.percent}% off`).join(' · ') +
        '. Per item, per purchase; the highest qualifying level applies to the whole batch.'
    : 'No bulk discounts.';
}
export function bulkDiscountEditor(b: Building) {
  const mode =
    b.bulkDiscounts === undefined ? 'default' : b.bulkDiscounts.length ? 'custom' : 'off';
  const tiers = bulkDiscounts(b);
  return `<form data-bulk-discounts><h3>Bulk purchase discounts</h3><p>Applies to all goods this business sells. Buying from suppliers is unaffected. Defaults: 100+ at 1%, 250+ at 2%, 500+ at 3%. Public import/export counters keep their posted prices.</p><label>Discount policy<select name="bulkMode">${[
    ['default', 'Use defaults'],
    ['custom', 'Custom levels'],
    ['off', 'No discounts'],
  ]
    .map(([v, n]) => `<option value="${v}" ${mode === v ? 'selected' : ''}>${n}</option>`)
    .join(
      '',
    )}</select></label><fieldset data-bulk-levels ${mode !== 'custom' ? 'disabled' : ''}>${Array.from({ length: 5 }, (_, i) => `<div class="bulk-discount-level"><label>Level ${i + 1}: minimum quantity<input aria-label="Level ${i + 1} quantity" name="bulkQuantity${i}" type="number" min="2" max="10000" step="1" value="${tiers[i]?.quantity ?? ''}"></label><label>Discount %<input aria-label="Level ${i + 1} discount" name="bulkPercent${i}" type="number" min="0" max="100" step="0.01" value="${tiers[i]?.percent ?? ''}"></label></div>`).join('')}</fieldset><p>Choose Custom levels to use the rows. Leave both fields blank to omit a level. Larger levels cannot have smaller discounts.</p><button>Save bulk discounts</button><p data-bulk-saved></p></form>`;
}
export function bulkDiscountFormValue(data: Record<string, FormDataEntryValue>) {
  if (data.bulkMode === 'default') return null;
  if (data.bulkMode === 'off') return [];
  if (data.bulkMode !== 'custom') throw Error('Choose a discount policy');
  const levels = [];
  for (let i = 0; i < 5; i++) {
    const q = String(data['bulkQuantity' + i] ?? '').trim(),
      p = String(data['bulkPercent' + i] ?? '').trim();
    if (!q && !p) continue;
    if (!q || !p) throw Error('Fill in both quantity and percentage for each bulk level');
    levels.push({ quantity: Number(q), percent: Number(p) });
  }
  return validateBulkDiscounts(levels);
}
