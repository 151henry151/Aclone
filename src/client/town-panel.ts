// SPDX-License-Identifier: GPL-3.0-or-later
import { constructionTerms, ruleLabels, type PublicTown } from '../shared/civics';
import {
  categories,
  charterDefaults,
  governanceModes,
  nearestTown,
  townAt,
  townCharter,
  townRules,
  type Governance,
  type TownCharter,
  type TownRule,
} from '../shared/town-charter';
import { money } from '../shared/simulation';
import { worldBuildings } from '../shared/world-catalogue';
import type { Action, Building, Player, World } from '../shared/types';

const DAY = 600;
const esc = (s: unknown) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const hidden = (n: string, v: unknown) => `<input type="hidden" name="${n}" value="${esc(v)}">`;
const pct = (v: number) => `${Number((v * 100).toFixed(2))}%`;
const days = (w: World, until: number) => {
  const n = Math.max(0, Math.ceil((until - w.time) / DAY));
  return `${n} day${n === 1 ? '' : 's'}`;
};
const name = (w: World, id?: string) => (id ? (w.players[id]?.name ?? id) : '');
const check = (field: string, value: string, label: string, on: boolean) =>
  `<label class="check"><input type="checkbox" name="${field}" value="${esc(value)}" ${on ? 'checked' : ''}> ${esc(label)}</label>`;

export const governanceLabels: Record<Governance, string> = {
  appointed: 'Appointed mayor',
  proprietor: 'Proprietor-owned',
  election: 'Elected mayor',
  auction: 'Mayoralty auctioned',
  direct: 'Direct democracy',
};
const taxRules = ['constructionTax', 'salesTax', 'wageTax'] as const;
const taxFields = { constructionTax: 'tax', salesTax: 'salesTax', wageTax: 'wageTax' } as const;
const permissionLabels = {
  build: 'Build property',
  roads: 'Build roads',
  environment: 'Modify environment',
};

const townForm = (b: Building, operation: string, inner: string, label: string, extra = '') =>
  `<form data-town-form ${extra}>${hidden('building', b.id)}${hidden('operation', operation)}${inner}<button>${label}</button></form>`;

function describeValue(w: World, rule: TownRule, value: unknown) {
  if (typeof value === 'number')
    return taxRules.includes(rule as (typeof taxRules)[number]) ? pct(value) : money(value);
  if (typeof value === 'string')
    return rule === 'governance' ? governanceLabels[value as Governance] : value;
  const v = value as Record<string, unknown>;
  if (rule === 'treasury') return `${money(Number(v.amount))} to ${name(w, String(v.to))}`;
  if (rule === 'zoning')
    return `north: ${(v.north as string[]).join(', ') || 'nothing'}; south: ${(v.south as string[]).join(', ') || 'nothing'}`;
  return 'new settings';
}

