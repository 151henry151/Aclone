// SPDX-License-Identifier: GPL-3.0-or-later
import { vehicles } from './catalog.ts';
import { publicTowns } from './civics.ts';
import { alcoholLevel } from './intoxication.ts';
import { maximumHealth } from './nutrition.ts';
import { productionReport } from './reports.ts';
import { skillLesson, worldItems } from './world-catalogue.ts';
import type { Building, Player, Stock, World } from './types.ts';

export interface NamedAmount {
  id: string;
  name: string;
  quantity: number;
}
export interface CaretakerResident {
  id: string;
  name: string;
  npc: boolean;
  online: boolean;
  authority: number;
  cash: number;
  bank: number;
  kudos: number;
  level: number;
  health: number;
  maximumHealth: number;
  hunger: number;
  thirst: number;
  nutrition: number;
  energy: number;
  age: number;
  x: number;
  y: number;
  z: number;
  speed: number;
  vehicle: number;
  vehicleName: string;
  fuel: number;
  engine: boolean;
  lights: boolean;
  atHome: boolean;
  home?: string;
  skills: { id: string; name: string }[];
  learning?: { skill: string; name: string; end: number };
  job?: string;
  jobName?: string;
  activeUntil: number;
  activity: string;
  task?: { kind: string; end: number; building?: string; item?: string };
  inventory: NamedAmount[];
  town?: string;
  family?: string;
  muted: boolean;
  lastSeen: number;
  deaths: number;
  kills: number;
  alcohol: number;
  loans: {
    id: string;
    bank: string;
    principal: number;
    due: number;
    status: string;
    apr: number;
  }[];
  credit?: { onTime: number; late: number; defaults: number };
  history: { time: number; kind: string; text: string; amount?: number }[];
  quests: { id: string; step: number; count: number; claimed: boolean }[];
  letters: number;
  offers: number;
  scriptState: Record<string, number>;
}
export interface CaretakerBuilding {
  id: string;
  kind: string;
  name: string;
  x: number;
  z: number;
  owner?: string;
  ownerName: string;
  government: boolean;
  forSale: boolean;
  price: number;
  investment: number;
  wage: number;
  capacity: number;
  condition: number;
  efficiency: number;
  stock: NamedAmount[];
  buy: NamedAmount[];
  sell: NamedAmount[];
  employees: { id: string; name: string }[];
  recipe?: string;
  production: string[];
  construction?: NamedAmount[];
  accounts?: {
    receipts: number;
    materials: number;
    wages: number;
    tax: number;
    imports: number;
    capitalIn: number;
    capitalOut: number;
    otherIn: number;
    otherOut: number;
    batches: number;
  };
  stakes: { investor: string; name: string; principal: number; claim: number; paid: number }[];
  lodging?: {
    open: boolean;
    rate: number;
    guests: { id: string; name: string; until: number; stock: NamedAmount[] }[];
  };
  plots: { crop?: string; planted: number; ready: number; water: number; fertilized: boolean }[];
  herdCondition?: number;
}
export interface CaretakerView {
  id: string;
  name: string;
  template: string;
  time: number;
  day: number;
  revision: number;
  census: {
    pilots: number;
    npcs: number;
    online: number;
    cash: number;
    bank: number;
    buildings: number;
    forSale: number;
    constructing: number;
  };
  residents: CaretakerResident[];
  buildings: CaretakerBuilding[];
  zones: { id: string; kind: string; x: number; z: number; radius: number }[];
  towns: {
    id: string;
    name: string;
    treasury: number;
    residents: number;
    mayor?: string;
    governance: string;
  }[];
  ledger: {
    time: number;
    kind: string;
    amount: number;
    from: string;
    to: string;
    reason: string;
  }[];
  notices: { time: number; name: string; text: string; kind: string }[];
  privateMessages: number;
  resources: { id: string; amount: number }[];
  settings: World['settings'];
}

