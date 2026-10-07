// SPDX-License-Identifier: GPL-3.0-or-later
import { money } from '../shared/simulation';
import type {
  CaretakerBuilding,
  CaretakerResident,
  CaretakerView,
  NamedAmount,
} from '../shared/caretaker';

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const button = (text: string, action: string, extra = '', className = '') =>
  `<button type="button" data-do="${action}" ${extra} class="${className}">${text}</button>`;
const day = (time: number) => `Day ${Math.floor(time / 600) + 1}`;
const pct = (value: number, max: number) =>
  Math.round(Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100)) * 10) / 10;
const bar = (name: string, value: number, max: number, cls: string) =>
  `<div class="need"><label>${name}</label><div class="bar"><i class="${cls}" style="width:${pct(value, max)}%"></i></div><small>${Math.round(pct(value, max))}%</small></div>`;
const goods = (rows: NamedAmount[]) =>
  rows.map((row) => `${row.quantity} ${esc(row.name)}`).join(', ') || 'None';
const cash = (value: number, rate: number) => money(value, rate);
const quotes = (rows: NamedAmount[], rate: number) =>
  rows.map((row) => `${esc(row.name)} ${cash(row.quantity, rate)}`).join(', ') || 'None';

export interface CaretakerUi {
  tab: string;
  query: string;
  selected: string;
}

function matches(query: string, ...parts: (string | undefined)[]) {
  const needle = query.trim().toLocaleLowerCase('en-US');
  if (!needle) return true;
  return parts.some((part) => part?.toLocaleLowerCase('en-US').includes(needle));
}

function residentCard(person: CaretakerResident, rate: number) {
  return `<article class="caretaker-detail"><header><h3>${esc(person.name)}</h3><p>${person.npc ? 'AI resident' : 'Pilot'} · ${person.online ? 'online' : 'offline'} · ${esc(person.activity)}</p></header><div class="caretaker-stats"><div><small>CASH</small><b>${cash(person.cash, rate)}</b></div><div><small>BANK</small><b>${cash(person.bank, rate)}</b></div><div><small>KUDOS</small><b>${person.kudos}</b></div><div><small>AGE</small><b>${person.age}</b></div></div>${bar('Health', person.health, person.maximumHealth, 'health')}${bar('Hunger', person.hunger, 50000, 'hunger')}${bar('Thirst', person.thirst, 50000, 'thirst')}${bar('Fuel', person.fuel, 64, 'fuel')}<p>${esc(person.vehicleName)} at ${person.x}, ${person.z}${person.home ? ` · home ${esc(person.home)}` : ''}${person.town ? ` · ${esc(person.town)}` : ''}${person.atHome ? ' · inside' : ''}${person.muted ? ' · muted' : ''}${person.alcohol ? ` · alcohol ${person.alcohol}` : ''}</p><p>Skills: ${person.skills.map((skill) => esc(skill.name)).join(', ') || 'None'}${person.learning ? ` · studying ${esc(person.learning.name)}` : ''}${person.jobName ? ` · job at ${esc(person.jobName)}` : ''}</p><p>Carrying: ${goods(person.inventory)}</p>${person.loans.length ? `<p>Loans: ${person.loans.map((loan) => `${esc(loan.status)} ${cash(loan.principal, rate)} at ${esc(loan.bank)}`).join('; ')}</p>` : ''}${person.credit ? `<p>Credit: ${person.credit.onTime} on time, ${person.credit.late} late, ${person.credit.defaults} defaults.</p>` : ''}${person.quests.length ? `<p>Quests: ${person.quests.map((quest) => `${esc(quest.id)} step ${quest.step}${quest.claimed ? ' claimed' : ''}`).join('; ')}</p>` : ''}<p>${person.letters} sealed letters · ${person.offers} private trade offers. Their wording is not shown.</p><h3>Activity log</h3><ol>${
    person.history
      .slice()
      .reverse()
      .map(
        (event) =>
          `<li>${day(event.time)} · ${esc(event.kind)} · ${esc(event.text)}${event.amount !== undefined ? ` · ${cash(event.amount, rate)}` : ''}</li>`,
      )
      .join('') || '<li>No recorded events yet.</li>'
  }</ol>${
    Object.keys(person.scriptState).length
      ? `<p>Script values: ${Object.entries(person.scriptState)
          .map(([key, value]) => `${esc(key)}=${value}`)
          .join(', ')}</p>`
      : ''
  }</article>`;
}

