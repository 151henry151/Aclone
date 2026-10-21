// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Building } from '../shared/types';
import { hiringLimit, recommendedHiringLimit } from '../shared/staffing';
import { businessEconomics } from '../shared/business-economics';
import { money } from '../shared/simulation';
const esc = (v: unknown) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function staffingPanel(w: World, b: Building) {
  const limit = hiringLimit(w, b),
    recommended = recommendedHiringLimit(w, b);
  return `<section><h3>Staffing & hiring</h3><p>${b.employees.length} employed · ${limit} paid places · ${recommended} recommended. ${b.kind === 'farm' ? 'Farm wages are paid for completed harvests, not per automatic batch.' : 'The recommendation allows for unpaid owner operation. Excess active workers slow production and still receive wages.'}</p><form data-action="staffing"><input type="hidden" name="building" value="${esc(b.id)}"><label>Maximum paid employees<input name="limit" type="number" min="0" max="16" step="1" required value="${limit}"></label><button>Save hiring limit</button></form><form data-action="staffing"><input type="hidden" name="building" value="${esc(b.id)}"><input type="hidden" name="automatic" value="true"><button>Use automatic recommended limit</button></form><p class="note">Zero closes hiring. Reducing the limit does not dismiss existing workers. Dismissed workers may reapply after one real hour; finish any task first.</p><ul>${b.employees.map((id) => `<li>${esc(b.employeeNames?.[id] ?? w.players[id]?.name ?? id)}<form data-action="staffing"><input type="hidden" name="building" value="${esc(b.id)}"><input type="hidden" name="dismiss" value="${esc(id)}"><button>Dismiss ${esc(b.employeeNames?.[id] ?? w.players[id]?.name ?? id)}</button></form></li>`).join('') || '<li>No employees.</li>'}</ul></section>`;
}
export function economicsPanel(w: World, b: Building) {
  if (b.kind === 'farm')
    return '<h3>Harvest pay</h3><p>Farms pay the worker who completes a harvest. Extra employees do not multiply the wage for that harvest. Compare crop proceeds with seeds, supplies, taxes and harvest wages; factory hourly estimates do not apply.</p>';
  const e = businessEconomics(w, b);
  if (!e) return '';
  const m = (v: number) =>
    (v < 0 ? '-' : '') + money(Math.round(Math.abs(v)), w.settings.denariiPerSheckle);
  const c = e.current;
  return `<h3>Estimated production margins</h3><p>${c.paidWorkers} active paid workers${c.ownerOperating ? ' + 1 unpaid owner' : ''}; ${e.ideal} ideal total crew. Per completed batch: ${m(e.revenue)} sale proceeds after tax − ${m(e.inputs)} replacement inputs − ${m(c.payroll)} gross wages = <b>${m(c.margin)}</b>.</p><p>${e.hourlyReliable ? `At ${Math.round(c.efficiency * 100)}% speed: ${c.batchesPerHour.toFixed(2)} batches and <b>${m(c.profitPerHour)} potential contribution per real hour</b>.` : esc(e.caveat)}</p><details><summary>Compare staffing levels</summary><ul>${e.scenarios.map((s) => `<li>${s.paidWorkers} paid workers${s.ownerOperating ? ' + unpaid owner' : ''}: ${Math.round(s.efficiency * 100)}% speed, ${m(s.payroll)} wages/batch, ${m(s.margin)} margin/batch${e.hourlyReliable ? `, ${m(s.profitPerHour)}/hour` : ''}</li>`).join('')}</ul></details><p class="note">${esc(e.basis)} Actual cash flow is shown separately in the Statement tab.</p>`;
}
