// SPDX-License-Identifier: GPL-3.0-or-later
import { z } from 'zod';
import type { World, Player, Action, Building } from './types.ts';
import { mapHalf, terrainHeight } from './terrain.ts';
import { log, makeBuilding } from './simulation.ts';
import { say } from './messages.ts';
import { worldBuildings } from './world-catalogue.ts';
import {
  buildingCategory,
  categories,
  charterDefaults,
  governanceModes,
  nearestTown,
  townAt,
  townCharter,
  townRefusal,
  townRules,
  type Category,
  type Election,
  type Governance,
  type Permissions,
  type Proposal,
  type Town,
  type TownRule,
} from './town-charter.ts';

const DAY = 600;
export * from './town-charter.ts';

function requireThat(condition: unknown, message: string): asserts condition {
  if (!condition) throw Error(message);
}
function text(value: unknown, max = 32) {
  requireThat(
    typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max,
    'Invalid text',
  );
  return value.trim().replace(/\s+/g, ' ');
}

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'town';

export function uniqueTownId(w: World, name: string) {
  const base = slug(name);
  let id = base;
  for (let n = 2; w.towns.some((t) => t.id === id); n++) id = base + '-' + n;
  return id;
}

const openPermissions = (): Permissions => ({ build: true, roads: true, environment: true });

/** Fill borders, treasury and governance into towns saved before multi-town support. */
export function normalizeTowns(w: World) {
  const charter = townCharter(w);
  w.towns.forEach((t, i) => {
    const plinth =
      w.buildings.find((b) => b.id === t.plinth) ??
      (i === 0 ? w.buildings.find((b) => b.kind === 'town') : undefined);
    const legacy = t.salesTax === undefined;
    t.id ??= uniqueTownId(w, t.name);
    if (plinth) t.plinth ??= plinth.id;
    t.x ??= plinth?.x ?? 0;
    t.z ??= plinth?.z ?? 0;
    t.radius ??= Math.min(300, mapHalf(w));
    t.treasury ??= 0;
    t.tax ??= 0;
    if (legacy) t.salesTax = t.tax;
    t.wageTax ??= 0;
    t.zoning ??= { north: [...categories], south: [...categories] };
    t.permissions ??= { residents: openPermissions(), guests: openPermissions() };
    t.governance ??= charter.governance[0] ?? 'appointed';
    t.residents ??= [];
    t.residentSince ??= Object.fromEntries(t.residents.map((id) => [id, 0]));
    t.wars ??= [];
    t.pendingTaxes ??= [];
    t.proposals ??= [];
    t.proposalSeq ??= 0;
  });
  for (const p of Object.values(w.players)) {
    const home = p.town && w.towns.find((t) => t.id === p.town || t.name === p.town);
    if (home) p.town = home.id;
  }
}

const listed = (words: readonly string[]) =>
  words.length > 1 ? words.slice(0, -1).join(', ') + ' and ' + words.at(-1) : words.join('');

/** The town whose rules govern a site, after the charter's outside-border policy. */
export function governingTown(w: World, x: number, z: number) {
  const charter = townCharter(w);
  const town = townAt(w, x, z);
  if (town || !w.towns.length || charter.outside === 'allow') return town;
  requireThat(
    charter.outside === 'nearest',
    'This world only allows construction inside a town border',
  );
  return nearestTown(w, x, z);
}

/** Validates town zoning and permissions; returns the town tax due on top of the base price. */
export function constructionTerms(
  w: World,
  p: Player,
  kind: string,
  site: { x: number; z: number },
): { town?: Town; rate: number; tax: number } {
  const town = governingTown(w, site.x, site.z);
  if (!town) return { tax: 0, rate: 0 };
  const refusal = townRefusal(w, p.id, site.x, site.z, 'build', town);
  requireThat(!refusal, refusal!);
  const allowed = town.zoning[site.z < town.z ? 'north' : 'south'];
  requireThat(
    allowed.includes(buildingCategory(w, kind)),
    allowed.length
      ? `Only ${listed(allowed)} buildings may be built here in ${town.name}`
      : `No construction is permitted here in ${town.name}`,
  );
  const price = worldBuildings(w)[kind]?.price ?? 0;
  return { town, rate: town.tax, tax: Math.round(price * (1 + town.tax)) - price };
}

