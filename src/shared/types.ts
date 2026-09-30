// SPDX-License-Identifier: GPL-3.0-or-later
export type Stock = Record<string, number>;
export type Input = { throttle: number; steer: number; boost: boolean; lift?: number };
export type Task = {
  kind: string;
  end: number;
  building?: string;
  plot?: number;
  resource?: string;
  item?: string;
  amount?: number;
};
export interface Player {
  id: string;
  name: string;
  authority: number;
  cash: number;
  bank: number;
  kudos: number;
  level: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  speed: number;
  fuel: number;
  health: number;
  hunger: number;
  thirst: number;
  age: number;
  inventory: Stock;
  skills: string[];
  learning?: { skill: string; end: number };
  job?: string;
  activeUntil: number;
  home?: string;
  atHome: boolean;
  /** Recipient-only snapshot projection; room stock is stored on the building. */
  roomPantries?: Record<string, Stock>;
  vehicle: number;
  fleet?: number[];
  tractorPaint?: string;
  engine: boolean;
  lights: boolean;
  task?: Task;
  team: number;
  game?: string;
  race?: { start: number; next: number };
  fishAt?: number;
  fishUntil?: number;
  lastShot: number;
  weaponCharge?: { weapon: string; start: number };
  ammo?: Stock;
  invulnerableUntil?: number;
  lastRewardedDeath?: number;
  combatVehicle?: number;
  lastHorn: number;
  energy: number;
  kills: number;
  deaths: number;
  town?: string;
  tribe?: string;
  family?: string;
  hitch?: string;
  crowBody?: { x: number; z: number; vehicle: number };
  muted: boolean;
  online: boolean;
  lastSeen: number;
  lastFood?: string;
  repeats: number;
  importDay: number;
  imports: number;
}
export interface Building {
  id: string;
  kind: string;
  name: string;
  x: number;
  z: number;
  rotation: number;
  owner?: string;
  price: number;
  investment: number;
  stock: Stock;
  buy: Stock;
  sell: Stock;
  capacity: number;
  employees: string[];
  wage: number;
  progress: number;
  efficiency: number;
  condition: number;
  government: boolean;
  recipe?: string;
  production?: Recipe;
  forSale?: boolean;
  construction?: Stock;
  style?: string;
  smoking?: boolean;
  lodging?: {
    open: boolean;
    rate: number;
    guests: Record<string, { until: number; stock: Stock }>;
  };
  plots?: import('./farming.ts').Plot[];
}
export interface Ledger {
  id: number;
  time: number;
  kind: 'faucet' | 'transfer' | 'sink';
  amount: number;
  from: string;
  to: string;
  reason: string;
}
export interface Zone {
  id: string;
  kind: 'safe' | 'noBuild' | 'spawn' | 'game' | 'script' | 'vehicle';
  x: number;
  z: number;
  radius: number;
}
export interface Settings {
  dayLength: number;
  time: number;
  denariiPerSheckle: number;
  salesTax: number;
  wageTax: number;
  startingCash: number;
  fighting: boolean;
  weaponMode?: string;
  killReward?: number;
  locked: boolean;
  chatLocked: boolean;
  seaLevel: number;
  hungerRate: number;
  thirstRate: number;
  maxAge: number;
  productionSeconds: number;
  offlineEfficiency: number;
  activeWork: boolean;
  maxBuildings: number;
  maxHomes: number;
  maxSkills: number;
  importCap: number;
  fishingMode: number;
  exchangeRate: number;
  exchangeCap: number;
}
export interface World {
  townLayout?: 1 | 2;
  tradePricing?: 1;
  schemaVersion: 1;
  id: string;
  name: string;
  owner: string;
  template: string;
  time: number;
  created: number;
  settings: Settings;
  vehicleTuning?: Record<number, Partial<VehicleDef>>;
  players: Record<string, Player>;
  buildings: Building[];
  zones: Zone[];
  terrain: { x: number; z: number; radius: number; height: number }[];
  messages: { name: string; text: string; kind: string; time: number; to?: string }[];
  ledger: Ledger[];
  ledgerSeq: number;
  ball: { x: number; z: number; vx: number; vz: number };
  scores: number[];
  round: number;
  climate?: { snow: number; wetness: number };
  resources?: Record<string, { amount: number; updated: number }>;
  combat?: import('./combat.ts').Combat;
  projectiles: {
    id: number;
    owner: string;
    weapon: string;
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    ttl: number;
    age?: number;
    power?: number;
    game?: string;
    team?: number;
  }[];
  raceBest: Record<string, number>;
  towns: { name: string; tax: number; mayor?: string; residents: string[]; wars: string[] }[];
  tier: number;
  script: string;
  scriptVariables: Record<string, number>;
  assets: { id: string; name: string; type: string; url: string }[];
  kricket: { bowler?: string; batter?: string; due: number; score: Record<string, number> };
  revision: number;
}
export type Action = { type: string; [key: string]: unknown };
export interface ItemDef {
  name: string;
  weight: number;
  price: number;
  food?: number;
  drink?: number;
  fuel?: number;
}
export interface VehicleDef {
  name: string;
  mode: number;
  speed: number;
  acceleration: number;
  turn: number;
  fuel: number;
  capacity: number;
  armour: number;
  price: number;
  color: string;
  hitch: number;
}
export interface Recipe {
  inputs: Stock;
  outputs: Stock;
  skill: string;
  seconds: number;
  tier: number;
}
export interface BuildingDef {
  name: string;
  price: number;
  capacity: number;
  buy: Stock;
  sell: Stock;
  stock: Stock;
  recipe?: string | null;
  wage: number;
  materials: Stock;
  tier: number;
  color: string;
}
export interface WeaponDef {
  name: string;
  damage: number;
  buildDamage: number;
  speed: number;
  gravity: number;
  delay: number;
  energy: number;
  radius: number;
  ttl: number;
}