/** One form per rule, for a mayor or owner (`rule`) or a direct-democracy resident (`propose`). */
function ruleForms(
  w: World,
  town: PublicTown,
  b: Building,
  operation: 'rule' | 'propose',
  rules: readonly TownRule[],
  owner = false,
) {
  const verb = operation === 'rule' ? 'Set' : 'Propose';
  const charter = townCharter(w);
  const form = (rule: TownRule, inner: string, label = `${verb} ${ruleLabels[rule]}`) =>
    townForm(b, operation, hidden('rule', rule) + inner, label);
  return rules
    .map((rule) => {
      if (taxRules.includes(rule as (typeof taxRules)[number]))
        return form(
          rule,
          `<label>${esc(ruleLabels[rule])} (%)<input name="percent" type="number" min="0" max="100" step="0.5" value="${Number((town[taxFields[rule as (typeof taxRules)[number]]] * 100).toFixed(2))}"></label>`,
        );
      if (rule === 'zoning')
        return form(
          rule,
          (['north', 'south'] as const)
            .map(
              (side) =>
                `<fieldset><legend>${side === 'north' ? 'North district' : 'South district'}</legend>${categories.map((c) => check(side, c, c, town.zoning[side].includes(c))).join('')}</fieldset>`,
            )
            .join(''),
        );
      if (rule === 'permissions')
        return form(
          rule,
          (['residents', 'guests'] as const)
            .map(
              (group) =>
                `<fieldset><legend>${group === 'residents' ? 'Residents' : 'Guests'}</legend>${Object.entries(permissionLabels).map(([k, label]) => check(`${group}.${k}`, 'on', label, town.permissions[group][k as 'build']))}</fieldset>`,
            )
            .join(''),
        );
      if (rule === 'governance')
        return form(
          rule,
          `<label>Form of government<select name="value">${(owner ? governanceModes : charter.governance).map((g) => `<option value="${g}" ${g === town.governance ? 'selected' : ''}>${governanceLabels[g]}</option>`).join('')}</select></label>`,
        );
      if (rule === 'name')
        return form(
          rule,
          `<label>Town name<input name="value" maxlength="32" value="${esc(town.name)}"></label>`,
          operation === 'rule' ? 'Rename town' : 'Propose new name',
        );
      if (rule === 'treasury')
        return form(
          rule,
          `<label>Pay<select name="to">${town.residents.map((id) => `<option value="${esc(id)}">${esc(name(w, id))}</option>`).join('')}</select></label><label>Amount in denarii<input name="denarii" type="number" min="0.01" step="0.01" value="1"></label>`,
          operation === 'rule' ? 'Pay from treasury' : 'Propose treasury payment',
        );
      if (rule === 'sale' && operation === 'rule' && town.governance === 'proprietor')
        return form(
          rule,
          `<label>Asking price in denarii (0 withdraws)<input name="denarii" type="number" min="0" step="0.01" value="${(town.forSale ?? 0) / 100}"></label>`,
          'Set sale price',
        );
      return '';
    })
    .join('');
}

function electionSection(w: World, me: Player, town: PublicTown, b: Building) {
  const e = town.election;
  if (!e) return town.termEnds ? `<p>Next election in ${days(w, town.termEnds)}.</p>` : '';
  const charter = townCharter(w);
  const mine = e.candidates.find((c) => c.id === me.id);
  const resident = town.residents.includes(me.id);
  let html = '';
  if (e.phase === 'registration') {
    html += `<h4>${e.kind === 'auction' ? 'Mayoral auction' : 'Candidate registration'} · closes in ${days(w, e.until)}</h4>`;
    html += `<ul>${e.candidates.map((c) => `<li>${esc(c.name)}${e.kind === 'auction' ? '' : c.bribe ? ` · offers ${money(c.bribe)} per vote` : ''}</li>`).join('') || '<li>No candidates yet</li>'}</ul>`;
    if (resident && e.kind === 'auction')
      html += townForm(
        b,
        'stand',
        `<label>Bid in denarii${mine ? ` (yours: ${money(mine.bid)})` : ''}<input name="bid" type="number" min="0.01" step="0.01" value="${(mine?.bid ?? 0) / 100 + 1}"></label>`,
        mine ? 'Raise bid' : 'Bid for mayor',
      );
    else if (resident && !mine)
      html += townForm(
        b,
        'stand',
        `<p class="note">Deposit ${money(charter.candidateDeposit)} goes to the town treasury.${charter.bribes ? ' A campaign budget is held in escrow and pays each supporter the promised amount per vote when voting closes; the rest is returned.' : ' Campaign payments are banned on this world.'}</p>${charter.bribes ? `<label>Payment per vote in denarii<input name="bribe" type="number" min="0" step="0.01" value="0"></label><label>Campaign budget in denarii<input name="budget" type="number" min="0" step="0.01" value="0"></label>` : ''}`,
        'Stand for mayor',
      );
    else if (mine) html += townForm(b, 'withdraw', '', 'Withdraw candidacy');
  } else {
    const vote = me.ballots?.[town.id]?.candidate;
    html += `<h4>Voting closes in ${days(w, e.until)}</h4>`;
    html += e.candidates
      .map((c) => {
        const n = e.tally[c.id] ?? 0;
        const text = `${esc(c.name)} · ${n} vote${n === 1 ? '' : 's'}${c.bribe ? ` · offers ${money(c.bribe)} per vote` : ''}`;
        return resident
          ? townForm(
              b,
              'vote',
              hidden('candidate', c.id) + `<span>${text}</span>`,
              `Vote for ${esc(c.name)}`,
            )
          : `<p>${text}</p>`;
      })
      .join('');
    if (vote) html += `<p>Your vote: ${esc(name(w, vote))}. Ballots are secret.</p>`;
  }
  return html;
}