/** New construction near a border extends it, short of the charter maximum and neighbours. */
export function growTown(w: World, site: { x: number; z: number }) {
  const charter = townCharter(w);
  if (!charter.growth) return;
  const town = townAt(w, site.x, site.z) ?? nearestTown(w, site.x, site.z);
  if (!town) return;
  const d = Math.hypot(site.x - town.x, site.z - town.z);
  if (Math.abs(d - town.radius) > charter.outskirts) return;
  const room = Math.min(
    charter.maxRadius,
    mapHalf(w) - Math.max(Math.abs(town.x), Math.abs(town.z)),
    ...w.towns
      .filter((t) => t !== town)
      .map((t) => Math.hypot(t.x - town.x, t.z - town.z) - t.radius),
  );
  const radius = Math.min(room, Math.round(Math.max(town.radius, d) + charter.growthPerBuilding));
  if (radius > town.radius) town.radius = radius;
}

/** Moves a town's share of a payment from a payer into its treasury. */
export function payTown(w: World, town: Town, from: string, amount: number, reason: string) {
  if (amount <= 0) return;
  town.treasury += amount;
  log(w, 'transfer', amount, from, 'town:' + town.id, reason);
}

/** After a layout import, each town centres on its plinth, claiming an unused one if needed. */
export function anchorTowns(w: World) {
  const claimed = new Set<string>();
  for (const t of w.towns) {
    const plinth =
      w.buildings.find((b) => b.id === t.plinth && b.kind === 'town') ??
      w.buildings.find(
        (b) => b.kind === 'town' && !claimed.has(b.id) && !w.towns.some((o) => o.plinth === b.id),
      );
    if (!plinth) {
      delete t.plinth;
      continue;
    }
    claimed.add(plinth.id);
    Object.assign(t, { plinth: plinth.id, x: plinth.x, z: plinth.z });
  }
}

export function townOfPlinth(w: World, b: Building) {
  return w.towns.find((t) => t.plinth === b.id);
}

function leaveTown(w: World, p: Player) {
  for (const t of w.towns) {
    if (!t.residents.includes(p.id)) continue;
    if (t.election?.phase === 'registration') withdrawCandidate(w, t, p.id);
    t.residents = t.residents.filter((id) => id !== p.id);
    delete t.residentSince[p.id];
    if (t.mayor === p.id && t.governance !== 'proprietor') delete t.mayor;
  }
  delete p.town;
}
function joinTown(w: World, p: Player, t: Town) {
  if (t.residents.includes(p.id)) return;
  leaveTown(w, p);
  t.residents.push(p.id);
  t.residentSince[p.id] = w.time;
  p.town = t.id;
}

export function findTown(w: World, name: string) {
  const key = name.trim().toLowerCase();
  return w.towns.find((t) => t.id === key || t.name.toLowerCase() === key);
}
export function setHomeTown(w: World, p: Player, t: Town) {
  joinTown(w, p, t);
}
export function residentList(w: World, t: Town) {
  return `${t.name}: ${t.residents.map((id) => w.players[id]?.name ?? id).join(', ') || 'no residents'}`;
}