function buildingCard(place: CaretakerBuilding, rate: number) {
  return `<article class="caretaker-detail"><header><h3>${esc(place.name)}</h3><p>${esc(place.kind)} · ${esc(place.ownerName)}${place.government ? ' · public' : ''}${place.forSale ? ' · for sale ' + cash(place.price, rate) : ''} · ${place.x}, ${place.z}</p></header><div class="caretaker-stats"><div><small>TILL</small><b>${cash(place.investment, rate)}</b></div><div><small>WAGE</small><b>${cash(place.wage, rate)}</b></div><div><small>CONDITION</small><b>${place.condition.toFixed(0)}%</b></div><div><small>EFFICIENCY</small><b>${Math.round(place.efficiency * 100)}%</b></div></div><p>Stock: ${goods(place.stock)}</p><p>Buying: ${quotes(place.buy, rate)} · Selling: ${quotes(place.sell, rate)}</p><p>Staff: ${place.employees.map((employee) => esc(employee.name)).join(', ') || 'None'}</p><ul>${place.production.map((line) => `<li>${esc(line)}</li>`).join('')}</ul>${place.construction ? `<p>Construction still needs: ${goods(place.construction)}</p>` : ''}${place.accounts ? `<p>Accounts: receipts ${cash(place.accounts.receipts, rate)}, materials ${cash(place.accounts.materials, rate)}, wages ${cash(place.accounts.wages, rate)}, ${place.accounts.batches} batches.</p>` : ''}${place.stakes.length ? `<p>Outside stakes: ${place.stakes.map((stake) => `${esc(stake.name)} put in ${cash(stake.principal, rate)}, claim ${cash(stake.claim, rate)}, paid ${cash(stake.paid, rate)}`).join('; ')}</p>` : ''}${place.lodging ? `<p>Lodging ${place.lodging.open ? 'open' : 'closed'} at ${cash(place.lodging.rate, rate)} / hour. Guests: ${place.lodging.guests.map((guest) => `${esc(guest.name)} (${goods(guest.stock)})`).join(', ') || 'none'}</p>` : ''}${place.plots.length ? `<p>Plots: ${place.plots.map((plot) => (plot.crop ? esc(plot.crop) : 'empty')).join(', ')}</p>` : ''}${place.herdCondition !== undefined ? `<p>Herd condition ${place.herdCondition.toFixed(0)}%.</p>` : ''}</article>`;
}

function overview(view: CaretakerView, rate: number) {
  const census = view.census;
  return `<div class="caretaker-stats"><div><small>PILOTS</small><b>${census.pilots}</b></div><div><small>AI RESIDENTS</small><b>${census.npcs}</b></div><div><small>ONLINE</small><b>${census.online}</b></div><div><small>CASH IN POCKETS</small><b>${cash(census.cash, rate)}</b></div><div><small>IN BANKS</small><b>${cash(census.bank, rate)}</b></div><div><small>BUILDINGS</small><b>${census.buildings}</b></div><div><small>FOR SALE</small><b>${census.forSale}</b></div><div><small>UNFINISHED</small><b>${census.constructing}</b></div></div><p>${esc(view.template)} parish · ${day(view.time)} · revision ${view.revision}. ${view.privateMessages} private messages are omitted.</p><h3>Towns</h3>${view.towns.map((town) => `<p><b>${esc(town.name)}</b> · ${town.residents} residents · treasury ${cash(town.treasury, rate)} · ${esc(town.governance)}${town.mayor ? ` · mayor ${esc(town.mayor)}` : ''}</p>`).join('') || '<p>No towns.</p>'}<h3>Recent notices</h3><ol>${
    view.notices
      .slice()
      .reverse()
      .map((notice) => `<li>${day(notice.time)} · ${esc(notice.name)}: ${esc(notice.text)}</li>`)
      .join('') || '<li>No public notices.</li>'
  }</ol><details><summary>World rules</summary><dl class="caretaker-rules">${Object.entries(
    view.settings,
  )
    .map(
      ([key, value]) =>
        `<dt>${esc(key)}</dt><dd>${esc(typeof value === 'boolean' ? (value ? 'yes' : 'no') : String(value))}</dd>`,
    )
    .join('')}</dl></details>`;
}

