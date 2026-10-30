import type { PlaytimeStatistics } from '../shared/player-statistics';
import { economicsPanel } from './staffing-panel';
// SPDX-License-Identifier: GPL-3.0-or-later
import { cashFlow, productionReport } from '../shared/reports';
import { businessHealth } from '../shared/business-health';
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
  const health = businessHealth(w, { ...b, accounts: a });
  const state =
    economicsPanel(w, b) +
    `<h3>Production right now</h3><ul>${(b.productionStatus ?? productionReport(w, b))
      .map((s) => `<li>${esc(s)}</li>`)
      .join('')}</ul>`;
  if (!a)
    return (
      state +
      '<p>No private accounts available. Accounts begin with activity after this upgrade; earlier transactions are not reconstructed.</p>'
    );
  return (
    state +
    `<h3>Can this business keep going?</h3><p>${health.inputBatches === null ? 'No batch input estimate.' : `${health.inputBatches} batches of inputs in stock.`} ${health.outputRoom === null ? '' : `Room for ${health.outputRoom} output batches.`} ${health.fundedReplacementBatches === null ? '' : `Till can fund about ${health.fundedReplacementBatches} replacement batches at current input estimates and staffing.`}</p><p>${health.observedSalesPerHour === null ? 'Not enough trading history yet.' : `Recorded sales: ${health.observedSalesPerHour.toFixed(1)} units/hour.`} ${health.cashRunwayHours === null ? '' : `At the recorded cash-loss rate, the till lasts about ${health.cashRunwayHours.toFixed(1)} hours.`}</p><p>Stored goods: ${amount(health.stockReferenceValue, w.settings.denariiPerSheckle)} at catalogue prices, not cash earned.</p><ul>${health.messages
      .filter((s) => !(b.productionStatus ?? productionReport(w, b)).includes(s))
      .map((s) => `<li>${esc(s)}</li>`)
      .join('')}</ul><p class="note">${health.basis}</p>` +
    `<h3>Business statement</h3><p>Tracked since world day ${Math.floor(a.since / 600) + 1}. Cash flow is not accrual profit: goods still in storage have not been sold. Receipts exclude sales tax withheld from posted prices.</p><dl class="business-accounts">${[
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
      ['Lending repayments received', a.financingIn ?? 0],
      ['Loans advanced', a.financingOut ?? 0],
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

export function statisticsHtml(w: World, p: Player, time?: PlaytimeStatistics, error = '') {
  const duration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    return `${Math.floor(minutes / 60).toLocaleString()}h ${minutes % 60}m`;
  };
  const s = p.statistics;
  const line = (label: string, value: string | number) => `<dt>${label}</dt><dd>${value}</dd>`;
  const playtime = time
    ? `<dl class="business-accounts">${line('Total playtime on this server', duration(time.recordedSeconds + time.estimatedSeconds))}${line('Estimated from historical logs', duration(time.estimatedSeconds))}${line('Recorded since tracking began', duration(time.recordedSeconds))}</dl>
    <p class="note">Historical time is a minimum reconstructed from complete connection records; missing logs and older space travel cannot be recovered. The estimate is included in your total. New tracking began ${esc(new Date(time.since).toLocaleString())} and includes connected time in worlds and space, including idle time. Offline time and paused worlds do not count.</p>`
    : `<p>${error ? esc(error) : 'Loading playtime…'}</p>`;
  const activities = s
    ? `<dl class="business-accounts">${line('Money earned', amount(s.earned, w.settings.denariiPerSheckle))}${line('Money spent / lost', amount(s.spent, w.settings.denariiPerSheckle))}${line('Other money received', amount(s.otherReceived, w.settings.denariiPerSheckle))}${line('Capital / loan money received', amount(s.capitalIn, w.settings.denariiPerSheckle))}${line('Capital / loan money paid', amount(s.capitalOut, w.settings.denariiPerSheckle))}${line('Buildings completed while owned', s.buildingsCompleted)}</dl>
    <p class="note">${s.partialHistory ? 'These activity counters start with this update; earlier activity is unknown.' : 'These activity counters cover this character since joining this world.'} They survive death. Earnings include sales, wages, labour and prizes, before deducting expenses. Gifts, starting cash and refunds are other receipts; investments and loans are separate. Deposits and withdrawals of personal savings are excluded. Business tills have their own journal accounts.</p>
    <h3>Materials gathered</h3><p>${goods(s.gathered, w)}</p><h3>Crops harvested into farm stockrooms</h3><p>${goods(s.harvested, w)}</p>`
    : '<p>Activity tracking starts after this update; earlier totals are unknown.</p>';
  return `<h3>Playtime</h3>${playtime}<h3>${esc(w.name)} · personal statistics</h3>
    <dl class="business-accounts">${line('Deaths (existing lifetime record)', p.deaths)}${line('Bug-bounty rewards received', s?.bugBounties ?? 0)}${line('Buildings currently owned', w.buildings.filter((b) => b.owner === p.id && !b.construction).length)}</dl>
    ${activities}<p class="note">Money and activity totals belong to this world. Visit another world to view its statistics. Playtime covers your account across this server. Reopen this page to refresh playtime.</p>`;
}
