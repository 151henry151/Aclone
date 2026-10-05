// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from './types.ts';
import { buildings as catalog } from './catalog.ts';

export const categories = [
  'residential',
  'commercial',
  'industrial',
  'agricultural',
  'advanced',
  'civic',
] as const;
export type Category = (typeof categories)[number];

export const governanceModes = [
  'appointed',
  'proprietor',
  'election',
  'auction',
  'direct',
] as const;
export type Governance = (typeof governanceModes)[number];

/** Town rules a world creator may delegate to each town's government. */
export const townRules = [
  'constructionTax',
  'salesTax',
  'wageTax',
  'zoning',
  'permissions',
  'governance',
  'name',
  'treasury',
  'sale',
] as const;
export type TownRule = (typeof townRules)[number];

export interface Permissions {
  build: boolean;
  roads: boolean;
  environment: boolean;
}
export interface Candidate {
  id: string;
  name: string;
  /** Per-vote payment to supporters, escrowed from `budget`. */
  bribe: number;
  budget: number;
  /** Auction bid, escrowed until the result. */
  bid: number;
  registered: number;
}
export interface Election {
  kind: 'election' | 'auction';
  phase: 'registration' | 'voting';
  opened: number;
  /** End of the current phase in world seconds. */
  until: number;
  candidates: Candidate[];
  votes: Record<string, string>;
  deferrals: number;
}
export interface Proposal {
  id: number;
  rule: TownRule;
  value: unknown;
  by: string;
  closes: number;
  votes: Record<string, boolean>;
}
export interface PendingTax {
  rule: 'constructionTax' | 'salesTax' | 'wageTax';
  value: number;
  at: number;
}
export interface Town {
  id: string;
  name: string;
  x: number;
  z: number;
  radius: number;
  plinth?: string;
  founder?: string;
  mayor?: string;
  /** Town treasury in denarii, funded by town taxes, deposits and auction bids. */
  treasury: number;
  /** Construction tax as a fraction of the base price. */
  tax: number;
  salesTax: number;
  wageTax: number;
  zoning: { north: Category[]; south: Category[] };
  permissions: { residents: Permissions; guests: Permissions };
  governance: Governance;
  residents: string[];
  residentSince: Record<string, number>;
  wars: string[];
  termEnds?: number;
  forSale?: number;
  pendingTaxes: PendingTax[];
  election?: Election;
  proposals: Proposal[];
  proposalSeq: number;
}

export interface TownCharter {
  founding: boolean;
  foundingCost: number;
  /** Skill required to found a town; empty for none. */
  foundingSkill: string;
  maxTowns: number;
  minSpacing: number;
  initialRadius: number;
  maxRadius: number;
  growth: boolean;
  growthPerBuilding: number;
  /** Band either side of a border in which construction counts as the outskirts. */
  outskirts: number;
  /** Construction outside every border: free, under the nearest town's rules, or refused. */
  outside: 'allow' | 'nearest' | 'forbid';
  /** Governance modes towns may use; the first is the default for new towns. */
  governance: Governance[];
  /** Rules town governments may change. The world owner can always change all of them. */
  controls: TownRule[];
  maxTax: number;
  /** Game days between announcing a tax change and it taking effect. */
  taxNoticeDays: number;
  termDays: number;
  registrationDays: number;
  votingDays: number;
  minCandidates: number;
  candidateDeposit: number;
  bribes: boolean;
  /** Skill a candidate must hold; empty for none. */
  candidateSkill: string;
  voterResidencyDays: number;
  /** Fraction of eligible residents who must vote for a proposal to count. */
  quorum: number;
  proposalDays: number;
  defaultZoning: Category[];
}

export const charterDefaults: TownCharter = {
  founding: true,
  foundingCost: 50000,
  foundingSkill: '',
  maxTowns: 8,
  minSpacing: 500,
  initialRadius: 150,
  maxRadius: 600,
  growth: true,
  growthPerBuilding: 10,
  outskirts: 40,
  outside: 'allow',
  governance: ['election', 'appointed', 'proprietor', 'auction', 'direct'],
  controls: [...townRules],
  maxTax: 0.5,
  taxNoticeDays: 0,
  termDays: 365,
  registrationDays: 30,
  votingDays: 60,
  minCandidates: 2,
  candidateDeposit: 4000,
  bribes: true,
  candidateSkill: '',
  voterResidencyDays: 0,
  quorum: 0.25,
  proposalDays: 7,
  defaultZoning: [...categories],
};

export function townCharter(w: World): TownCharter {
  return { ...charterDefaults, ...w.townCharter };
}

const kinds: Record<string, Category> = {};
for (const [category, list] of Object.entries({
  residential: ['home', 'warehouse', 'bnb', 'hotel'],
  commercial: ['market', 'pub', 'bank', 'garage', 'starport', 'kitchen', 'teaHouse', 'notice'],
  agricultural: ['farm', 'sheepfold', 'piggery', 'henhouse', 'dairy', 'feedmill', 'composter'],
  civic: ['school', 'workhouse', 'town', 'turret', 'portal', 'scripted', 'pickup'],
}))
  for (const kind of list) kinds[kind] = category as Category;

export function buildingCategory(w: World, kind: string): Category {
  const base = w.catalogue?.templates[kind]?.base ?? kind;
  return kinds[base] ?? ((catalog[base]?.tier ?? 0) >= 2 ? 'advanced' : 'industrial');
}

export function townAt(w: World, x: number, z: number): Town | undefined {
  let best: Town | undefined,
    closest = Infinity;
  for (const t of w.towns) {
    const d = Math.hypot(t.x - x, t.z - z);
    if (d <= t.radius && d < closest) {
      best = t;
      closest = d;
    }
  }
  return best;
}

export function nearestTown(w: World, x: number, z: number): Town | undefined {
  let best: Town | undefined,
    closest = Infinity;
  for (const t of w.towns) {
    const d = Math.hypot(t.x - x, t.z - z) - t.radius;
    if (d < closest) {
      best = t;
      closest = d;
    }
  }
  return best;
}

const permissionVerbs = {
  build: 'build property',
  roads: 'build roads',
  environment: 'modify the environment',
};
/** Why a town forbids a player an activity at a site inside its border, or undefined. */
export function townRefusal(
  w: World,
  player: string | undefined,
  x: number,
  z: number,
  key: keyof Permissions,
  town = townAt(w, x, z),
) {
  if (!town) return;
  const resident = !!player && town.residents.includes(player);
  if (town.permissions[resident ? 'residents' : 'guests'][key]) return;
  return resident
    ? `${town.name} does not allow residents to ${permissionVerbs[key]}`
    : `Only residents may ${permissionVerbs[key]} in ${town.name}`;
}

/** The town that levies sales and wage taxes on a business at (x, z), if any. */
export function taxTown(w: World, x: number, z: number) {
  return (
    townAt(w, x, z) ?? (townCharter(w).outside === 'nearest' ? nearestTown(w, x, z) : undefined)
  );
}