const round = (n: number) => Math.round(n * 100) / 100;
const amounts = (w: World, stock: Stock | undefined): NamedAmount[] => {
  const names = worldItems(w);
  return Object.entries(stock ?? {})
    .filter(([, n]) => n > 0)
    .map(([id, quantity]) => ({ id, name: names[id]?.name ?? id, quantity }));
};
const person = (w: World, id?: string) =>
  !id ? 'Unowned' : id === 'treasury' ? 'Parish treasury' : (w.players[id]?.name ?? id);

function activity(w: World, p: Player) {
  if (p.task) {
    const place = w.buildings.find((b) => b.id === p.task?.building)?.name;
    return `Working: ${p.task.kind}${place ? ' at ' + place : ''}`;
  }
  if (p.learning) return `Studying ${skillLesson(w, p, p.learning.skill).name}`;
  if (p.atHome) return 'Sheltering at home';
  if (p.game) return `In ${p.game}`;
  if (p.fishUntil && p.fishUntil > w.time) return 'Fishing';
  if (p.job) return `Employed at ${w.buildings.find((b) => b.id === p.job)?.name ?? p.job}`;
  return p.online ? 'Idle in the parish' : 'Away';
}

function resident(w: World, p: Player): CaretakerResident {
  const home = w.buildings.find((b) => b.id === p.home);
  return {
    id: p.id,
    name: p.name,
    npc: !!p.npc,
    online: p.online,
    authority: p.authority,
    cash: p.cash,
    bank: p.bank,
    kudos: p.kudos,
    level: p.level,
    health: p.health,
    maximumHealth: maximumHealth(p),
    hunger: p.hunger,
    thirst: p.thirst,
    nutrition: p.nutrition ?? 0,
    energy: p.energy,
    age: Math.floor(p.age),
    x: round(p.x),
    y: round(p.y),
    z: round(p.z),
    speed: round(p.speed),
    vehicle: p.vehicle,
    vehicleName: vehicles[p.vehicle]?.name ?? `Vehicle ${p.vehicle}`,
    fuel: p.fuel,
    engine: p.engine,
    lights: p.lights,
    atHome: p.atHome,
    home: home?.name,
    skills: p.skills.map((id) => ({ id, name: skillLesson(w, p, id).name })),
    learning: p.learning
      ? {
          skill: p.learning.skill,
          name: skillLesson(w, p, p.learning.skill).name,
          end: p.learning.end,
        }
      : undefined,
    job: p.job,
    jobName: p.job ? (w.buildings.find((b) => b.id === p.job)?.name ?? p.job) : undefined,
    activeUntil: p.activeUntil,
    activity: activity(w, p),
    task: p.task
      ? { kind: p.task.kind, end: p.task.end, building: p.task.building, item: p.task.item }
      : undefined,
    inventory: amounts(w, p.inventory),
    town: p.town ? (w.towns.find((t) => t.id === p.town)?.name ?? p.town) : undefined,
    family: p.family,
    muted: p.muted,
    lastSeen: p.lastSeen,
    deaths: p.deaths,
    kills: p.kills,
    alcohol: round(alcoholLevel(p, w.time)),
    loans: (p.loans ?? []).map((loan) => ({
      id: loan.id,
      bank: w.buildings.find((b) => b.id === loan.bank)?.name ?? loan.bank,
      principal: loan.principal,
      due: loan.due,
      status: loan.status,
      apr: loan.apr,
    })),
    credit: p.credit
      ? { onTime: p.credit.onTime, late: p.credit.late, defaults: p.credit.defaults }
      : undefined,
    history: (p.history ?? []).slice(-40).map((event) => ({
      time: event.time,
      kind: event.kind,
      text: event.text,
      amount: event.amount,
    })),
    quests: Object.entries(p.quests ?? {}).map(([id, quest]) => ({
      id,
      step: quest.step,
      count: quest.count,
      claimed: quest.claimed,
    })),
    letters: (p.mail?.length ?? 0) + (p.sentMail?.length ?? 0),
    offers: p.tradeOffers?.length ?? 0,
    scriptState: { ...(p.scriptState ?? {}) },
  };
}