function foundTown(w: World, p: Player, a: Action) {
  const charter = townCharter(w);
  requireThat(charter.founding, 'Founding new towns is disabled on this world');
  requireThat(w.towns.length < charter.maxTowns, 'This world has reached its town limit');
  requireThat(
    !charter.foundingSkill || p.skills.includes(charter.foundingSkill),
    `Learn ${charter.foundingSkill} before founding a town`,
  );
  const name = text(a.name);
  requireThat(
    !w.towns.some((t) => t.name.toLowerCase() === name.toLowerCase()),
    'Another town already has that name',
  );
  const site = { x: Math.round(p.x), z: Math.round(p.z) };
  const half = mapHalf(w);
  requireThat(
    Math.abs(site.x) <= half - charter.initialRadius &&
      Math.abs(site.z) <= half - charter.initialRadius,
    'Too close to the edge of the world',
  );
  requireThat(
    terrainHeight(w, site.x, site.z) > w.settings.seaLevel + 1,
    'Found the town on dry land',
  );
  requireThat(
    w.towns.every(
      (t) =>
        Math.hypot(t.x - site.x, t.z - site.z) >=
        Math.max(charter.minSpacing, t.radius + charter.initialRadius),
    ),
    `Found the town at least ${charter.minSpacing} m from another town`,
  );
  requireThat(
    !w.zones.some((z) => z.kind === 'noBuild' && Math.hypot(z.x - site.x, z.z - site.z) < z.radius),
    'Construction prohibited in this zone',
  );
  requireThat(
    w.buildings.every((b) => Math.hypot(b.x - site.x, b.z - site.z) > 12),
    'Too close to another building',
  );
  requireThat(p.cash >= charter.foundingCost, 'Not enough cash');
  p.cash -= charter.foundingCost;
  log(w, 'sink', charter.foundingCost, p.id, 'treasury', 'town charter');
  const id = uniqueTownId(w, name);
  const plinth = makeBuilding('town-' + id, 'town', site.x, site.z);
  Object.assign(plinth, { name, government: true, owner: 'treasury' });
  w.buildings.push(plinth);
  const governance = charter.governance[0] ?? 'appointed';
  const town: Town = {
    id,
    name,
    ...site,
    radius: charter.initialRadius,
    plinth: plinth.id,
    founder: p.id,
    ...(governance === 'direct' ? {} : { mayor: p.id }),
    treasury: 0,
    tax: 0,
    salesTax: 0,
    wageTax: 0,
    zoning: { north: [...charter.defaultZoning], south: [...charter.defaultZoning] },
    permissions: { residents: openPermissions(), guests: openPermissions() },
    governance,
    residents: [],
    residentSince: {},
    wars: [],
    pendingTaxes: [],
    proposals: [],
    proposalSeq: 0,
  };
  w.towns.push(town);
  joinTown(w, p, town);
  w.revision++;
  say(w, 'Parish notice', `${p.name} has founded the town of ${name}.`);
  return `You founded ${name}. Its plinth stands where you are.`;
}

export const ruleLabels: Record<TownRule, string> = {
  constructionTax: 'construction tax',
  salesTax: 'sales tax',
  wageTax: 'wage tax',
  zoning: 'zoning',
  permissions: 'permissions',
  governance: 'form of government',
  name: 'town name',
  treasury: 'treasury payments',
  sale: 'town sale',
};
const taxField = { constructionTax: 'tax', salesTax: 'salesTax', wageTax: 'wageTax' } as const;

function number(value: unknown, min: number, max: number, integer = false) {
  requireThat(
    typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= min &&
      value <= max &&
      (!integer || Number.isSafeInteger(value)),
    'Invalid number',
  );
  return value;
}
const denarii = (value: unknown, min = 0) => number(value ?? 0, min, 1e12, true);

function escrow(w: World, town: Town, p: Player, amount: number, reason: string) {
  requireThat(p.cash >= amount, 'Not enough cash');
  p.cash -= amount;
  log(w, 'transfer', amount, p.id, 'escrow:' + town.id, reason);
}
function release(w: World, town: Town, id: string, amount: number, reason: string) {
  const p = w.players[id];
  if (!p || amount <= 0) return;
  p.cash += amount;
  log(w, 'transfer', amount, 'escrow:' + town.id, id, reason);
}
function cancelElection(w: World, town: Town) {
  for (const c of town.election?.candidates ?? [])
    release(w, town, c.id, c.budget + c.bid, 'election cancelled');
  delete town.election;
}
function withdrawCandidate(w: World, town: Town, id: string) {
  const e = town.election,
    c = e?.candidates.find((c) => c.id === id);
  if (!e || !c) return;
  release(w, town, id, c.budget + c.bid, 'candidacy withdrawn');
  e.candidates = e.candidates.filter((x) => x !== c);
  for (const [voter, choice] of Object.entries(e.votes)) if (choice === id) delete e.votes[voter];
}

