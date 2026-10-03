// SPDX-License-Identifier: GPL-3.0-or-later
import { cashFlow, productionReport } from '../shared/reports';
import { money } from '../shared/simulation';
import { worldItems } from '../shared/world-catalogue';
import type { World, Player, Building, Stock } from '../shared/types';
const amount = (value: number, rate = 100) => (value < 0 ? '-' : '') + money(Math.abs(value), rate);
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const goods = (stock: Stock, w: World) =>
  Object.entries(stock)
    .map(([i, n]) => `${n} ${esc(worldItems(w)[i]?.name ?? i)}`)
    .join(', ') || 'None';
export function statementHtml(w: World, p: Player, b: Building) {
  const a = p.statements?.[b.id];
  const state = `<h3>Production right now</h3><ul>${(b.productionStatus ?? productionReport(w, b))
    .map((s) => `<li>${esc(s)}</li>`)
    .join('')}</ul>`;
  if (!a)
    return (
      state +
      '<p>No private accounts available. Accounts begin with activity after this upgrade; earlier transactions are not reconstructed.</p>'
    );
  return (
    state +
    `<h3>Business statement</h3><p>Tracked since world day ${Math.floor(a.since / 600) + 1}. Cash flow is not accrual profit: goods still in storage have not been sold. Receipts exclude sales tax paid by buyers.</p><dl class="business-accounts">${[
      ['Sales receipts', a.receipts],
      ['Materials purchased', a.materials],
      ['Net wages paid', a.wages],
      ['Payroll tax', a.tax],
      ['Imports', a.imports],
      ['Other receipts', a.otherIn],
      ['Other spending', a.otherOut],
      ['Operating cash flow', cashFlow(a)],
      ['Owner capital added', a.capitalIn],
      ['Owner withdrawals', a.capitalOut],
    ]
      .map(
        ([label, n]) =>
          `<dt>${label}</dt><dd>${amount(Number(n), w.settings.denariiPerSheckle)}</dd>`,
      )
      .join(
        '',
      )}</dl><p>${a.batches} automatic batches completed.</p><ul><li>Inputs consumed: ${goods(a.consumed, w)}</li><li>Outputs made: ${goods(a.produced, w)}</li><li>Goods purchased: ${goods(a.bought, w)}</li><li>Goods sold: ${goods(a.sold, w)}</li></ul>`
  );
}
export function journalHtml(w: World, p: Player) {
  const report = p.awayReport;
  const away = report
    ? `<h3>While you were away</h3><p>${Math.round((report.until - report.from) / 60)} minutes away. Cash change: ${amount(report.cashChange)}; savings change: ${amount(report.bankChange)}.</p>${report.businesses.map((b) => `<p>${esc(b.name)}: ${b.batches} batches; ${amount(b.cashFlow)} operating cash flow.</p>`).join('')}<ul>${report.events.map((e) => `<li>${esc(e.text)}</li>`).join('') || '<li>No recorded events.</li>'}</ul>`
    : '<p>Your next return report appears after you leave and reconnect. Survival continues while offline.</p>';
  return (
    away +
    `<h3>Recent personal history</h3><p>The latest 80 events are retained. Accounts and history start with this upgrade.</p><ol>${
      [...(p.history ?? [])]
        .reverse()
        .map(
          (e) =>
            `<li>Day ${Math.floor(e.time / 600) + 1}: ${esc(e.text)}${e.amount !== undefined ? ` · ${amount(e.amount)}` : ''}</li>`,
        )
        .join('') || '<li>No recorded events yet.</li>'
    }</ol>`
  );
}