function ledger(view: CaretakerView, rate: number) {
  return `<div class="ledger">${
    view.ledger
      .slice()
      .reverse()
      .map(
        (entry) =>
          `<div><b>${esc(entry.kind)}</b><span>${day(entry.time)} · ${esc(entry.from)} → ${esc(entry.to)} · ${esc(entry.reason)}</span><strong>${cash(entry.amount, rate)}</strong></div>`,
      )
      .join('') || '<p>No ledger entries yet.</p>'
  }</div>`;
}

export function caretakerBody(view: CaretakerView, ui: CaretakerUi, rate: number) {
  if (ui.tab === 'Residents') {
    const rows = view.residents.filter((person) =>
      matches(
        ui.query,
        person.name,
        person.npc ? 'ai npc' : 'pilot',
        person.activity,
        person.jobName,
        ...person.skills.map((skill) => skill.name),
      ),
    );
    const selected = view.residents.find((person) => person.id === ui.selected) ?? rows[0];
    return `<div class="caretaker-split"><div class="directory">${
      rows
        .map((person) =>
          button(
            `<span><b>${esc(person.name)}</b>${person.npc ? ' <small class="ai-tag">AI</small>' : ''}<small>${esc(person.activity)} · ${cash(person.cash, rate)} · hunger ${Math.round(pct(person.hunger, 50000))}%</small></span><span>${person.online ? 'online' : 'away'}</span>`,
            'caretaker-open',
            `data-id="${esc(person.id)}"`,
            person.id === selected?.id ? 'active' : '',
          ),
        )
        .join('') || '<p>No residents match.</p>'
    }</div>${selected ? residentCard(selected, rate) : ''}</div>`;
  }
  if (ui.tab === 'Buildings') {
    const rows = view.buildings.filter((place) =>
      matches(ui.query, place.name, place.kind, place.ownerName, place.recipe),
    );
    const selected = view.buildings.find((place) => place.id === ui.selected) ?? rows[0];
    return `<div class="caretaker-split"><div class="directory">${
      rows
        .map((place) =>
          button(
            `<span><b>${esc(place.name)}</b><small>${esc(place.kind)} · ${esc(place.ownerName)} · till ${cash(place.investment, rate)}</small></span><span>${place.employees.length} staff</span>`,
            'caretaker-open',
            `data-id="${esc(place.id)}"`,
            place.id === selected?.id ? 'active' : '',
          ),
        )
        .join('') || '<p>No buildings match.</p>'
    }</div>${selected ? buildingCard(selected, rate) : ''}</div>`;
  }
  if (ui.tab === 'Ledger') return ledger(view, rate);
  return overview(view, rate);
}

export function caretakerPanel(view: CaretakerView | undefined, ui: CaretakerUi, rate: number) {
  const tabs = ['Overview', 'Residents', 'Buildings', 'Ledger'];
  const nav = `<nav class="tabs">${tabs.map((tab) => button(tab, 'caretaker-tab', `data-id="${tab}"`, tab === ui.tab ? 'active' : '')).join('')}</nav>${button('Refresh', 'caretaker-refresh', '', 'quiet')}`;
  if (!view) return `${nav}<p>Reading the parish books…</p>`;
  const query =
    ui.tab === 'Residents' || ui.tab === 'Buildings'
      ? `<label>Find<input id="caretaker-query" value="${esc(ui.query)}" placeholder="${ui.tab === 'Residents' ? 'Name, skill, job' : 'Name, kind, owner'}" aria-label="Filter the caretaker list"></label>`
      : '';
  return `${nav}<p class="note">Private letters, secret ballots and the terms of unaccepted trades stay sealed. Balances, needs, skills, stocks and the activity log are live for this parish only.</p>${query}<div id="caretaker-body">${caretakerBody(view, ui, rate)}</div>`;
}