function eligibleVoter(w: World, town: Town, p: Player) {
  requireThat(town.residents.includes(p.id), `Only residents of ${town.name} may vote`);
  const days = townCharter(w).voterResidencyDays;
  requireThat(
    w.time - (town.residentSince[p.id] ?? 0) >= days * DAY,
    `Voters must have lived in ${town.name} for ${days} days`,
  );
}
function voters(w: World, town: Town) {
  const days = townCharter(w).voterResidencyDays;
  return town.residents.filter((id) => w.time - (town.residentSince[id] ?? 0) >= days * DAY);
}

/** Validates and normalises a proposed rule value. World owners bypass charter limits. */
function ruleValue(w: World, town: Town, rule: TownRule, value: unknown, owner: boolean) {
  const charter = townCharter(w);
  switch (rule) {
    case 'constructionTax':
    case 'salesTax':
    case 'wageTax':
      return number(value, 0, owner ? 1 : charter.maxTax);
    case 'zoning': {
      requireThat(value && typeof value === 'object', 'Invalid zoning');
      const side = (list: unknown) => {
        requireThat(
          Array.isArray(list) && list.every((c) => categories.includes(c)),
          'Unknown building category',
        );
        return [...new Set(list as Category[])];
      };
      const v = value as Record<string, unknown>;
      return { north: side(v.north), south: side(v.south) };
    }
    case 'permissions': {
      requireThat(value && typeof value === 'object', 'Invalid permissions');
      const group = (g: unknown): Permissions => {
        const v = g as Record<string, unknown>;
        requireThat(
          v && ['build', 'roads', 'environment'].every((k) => typeof v[k] === 'boolean'),
          'Invalid permissions',
        );
        return { build: !!v.build, roads: !!v.roads, environment: !!v.environment };
      };
      const v = value as Record<string, unknown>;
      return { residents: group(v.residents), guests: group(v.guests) };
    }
    case 'governance':
      requireThat(
        governanceModes.includes(value as Governance) &&
          (owner || charter.governance.includes(value as Governance)),
        'That form of government is not permitted on this world',
      );
      return value as Governance;
    case 'name': {
      const name = text(value);
      requireThat(
        !w.towns.some((t) => t !== town && t.name.toLowerCase() === name.toLowerCase()),
        'Another town already has that name',
      );
      return name;
    }
    case 'treasury': {
      const v = value as Record<string, unknown>;
      requireThat(v && typeof v.to === 'string' && w.players[v.to], 'Choose a player to pay');
      return { to: v.to, amount: number(v.amount, 1, town.treasury, true) };
    }
    case 'sale':
      requireThat(town.governance === 'proprietor', 'Only a proprietor can sell the town');
      return denarii(value);
  }
}

function setGovernance(w: World, town: Town, mode: Governance) {
  if (town.governance === mode) return;
  cancelElection(w, town);
  town.governance = mode;
  delete town.termEnds;
  if (mode !== 'proprietor') delete town.forSale;
  if (mode !== 'direct') town.proposals = [];
  if (mode === 'direct') delete town.mayor;
  if (mode === 'proprietor') town.mayor ??= town.founder;
}

function applyRule(w: World, town: Town, rule: TownRule, value: unknown, notice: boolean) {
  const days = townCharter(w).taxNoticeDays;
  switch (rule) {
    case 'constructionTax':
    case 'salesTax':
    case 'wageTax':
      town.pendingTaxes = town.pendingTaxes.filter((t) => t.rule !== rule);
      if (notice && days > 0) {
        town.pendingTaxes.push({ rule, value: value as number, at: w.time + days * DAY });
        say(
          w,
          'Parish notice',
          `${town.name} ${ruleLabels[rule]} will change to ${Math.round((value as number) * 100)}% in ${days} days.`,
        );
      } else town[taxField[rule]] = value as number;
      break;
    case 'zoning':
      town.zoning = value as Town['zoning'];
      break;
    case 'permissions':
      town.permissions = value as Town['permissions'];
      break;
    case 'governance':
      setGovernance(w, town, value as Governance);
      break;
    case 'name': {
      town.name = value as string;
      const plinth = w.buildings.find((b) => b.id === town.plinth);
      if (plinth) plinth.name = town.name;
      break;
    }
    case 'treasury': {
      const { to, amount } = value as { to: string; amount: number };
      requireThat(amount <= town.treasury, 'The treasury cannot cover that payment');
      town.treasury -= amount;
      w.players[to].cash += amount;
      log(w, 'transfer', amount, 'town:' + town.id, to, 'town payment');
      break;
    }
    case 'sale':
      if (value) town.forSale = value as number;
      else delete town.forSale;
      break;
  }
  w.revision++;
}