function proposalSection(w: World, me: Player, town: PublicTown, b: Building) {
  const ballots = me.ballots?.[town.id]?.proposals ?? {};
  const resident = town.residents.includes(me.id);
  return town.proposals
    .map((x) => {
      const mine = ballots[x.id];
      return `<article class="notice"><h4>Proposal ${x.id}: ${esc(ruleLabels[x.rule])} to ${esc(describeValue(w, x.rule, x.value))}</h4><p>${x.tally.yes ?? 0} for · ${x.tally.no ?? 0} against · closes in ${days(w, x.closes)} · proposed by ${esc(name(w, x.by))}</p>${mine === undefined ? '' : `<p>You voted ${mine ? 'for' : 'against'}.</p>`}${
        resident
          ? townForm(b, 'ballot', hidden('proposal', x.id) + hidden('support', true), 'Support') +
            townForm(b, 'ballot', hidden('proposal', x.id) + hidden('support', false), 'Oppose')
          : ''
      }</article>`;
    })
    .join('');
}

/** The plinth panel: a town's rules, government, elections and proposals. */
export function townPanel(w: World, me: Player, b: Building) {
  const town = (w.towns as PublicTown[]).find((t) => t.plinth === b.id);
  if (!town) return '<p>This plinth belongs to no town.</p>';
  const charter = townCharter(w);
  const owner = me.authority >= 20;
  const resident = town.residents.includes(me.id);
  const mayor = town.mayor && town.mayor === me.id;
  const zone = (list: string[]) => list.join(', ') || 'nothing';
  const perms = (group: 'residents' | 'guests') =>
    Object.entries(permissionLabels)
      .filter(([k]) => town.permissions[group][k as 'build'])
      .map(([, l]) => l.toLowerCase())
      .join(', ') || 'nothing';
  let html = `<h3>Town of ${esc(town.name)}</h3><p>${governanceLabels[town.governance]}${town.governance === 'direct' ? '' : ` · Mayor: ${town.mayor ? esc(name(w, town.mayor)) : 'none'}`} · Residents: ${town.residents.length} · Border ${Math.round(town.radius)}m</p>`;
  html += `<p>Construction tax ${pct(town.tax)} · Sales tax ${pct(town.salesTax)} · Wage tax ${pct(town.wageTax)} · Treasury ${money(town.treasury)}</p>`;
  for (const t of town.pendingTaxes)
    html += `<p class="note">Scheduled: ${esc(ruleLabels[t.rule])} to ${pct(t.value)} in ${days(w, t.at)}.</p>`;
  html += `<p class="note">Zoning · north: ${zone(town.zoning.north)}; south: ${zone(town.zoning.south)}. Residents may ${perms('residents')}; guests may ${perms('guests')}.</p>`;
  html += resident
    ? townForm(b, 'leave', '', 'Give up residency')
    : townForm(
        b,
        'join',
        me.town
          ? `<p class="note">This moves your home town from ${esc(w.towns.find((t) => t.id === me.town)?.name ?? me.town)}.</p>`
          : '',
        'Become a resident',
      );
  if (town.forSale && !mayor)
    html += `<p>For sale: ${money(town.forSale)}</p>${townForm(b, 'buyTown', '', 'Buy this town')}`;
  html += electionSection(w, me, town, b);
  if (town.governance === 'direct') {
    html += proposalSection(w, me, town, b);
    if (resident)
      html += `<details><summary>Propose a rule change</summary>${ruleForms(
        w,
        town,
        b,
        'propose',
        charter.controls.filter((r) => r !== 'sale'),
      )}</details>`;
  }
  const editable = owner
    ? [...townRules]
    : mayor && town.governance !== 'direct'
      ? charter.controls
      : [];
  if (editable.length)
    html += `<details><summary>${owner && !mayor ? 'Owner controls' : 'Mayoral controls'}</summary>${ruleForms(w, town, b, 'rule', editable, owner)}</details>`;
  if (mayor) html += townForm(b, 'resign', '', 'Resign as mayor');
  if (owner && town.governance !== 'direct')
    html += townForm(
      b,
      'appoint',
      `<label>Mayor<select name="player">${Object.values(w.players)
        .map(
          (p) =>
            `<option value="${esc(p.id)}" ${p.id === town.mayor ? 'selected' : ''}>${esc(p.name)}</option>`,
        )
        .join('')}</select></label>`,
      'Appoint mayor',
    );
  return html;
}