function building(w: World, b: Building): CaretakerBuilding {
  const accounts = b.accounts;
  return {
    id: b.id,
    kind: b.kind,
    name: b.name,
    x: round(b.x),
    z: round(b.z),
    owner: b.owner,
    ownerName: person(w, b.owner),
    government: b.government,
    forSale: !!b.forSale || !b.owner,
    price: b.price,
    investment: b.investment,
    wage: b.wage,
    capacity: b.capacity,
    condition: round(b.condition),
    efficiency: b.efficiency,
    stock: amounts(w, b.stock),
    buy: amounts(w, b.buy),
    sell: amounts(w, b.sell),
    employees: b.employees.map((id) => ({ id, name: w.players[id]?.name ?? id })),
    recipe: b.recipe,
    production: productionReport(w, b),
    construction: b.construction ? amounts(w, b.construction) : undefined,
    accounts: accounts
      ? {
          receipts: accounts.receipts,
          materials: accounts.materials,
          wages: accounts.wages,
          tax: accounts.tax,
          imports: accounts.imports,
          capitalIn: accounts.capitalIn,
          capitalOut: accounts.capitalOut,
          otherIn: accounts.otherIn,
          otherOut: accounts.otherOut,
          batches: accounts.batches,
        }
      : undefined,
    stakes: (b.stakes ?? []).map((stake) => ({
      investor: stake.investor,
      name: w.players[stake.investor]?.name ?? stake.investor,
      principal: stake.principal,
      claim: stake.claim,
      paid: stake.paid,
    })),
    lodging: b.lodging
      ? {
          open: b.lodging.open,
          rate: b.lodging.rate,
          guests: Object.entries(b.lodging.guests).map(([id, guest]) => ({
            id,
            name: w.players[id]?.name ?? id,
            until: guest.until,
            stock: amounts(w, guest.stock),
          })),
        }
      : undefined,
    plots: (b.plots ?? []).map((plot) => ({
      crop: plot.crop,
      planted: plot.planted,
      ready: plot.ready,
      water: plot.water,
      fertilized: plot.fertilized,
    })),
    herdCondition: b.herdCondition,
  };
}

/** Owner-only projection. Letters, ballots and offer terms stay off this record. */
export function caretakerView(w: World): CaretakerView {
  const people = Object.values(w.players);
  const label = (id: string) => person(w, id);
  return {
    id: w.id,
    name: w.name,
    template: w.template,
    time: w.time,
    day: Math.floor(w.time / 600) + 1,
    revision: w.revision,
    census: {
      pilots: people.filter((p) => !p.npc).length,
      npcs: people.filter((p) => p.npc).length,
      online: people.filter((p) => p.online).length,
      cash: people.reduce((n, p) => n + p.cash, 0),
      bank: people.reduce((n, p) => n + p.bank, 0),
      buildings: w.buildings.length,
      forSale: w.buildings.filter((b) => b.forSale || !b.owner).length,
      constructing: w.buildings.filter((b) => b.construction).length,
    },
    residents: people
      .map((p) => resident(w, p))
      .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name)),
    buildings: w.buildings.map((b) => building(w, b)).sort((a, b) => a.name.localeCompare(b.name)),
    zones: w.zones.map((z) => ({ id: z.id, kind: z.kind, x: z.x, z: z.z, radius: z.radius })),
    towns: publicTowns(w).map((town) => ({
      id: town.id,
      name: town.name,
      treasury: town.treasury,
      residents: town.residents.length,
      mayor: town.mayor ? label(town.mayor) : undefined,
      governance: town.governance,
    })),
    ledger: w.ledger.slice(-40).map((entry) => ({
      time: entry.time,
      kind: entry.kind,
      amount: entry.amount,
      from: label(entry.from),
      to: label(entry.to),
      reason: entry.reason,
    })),
    notices: w.messages
      .filter((message) => !message.to)
      .slice(-30)
      .map((message) => ({
        time: message.time,
        name: message.name,
        text: message.text,
        kind: message.kind,
      })),
    privateMessages: w.messages.filter((message) => message.to).length,
    resources: Object.entries(w.resources ?? {}).map(([id, resource]) => ({
      id,
      amount: resource.amount,
    })),
    settings: { ...w.settings },
  };
}