function stand(w: World, p: Player, town: Town, a: Action) {
  const charter = townCharter(w);
  requireThat(
    town.governance === 'election' || town.governance === 'auction',
    `${town.name} does not hold elections`,
  );
  const e = town.election;
  requireThat(e?.phase === 'registration', 'Candidate registration is not open');
  requireThat(town.residents.includes(p.id), `Only residents of ${town.name} may stand`);
  requireThat(
    !charter.candidateSkill || p.skills.includes(charter.candidateSkill),
    `Learn ${charter.candidateSkill} before standing for mayor`,
  );
  const existing = e.candidates.find((c) => c.id === p.id);
  if (e.kind === 'auction') {
    const bid = denarii(a.bid, 1);
    requireThat(!existing || bid > existing.bid, 'You can only raise your bid');
    escrow(w, town, p, bid - (existing?.bid ?? 0), 'mayoral bid');
    if (existing) existing.bid = bid;
    else
      e.candidates.push({ id: p.id, name: p.name, bribe: 0, budget: 0, bid, registered: w.time });
    return `Your bid for mayor of ${town.name} stands at ${bid / 100}d.`;
  }
  requireThat(!existing, 'You are already a candidate');
  const bribe = denarii(a.bribe),
    budget = denarii(a.budget);
  requireThat(charter.bribes || (!bribe && !budget), 'Campaign payments are banned on this world');
  requireThat(p.cash >= charter.candidateDeposit + budget, 'Not enough cash');
  p.cash -= charter.candidateDeposit;
  payTown(w, town, p.id, charter.candidateDeposit, 'election deposit');
  escrow(w, town, p, budget, 'campaign budget');
  e.candidates.push({ id: p.id, name: p.name, bribe, budget, bid: 0, registered: w.time });
  return `You are standing for mayor of ${town.name}.`;
}