type Entries = Iterable<[string, FormDataEntryValue | string]>;
const collect = (entries: Entries) => {
  const f = new Map<string, string[]>();
  for (const [k, v] of entries) f.set(k, [...(f.get(k) ?? []), String(v)]);
  return {
    one: (k: string) => f.get(k)?.[0],
    all: (k: string) => f.get(k) ?? [],
    has: (k: string) => f.has(k),
    cents: (k: string) => Math.round(Number(f.get(k)?.[0] ?? 0) * 100),
  };
};

/** Turn a submitted town form into the engine's `town` action. */
export function townFormAction(entries: Entries): Action {
  const f = collect(entries);
  const operation = f.one('operation')!;
  const a: Action = { type: 'town', building: f.one('building'), operation };
  if (operation === 'rule' || operation === 'propose') {
    const rule = f.one('rule') as TownRule;
    a.rule = rule;
    a.value = taxRules.includes(rule as (typeof taxRules)[number])
      ? Number(f.one('percent')) / 100
      : rule === 'zoning'
        ? { north: f.all('north'), south: f.all('south') }
        : rule === 'permissions'
          ? Object.fromEntries(
              ['residents', 'guests'].map((g) => [
                g,
                Object.fromEntries(
                  Object.keys(permissionLabels).map((k) => [k, f.has(`${g}.${k}`)]),
                ),
              ]),
            )
          : rule === 'treasury'
            ? { to: f.one('to'), amount: f.cents('denarii') }
            : rule === 'sale'
              ? f.cents('denarii')
              : f.one('value');
  }
  for (const k of ['bribe', 'budget', 'bid']) if (f.has(k)) a[k] = f.cents(k);
  if (f.has('candidate')) a.candidate = f.one('candidate');
  if (f.has('player')) a.player = f.one('player');
  if (f.has('proposal')) a.proposal = Number(f.one('proposal'));
  if (f.has('support')) a.support = f.one('support') === 'true';
  return a;
}

const charterNumbers: { key: keyof TownCharter; label: string; scale?: 'denarii' | 'percent' }[] = [
  { key: 'foundingCost', label: 'Founding cost in denarii', scale: 'denarii' },
  { key: 'maxTowns', label: 'Maximum towns' },
  { key: 'minSpacing', label: 'Minimum spacing between town centres (m)' },
  { key: 'initialRadius', label: 'Initial border radius (m)' },
  { key: 'maxRadius', label: 'Maximum border radius (m)' },
  { key: 'growthPerBuilding', label: 'Border growth per outskirts building (m)' },
  { key: 'outskirts', label: 'Outskirts band either side of the border (m)' },
  { key: 'maxTax', label: 'Maximum town tax (%)', scale: 'percent' },
  { key: 'taxNoticeDays', label: 'Tax change notice (game days)' },
  { key: 'termDays', label: 'Mayoral term (game days)' },
  { key: 'registrationDays', label: 'Candidate registration (game days)' },
  { key: 'votingDays', label: 'Voting period (game days)' },
  { key: 'minCandidates', label: 'Minimum candidates' },
  { key: 'candidateDeposit', label: 'Candidate deposit in denarii', scale: 'denarii' },
  { key: 'voterResidencyDays', label: 'Residency before voting (game days)' },
  { key: 'quorum', label: 'Proposal quorum (%)', scale: 'percent' },
  { key: 'proposalDays', label: 'Proposal voting period (game days)' },
];
const charterFlags: { key: 'founding' | 'growth' | 'bribes'; label: string }[] = [
  { key: 'founding', label: 'Players may found new towns' },
  { key: 'growth', label: 'Borders grow as the outskirts are built up' },
  { key: 'bribes', label: 'Candidates may pay supporters per vote' },
];
const charterLists = [
  {
    key: 'governance',
    label: 'Permitted forms of government (first is the default)',
    values: governanceModes,
    text: (g: string) => governanceLabels[g as Governance],
  },
  {
    key: 'controls',
    label: 'Rules town governments may change',
    values: townRules,
    text: (r: string) => ruleLabels[r as TownRule],
  },
  {
    key: 'defaultZoning',
    label: 'Default zoning for new towns',
    values: categories,
    text: (c: string) => c,
  },
] as const;

