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
  needsGraceUntil?: number;
  mail?: import('./social.ts').Mail[];
  sentMail?: import('./social.ts').Mail[];
  mailSentAt?: number;
  familyInvites?: { id: string; name: string }[];
  tradeOffers?: import('./social.ts').TradeOffer[];
  quests?: Record<string, import('./quests.ts').QuestProgress>;
  /** Private world-local Lua progress. */
  scriptState?: Record<string, number>;
  history?: import('./reports.ts').LifeEvent[];
  departure?: import('./reports.ts').Departure;
  awayReport?: import('./reports.ts').AwayReport;
  /** Private snapshot projection for owned businesses. */
  statements?: Record<string, import('./reports.ts').BusinessAccounts>;
  credit?: import('./loans').CreditRecord;
  loans?: import('./loans').Loan[];
  loanSequence?: number;
  /** Server-operated AI identity; no elevated permissions. */
  npc?: boolean;
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
  /** Public snapshot hint; exact fuel and private activity details stay private. */
  canReceiveFuel?: boolean;
  /** Persistent alcohol level and dose time in world seconds; absent in old saves. */
  alcohol?: { level: number; at: number };
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
  fleetState?: Record<number, import('./vehicle-services.ts').VehicleRecord>;
  canReceiveRepair?: boolean;
  tractorPaint?: string;
  engine: boolean;
  /** Public snapshot projection for audible motors. */
  engineRunning?: boolean;
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
  crowClass?: import('./robocrows.ts').CrowClass;
  crowIntegrity?: number;
  crowMark?: { x: number; y: number; z: number };
  crowRecallAt?: number;
  crowBody?: { x: number; z: number; vehicle: number };
  muted: boolean;
  online: boolean;
  lastSeen: number;
  inactivityProcessed?: number;
  lastFood?: string;
  repeats: number;
  nutrition?: number;
  importDay: number;
  imports: number;
}
export interface Building {
  ownerActiveUntil?: number;
  templateId?: string;
  herdCondition?: number;
  breedingEnd?: number;
  productionStatus?: string[];
  accounts?: import('./reports.ts').BusinessAccounts;
  lien?: { borrower: string; loan: string };
  estate?: { since: number; base: number };
  creatorModel?: string;
  creatorBounds?: { width: number; depth: number; height: number };
  id: string;
  kind: string;
  name: string;
  x: number;
  z: number;
  rotation: number;
  owner?: string;
  /** Public snapshot projection, including owners who are currently offline. */
  ownerName?: string;
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
  /** Original base cash paid at placement, excluding town tax. */
  constructionCost?: number;
  style?: string;
  smoking?: boolean;
  /** Public snapshot projection: production intensity, zero when blocked. */
  operating?: number;
  lodging?: {
    open: boolean;
    rate: number;
    guests: Record<string, { until: number; stock: Stock }>;
  };
  plots?: import('./farming.ts').Plot[];
}
export interface Ledger {
  details?: { building?: string; item?: string; quantity?: number };
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
  crowAbilities: boolean;
  lotteryEnabled: boolean;
  lotteryTicketPrice: number;
  jobsEnabled: boolean;
  ownerOperation: boolean;
  postDeathGraceSeconds: number;
  vehicleMaintenance: boolean;
  vehicleLicences: boolean;
  requireMapItem: boolean;
  parishOrders: boolean;
  parishOrderBudget: number;
  resetScriptOnDeath: boolean;
  loseSkillsOnDeath: boolean;
  loseInventoryOnDeath: boolean;
  loseJobOnDeath: boolean;
  losePropertyOnDeath: boolean;
  deathCashRetention: number;
  deathBankRetention: number;
  maxOfflineDays: number;
  retainEstateContents: boolean;
  estateEquityShare: number;
  estateAnnualDiscount: number;
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
  allowMoneyGifts?: boolean;
  allowPlayerRefuelling?: boolean;
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
  /** Public, expiring voluntary supply errands; never reservations of goods. */
  supplyIntents?: {
    player: string;
    name: string;
    building: string;
    item: string;
    expires: number;
  }[];
  familyNames?: Record<string, string>;
  socialSequence?: number;
  families?: Record<string, import('./social.ts').Family>;
  tradeOffers?: import('./social.ts').TradeOffer[];
  landscape?: import('./landscape.ts').Landscape;
  landscapeHistory?: import('./landscape.ts').Landscape[];
  landscapeUndo?: boolean;
  catalogue?: import('./world-catalogue.ts').Catalogue;
  procurementVersion?: 1;
  procurement?: import('./procurement.ts').Procurement;
  /** Public projection; Lua source remains owner-only. */
  scriptInteraction?: boolean;
  creator?: import('./creator.ts').Creator;
  townLayout?: 1 | 2;
  tradePricing?: 1 | 2 | 3 | 4;
  vehicleServicesPricing?: 1;
  livestockPricing?: 1;
  animalPricing?: 1;
  estateRulesVersion?: 1;
  /** Default Puddlewick building types already supplied; never replenish on restart. */
  parishServices?: string[];
  publicParishVersion?: number;
  /** Last half-hour public shortage shipment, persisted across restarts. */
  harbourShipment?: number;
  /** One-time retirement of excess public starter types; purchased property is protected. */
  parishRetired?: string[];
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
  lottery?: import('./lottery.ts').Lottery;
  townEventRuns?: Record<string, string>;
  messageSeq?: number;
  messages: {
    id?: number;
    name: string;
    text: string;
    kind: string;
    time: number;
    to?: string;
    npc?: boolean;
  }[];
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
  assets: {
    id: string;
    name: string;
    type: string;
    url: string;
    provenance?: { author: string; license: string; source: string };
  }[];
  kricket: { bowler?: string; batter?: string; due: number; score: Record<string, number> };
  revision: number;
}
export type Action = { type: string; [key: string]: unknown };
export interface ItemDef {
  icon?: string;
  name: string;
  weight: number;
  price: number;
  health?: number;
  maxHealth?: number;
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