export function townAction(w: World, p: Player, a: Action): string {
  if (a.type === 'foundTown') return foundTown(w, p, a);
  const b = w.buildings.find((x) => x.id === a.building);
  requireThat(b && b.kind === 'town', 'Visit the town plinth');
  requireThat(Math.hypot(p.x - b.x, p.z - b.z) < 18, 'Drive near the building first');
  const town = townOfPlinth(w, b);
  requireThat(town, 'This plinth belongs to no town');
  const charter = townCharter(w),
    owner = p.authority >= 20;
  switch (a.operation) {
    case 'join':
      joinTown(w, p, town);
      return `You are now a resident of ${town.name}.`;
    case 'leave':
      requireThat(town.residents.includes(p.id), 'You are not a resident here');
      leaveTown(w, p);
      return `You are no longer a resident of ${town.name}.`;
    case 'tax':
    case 'rule': {
      const rule = (a.operation === 'tax' ? 'constructionTax' : a.rule) as TownRule;
      const value = a.operation === 'tax' ? a.tax : a.value;
      requireThat(townRules.includes(rule), 'Unknown town rule');
      if (!owner) {
        requireThat(
          town.governance !== 'direct',
          `${town.name} is a direct democracy; rule changes go to a proposal`,
        );
        requireThat(town.mayor === p.id, `Only the mayor of ${town.name} can change its rules`);
        requireThat(
          charter.controls.includes(rule),
          `This world does not let towns change their ${ruleLabels[rule]}`,
        );
      }
      applyRule(w, town, rule, ruleValue(w, town, rule, value, owner), !owner);
      return `${town.name} ${ruleLabels[rule]} updated.`;
    }
    case 'stand':
      return stand(w, p, town, a);
    case 'withdraw':
      requireThat(
        town.election?.phase === 'registration' &&
          town.election.candidates.some((c) => c.id === p.id),
        'You are not a registered candidate',
      );
      withdrawCandidate(w, town, p.id);
      return 'Candidacy withdrawn. Your deposit stays with the town.';
    case 'vote': {
      const e = town.election;
      requireThat(e?.kind === 'election' && e.phase === 'voting', 'There is no voting under way');
      eligibleVoter(w, town, p);
      requireThat(
        e.candidates.some((c) => c.id === a.candidate),
        'Choose a registered candidate',
      );
      e.votes[p.id] = a.candidate as string;
      return 'Vote recorded. You may change it until voting closes.';
    }
    case 'propose': {
      requireThat(town.governance === 'direct', `${town.name} is not a direct democracy`);
      requireThat(town.residents.includes(p.id), `Only residents of ${town.name} may propose`);
      const rule = a.rule as TownRule;
      requireThat(townRules.includes(rule), 'Unknown town rule');
      requireThat(
        charter.controls.includes(rule),
        `This world does not let towns change their ${ruleLabels[rule]}`,
      );
      requireThat(town.proposals.length < 20, 'Too many open proposals');
      town.proposals.push({
        id: ++town.proposalSeq,
        rule,
        value: ruleValue(w, town, rule, a.value, false),
        by: p.id,
        closes: w.time + charter.proposalDays * DAY,
        votes: {},
      });
      say(w, 'Parish notice', `${p.name} proposes a change to ${town.name} ${ruleLabels[rule]}.`);
      return 'Proposal submitted to the residents.';
    }
    case 'ballot': {
      const proposal = town.proposals.find((x) => x.id === a.proposal);
      requireThat(proposal, 'Choose an open proposal');
      eligibleVoter(w, town, p);
      proposal.votes[p.id] = a.support === true;
      return 'Ballot recorded.';
    }
    case 'buyTown': {
      requireThat(town.governance === 'proprietor' && town.forSale, `${town.name} is not for sale`);
      requireThat(town.mayor !== p.id, 'You already own this town');
      const price = town.forSale,
        seller = town.mayor ? w.players[town.mayor] : undefined;
      requireThat(p.cash >= price, 'Not enough cash');
      p.cash -= price;
      if (seller) {
        seller.cash += price;
        log(w, 'transfer', price, p.id, seller.id, 'town purchase');
      } else payTown(w, town, p.id, price, 'town purchase');
      town.mayor = p.id;
      delete town.forSale;
      joinTown(w, p, town);
      say(w, 'Parish notice', `${p.name} has bought the town of ${town.name}.`);
      return `You now own ${town.name}.`;
    }
    case 'appoint': {
      requireThat(owner, 'Owner authority required');
      requireThat(town.governance !== 'direct', `${town.name} has no mayor`);
      const mayor = w.players[a.player as string];
      requireThat(mayor, 'Unknown player');
      town.mayor = mayor.id;
      if (town.governance === 'election' || town.governance === 'auction')
        town.termEnds = w.time + charter.termDays * DAY;
      say(w, 'Parish notice', `${mayor.name} is appointed mayor of ${town.name}.`);
      return `${mayor.name} appointed.`;
    }
    case 'resign':
      requireThat(town.mayor === p.id, 'You are not the mayor');
      delete town.mayor;
      delete town.termEnds;
      say(w, 'Parish notice', `${p.name} has resigned as mayor of ${town.name}.`);
      return 'You have resigned.';
  }
  throw Error('Unknown town operation');
}