/** The world owner's charter: every rule governing towns on this world. */
export function charterForm(w: World) {
  const c = townCharter(w);
  const scaled = (v: number, scale?: string) =>
    scale === 'denarii' ? v / 100 : scale === 'percent' ? Number((v * 100).toFixed(2)) : v;
  return `<form data-charter-form><h3>Town charter</h3>${charterFlags.map((x) => check(x.key, 'on', x.label, c[x.key])).join('')}${charterNumbers
    .map(
      (x) =>
        `<label>${x.label}<input name="${x.key}" type="number" min="0" step="any" value="${scaled(c[x.key] as number, x.scale)}"></label>`,
    )
    .join(
      '',
    )}<label>Skill required to found a town<input name="foundingSkill" maxlength="40" value="${esc(c.foundingSkill)}"></label><label>Skill required to stand for mayor<input name="candidateSkill" maxlength="40" value="${esc(c.candidateSkill)}"></label><label>Construction outside town borders<select name="outside">${(
    [
      ['allow', 'Allowed, untaxed'],
      ['nearest', 'Under the nearest town’s rules'],
      ['forbid', 'Forbidden'],
    ] as const
  )
    .map(([v, l]) => `<option value="${v}" ${c.outside === v ? 'selected' : ''}>${l}</option>`)
    .join('')}</select></label>${charterLists
    .map(
      (x) =>
        `<fieldset><legend>${x.label}</legend>${x.values.map((v) => check(x.key, v, x.text(v), (c[x.key] as readonly string[]).includes(v))).join('')}</fieldset>`,
    )
    .join('')}<button>Save town charter</button></form>`;
}

export function charterFormAction(entries: Entries): Action {
  const f = collect(entries);
  const patch: Record<string, unknown> = {};
  for (const x of charterFlags) patch[x.key] = f.has(x.key);
  for (const x of charterNumbers) {
    const v = Number(f.one(x.key) ?? charterDefaults[x.key]);
    patch[x.key] =
      x.scale === 'denarii' ? Math.round(v * 100) : x.scale === 'percent' ? v / 100 : v;
  }
  patch.foundingSkill = f.one('foundingSkill') ?? '';
  patch.candidateSkill = f.one('candidateSkill') ?? '';
  patch.outside = f.one('outside') ?? 'allow';
  for (const x of charterLists) patch[x.key] = f.all(x.key);
  return { type: 'townCharter', patch };
}

export function townLocation(w: World, at: { x: number; z: number }) {
  const inside = townAt(w, at.x, at.z);
  if (inside) return `In the town of ${inside.name}`;
  const near = nearestTown(w, at.x, at.z);
  return near ? `Closest town is ${near.name}` : 'Out in the sticks';
}

/** Price, local town tax and any refusal for building `kind` where the player stands. */
export function constructionQuote(w: World, p: Player, kind: string) {
  const price = worldBuildings(w)[kind]?.price ?? 0;
  try {
    const t = constructionTerms(w, p, kind, { x: p.x, z: p.z });
    return {
      price,
      tax: t.tax,
      note: t.town ? `${t.town.name} construction tax ${pct(t.rate)}` : 'No town tax here',
    };
  } catch (e) {
    return { price, tax: 0, note: '', refusal: (e as Error).message };
  }
}

export function foundTownForm(w: World, p: Player) {
  const c = townCharter(w);
  const closed = !c.founding
    ? 'Founding new towns is disabled on this world'
    : w.towns.length >= c.maxTowns
      ? 'This world has reached its town limit'
      : c.foundingSkill && !p.skills.includes(c.foundingSkill)
        ? `Learn ${c.foundingSkill} before founding a town`
        : '';
  const head = `<h3>Found a new town</h3><p>A charter costs ${money(c.foundingCost)}. The town plinth is raised where you stand, at least ${c.minSpacing}m from other towns, with a ${c.initialRadius}m border. You become its first resident${c.governance[0] === 'direct' ? '' : ' and mayor'}.</p>`;
  return closed
    ? `${head}<p class="note">${esc(closed)}.</p>`
    : `${head}<form data-action="foundTown"><label>Town name<input name="name" maxlength="32" required></label><button>Found town</button></form>`;
}