const fraction = z.number().min(0).max(1);
const days = z.number().min(0).max(3650);
const charterSchema = z
  .object({
    founding: z.boolean(),
    foundingCost: z.number().int().min(0).max(1e12),
    foundingSkill: z.string().max(40),
    maxTowns: z.number().int().min(1).max(64),
    minSpacing: z.number().min(0).max(20000),
    initialRadius: z.number().min(20).max(5000),
    maxRadius: z.number().min(20).max(10000),
    growth: z.boolean(),
    growthPerBuilding: z.number().min(0).max(500),
    outskirts: z.number().min(0).max(1000),
    outside: z.enum(['allow', 'nearest', 'forbid']),
    governance: z.array(z.enum(governanceModes)).min(1),
    controls: z.array(z.enum(townRules)),
    maxTax: fraction,
    taxNoticeDays: days,
    termDays: z.number().min(1).max(3650),
    registrationDays: z.number().min(0.1).max(3650),
    votingDays: z.number().min(0.1).max(3650),
    minCandidates: z.number().int().min(1).max(20),
    candidateDeposit: z.number().int().min(0).max(1e12),
    bribes: z.boolean(),
    candidateSkill: z.string().max(40),
    voterResidencyDays: days,
    quorum: fraction,
    proposalDays: z.number().min(0.1).max(3650),
    defaultZoning: z.array(z.enum(categories)),
  })
  .partial()
  .strict();

/** World owners rewrite the charter; omitted fields keep their current values. */
export function charterAction(w: World, p: Player, a: Action) {
  requireThat(p.authority >= 20, 'Owner authority required');
  const parsed = charterSchema.safeParse(a.patch);
  requireThat(parsed.success, 'Invalid town charter');
  const next = { ...w.townCharter, ...parsed.data };
  const merged = { ...charterDefaults, ...next };
  requireThat(merged.initialRadius <= merged.maxRadius, 'Initial radius exceeds the maximum');
  next.governance &&= [...new Set(next.governance)];
  next.controls &&= [...new Set(next.controls)];
  w.townCharter = next;
  w.revision++;
  return 'Town charter saved.';
}

type Tallied<T> = T & { tally: Record<string, number> };
export type PublicTown = Omit<Town, 'election' | 'proposals'> & {
  election?: Tallied<Election>;
  proposals: Tallied<Proposal>[];
};
/** Ballots are secret: publish counts, never who chose what. */
export function publicTowns(w: World): PublicTown[] {
  return w.towns.map((t) => {
    const { election, proposals, ...rest } = t;
    const tally: Record<string, number> = {};
    for (const choice of Object.values(election?.votes ?? {}))
      tally[choice] = (tally[choice] ?? 0) + 1;
    return {
      ...rest,
      ...(election ? { election: { ...election, votes: {}, tally } } : {}),
      proposals: proposals.map((x) => {
        const yes = Object.values(x.votes).filter(Boolean).length;
        return { ...x, votes: {}, tally: { yes, no: Object.keys(x.votes).length - yes } };
      }),
    };
  });
}
export function townBallots(w: World, p: Player) {
  const ballots: Record<string, { candidate?: string; proposals: Record<number, boolean> }> = {};
  for (const t of w.towns) {
    const candidate = t.election?.votes[p.id];
    const proposals = Object.fromEntries(
      t.proposals.filter((x) => p.id in x.votes).map((x) => [x.id, x.votes[p.id]]),
    );
    if (candidate || Object.keys(proposals).length)
      ballots[t.id] = { ...(candidate ? { candidate } : {}), proposals };
  }
  return ballots;
}

function openElection(w: World, town: Town) {
  const charter = townCharter(w);
  town.election = {
    kind: town.governance === 'auction' ? 'auction' : 'election',
    phase: 'registration',
    opened: w.time,
    until: w.time + charter.registrationDays * DAY,
    candidates: [],
    votes: {},
    deferrals: 0,
  };
  say(
    w,
    'Parish notice',
    town.governance === 'auction'
      ? `Bidding is open for the mayoralty of ${town.name}. Bid at the town plinth.`
      : `Mayoral registration is open in ${town.name}. Stand at the town plinth.`,
  );
}

function defer(w: World, town: Town, e: Election) {
  e.deferrals++;
  e.until = w.time + townCharter(w).registrationDays * DAY;
  say(
    w,
    'Parish notice',
    `The ${town.name} mayoral ${e.kind} is deferred: not enough candidates came forward.`,
  );
}

function seat(w: World, town: Town, id: string) {
  town.mayor = id;
  town.termEnds = w.time + townCharter(w).termDays * DAY;
  delete town.election;
}

function closePhase(w: World, town: Town, e: Election) {
  const charter = townCharter(w);
  e.candidates = e.candidates.filter((c) => {
    if (town.residents.includes(c.id)) return true;
    release(w, town, c.id, c.budget + c.bid, 'candidacy lapsed');
    return false;
  });
  if (e.kind === 'auction') {
    if (!e.candidates.length) return defer(w, town, e);
    const [winner, ...losers] = [...e.candidates].sort(
      (a, b) => b.bid - a.bid || a.registered - b.registered,
    );
    town.treasury += winner.bid;
    log(w, 'transfer', winner.bid, 'escrow:' + town.id, 'town:' + town.id, 'mayoral auction');
    for (const c of losers) release(w, town, c.id, c.bid, 'mayoral bid refund');
    seat(w, town, winner.id);
    say(w, 'Parish notice', `${winner.name} wins the ${town.name} mayoral auction.`);
    return;
  }
  if (e.phase === 'registration') {
    if (e.candidates.length < Math.max(1, charter.minCandidates)) return defer(w, town, e);
    e.phase = 'voting';
    e.until = w.time + charter.votingDays * DAY;
    say(
      w,
      'Parish notice',
      `Voting is under way for mayor of ${town.name}: ${e.candidates.map((c) => c.name).join(', ')}.`,
    );
    return;
  }
  const eligible = new Set(voters(w, town));
  const tally = new Map(e.candidates.map((c) => [c.id, [] as string[]]));
  for (const [voter, choice] of Object.entries(e.votes))
    if (eligible.has(voter)) tally.get(choice)?.push(voter);
  for (const c of e.candidates) {
    for (const voter of tally.get(c.id) ?? [])
      if (c.bribe && c.budget >= c.bribe) {
        c.budget -= c.bribe;
        release(w, town, voter, c.bribe, 'campaign payment');
      }
    release(w, town, c.id, c.budget, 'campaign budget refund');
  }
  const [winner] = [...e.candidates].sort(
    (a, b) => tally.get(b.id)!.length - tally.get(a.id)!.length || a.registered - b.registered,
  );
  const cast = [...tally.values()].reduce((n, v) => n + v.length, 0);
  seat(w, town, winner.id);
  say(
    w,
    'Parish notice',
    `${winner.name} is elected mayor of ${town.name} with ${tally.get(winner.id)!.length} of ${cast} votes.`,
  );
}

function resolveProposal(w: World, town: Town, proposal: Proposal) {
  const eligible = new Set(voters(w, town));
  const ballots = Object.entries(proposal.votes).filter(([id]) => eligible.has(id));
  const yes = ballots.filter(([, v]) => v).length,
    no = ballots.length - yes;
  const needed = Math.max(1, Math.ceil(townCharter(w).quorum * eligible.size));
  let passed = yes > no && ballots.length >= needed;
  if (passed)
    try {
      applyRule(w, town, proposal.rule, proposal.value, true);
    } catch {
      passed = false;
    }
  say(
    w,
    'Parish notice',
    `${town.name} proposal ${proposal.id} on ${ruleLabels[proposal.rule]} ${passed ? 'passed' : 'failed'} (${yes} for, ${no} against).`,
  );
}

/** Applies scheduled taxes, runs elections and closes direct-democracy proposals. */
export function tickTowns(w: World) {
  for (const town of w.towns) {
    for (const t of town.pendingTaxes.filter((t) => t.at <= w.time))
      town[taxField[t.rule]] = t.value;
    town.pendingTaxes = town.pendingTaxes.filter((t) => t.at > w.time);
    if (town.governance === 'election' || town.governance === 'auction') {
      if (town.mayor && town.termEnds === undefined)
        town.termEnds = w.time + townCharter(w).termDays * DAY;
      if (!town.election && town.residents.length && (!town.mayor || w.time >= town.termEnds!))
        openElection(w, town);
      for (let n = 0; town.election && w.time >= town.election.until && n < 4; n++)
        closePhase(w, town, town.election);
    }
    if (town.governance === 'direct')
      for (const proposal of town.proposals.filter((x) => x.closes <= w.time)) {
        town.proposals = town.proposals.filter((x) => x !== proposal);
        resolveProposal(w, town, proposal);
      }
  }
}
