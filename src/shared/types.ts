import type { BuildingDoorRules } from './building-doors';
import type { LivestockRules } from './livestock-rules';
import type { MeatRules } from './meat-rules';
import type { WaterSourceRules } from './water-source-rules';
import type { StormRules } from './storm-rules';
import type { ObstacleRules } from './obstacle-rules';
import type { LandscapeRules } from './landscape-rules';
import type { CommunicationRules } from './communication-rules';
import type { CalendarRules } from './calendar-rules';
import type { AlpineRules } from './alpine-rules';
import type { ClimateRules } from './climate-rules';
import type { BoatNavigationRules } from './boat-navigation-rules';
import type { VehicleRunningRules } from './vehicle-running-rules';
import type { FishingRules } from './fishing-rules';
import type { FarmYieldRules } from './farm-yield-rules';
import type { GatheringRules, GatheringImplementRules } from './gathering-rules';
import type { ConstructionRules } from './construction-rules';
import type { NpcAccountRules } from './npc-account-rules';
import type { NpcJourneyRules } from './npc-journey-rules';
import type { NpcBusinessLoadRules } from './npc-business-load-rules';
import type { NpcCargoRules } from './npc-cargo-rules';
import type { NpcPricingRules } from './npc-pricing-rules';
import type { NpcBusinessRules } from './npc-business-rules';
import type { NpcReserveRules } from './npc-reserve-rules';
import type { NpcHouseholdRules } from './npc-household-rules';
import type { TowingRules } from './towing-rules';
import type { CharterRules } from './charter-rules';
import type { CreditRules } from './credit-rules';
import type { LoanRules } from './loan-rules';
import type { EconomyRules } from './economy-rules';
import type { SurvivalRules } from './survival-rules';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { RadioRules } from './radio-rules';
import type { RowboatRules } from './rowboat-rules';
import type { CanoeRules } from './canoe-rules';
import type { FuelRules } from './fuel-rules';
import type { FlightRules } from './flight-rules';
import type { WalkingRules } from './walking-rules';
import type { GatheringSceneryRules } from './gathering-scenery';
export type Stock = Record<string, number>;
export type Input = {
  throttle: number;
  steer: number;
  boost: boolean;
  lift?: number;
  pitch?: number;
  roll?: number;
  brake?: boolean;
};
export type Task = {
  kind: string;
  end: number;
  freight?: { action: Action; landing: string };
  slaughter?: { action: Action; fee: number; outputs: Stock };
  cooking?: { home: string; menu: string; inputs: Stock; yield: number };
  building?: string;
  plot?: number;
  /** Ripe plots reserved by one Harvest all task, in field order. */
  plots?: number[];
  resource?: string;
  item?: string;
  amount?: number;
  reward?: number;
  /** The quoted reward is means-tested meal relief, not ordinary shift pay. */
  relief?: boolean;
  repeat?: boolean;
};
export interface Player {
  lastSpringDrink?: number;
  stormExposure?: { slot: number; warningAt: number; since?: number; safeUntil?: number };
  radios?: Record<number, import('./radio').RadioConfig>;
  /** Owned portable hull lifted overhead; its weight is additional to inventory. */
  carrying?: string;
  /** Hull id of the occupied canoe, preserved across snapshots and saves. */
  smallCraft?: string;
  statistics?: import('./player-statistics.ts').PlayerStatistics;
  /** Private snapshot cargo for this player's trailers. */
  trailerCargo?: Record<string, Stock>;
  courseRun?: import('./courses').CourseRun;
  reliefAt?: number;
  /** Consecutive ordinary Odd Jobs shifts; a break or other work clears it. */
  labourStreak?: number;
  labourStreakAt?: number;
  /** Game-day index and ordinary labour already paid that day, in hundredths. */
  labourDay?: number;
  labourEarned?: number;
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
  /** Last blocked scenery sweep; clear when position, direction, vehicle or layout permits travel. */
  sceneryStop?: { id: string; x: number; z: number; vehicle: number; reach: number };
  flight?: import('./flight').FlightState;
  lastFlightCrash?: { at: number; cause: string; slot: number; x?: number; y?: number; z?: number };
  fuel: number;
  /** Public snapshot hint; exact fuel and private activity details stay private. */
  canBeTowed?: boolean;
  canReceiveFuel?: boolean;
  /** Persistent alcohol level and dose time in world seconds; absent in old saves. */
  alcohol?: { level: number; at: number };
  health: number;
  hunger: number;
  thirst: number;
  age: number;
  /** Separate freight hold of the currently occupied vessel. */
  boatHold?: Stock;
  boatHoldLife?: import('./stock-life').StockLife;
  boatHoldBasis?: Stock;
  /** Recipient-only exact stocks of this owner's moored freight boats. */
  boatHolds?: Record<number, Stock>;
  /** Public approximate cargo fraction for vessel rendering. */
  freightLoad?: number;
  inventory: Stock;
  inventoryLife?: import('./stock-life').StockLife;
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
  /** Replacement biplanes awaiting commissioning at a hangar. */
  spareBiplanes?: number;
  lastTractor?: number;
  fuelVehicle?: number;
  parkedFuel?: Record<number, number>;
  fleetState?: Record<number, import('./vehicle-services.ts').VehicleRecord>;
  canReceiveRepair?: boolean;
  /** Legacy shared finish; also the resolved visible paint in public player snapshots. */
  tractorPaint?: string;
  /** Private owned-machine finishes, keyed by vehicle slot. */
  vehiclePaints?: Record<number, string>;
  engine: boolean;
  /** Public snapshot projection for audible motors. */
  engineRunning?: boolean;
  rowing?: boolean;
  lights: boolean;
  task?: Task;
  team: number;
  game?: string;
  race?: { start: number; next: number };
  fishCatch?: string;
  boatThrottle?: number;
  /** After grounding, release the held throttle input (or reverse it) before restarting. */
  boatShoreThrottle?: number;
  boatLighting?: import('./boat-lighting').BoatLighting;
  boatStores?: Stock;
  boatStoresLife?: import('./stock-life').StockLife;
  charter?: import('./charter').CharterTrip;
  charterPassage?: import('./charter').CharterPassage;
  charterOffers?: (import('./charter').CharterPassage & { name: string })[];
  charterRequestAt?: number;
  charterElapsed?: number;
  fishingVoyage?: import('./fishing-expedition').FishingVoyage;
  lastFishingSettlement?: string;
  crewOffers?: { captain: string; name: string; share: number; fuelPrice: number }[];
  crewBerth?: { captain: string; name: string; share: number; stores: Stock };
  /** Continuous catches and paid fishing effort persist across pauses and hauling. */
  trawl?: {
    seconds: number;
    deployed: boolean;
    catch?: Stock;
    fuelUsed: number;
    holdFull?: boolean;
    netFull?: boolean;
    /** Coarse visual cue only; actual catch remains server-side until hauled. */
    activity?: number;
    hauledAt?: number;
    deckLoad?: number;
    /** Server-only encounter state. Never reveal future arrivals to clients. */
    shoal?: {
      ground: number;
      nextChange: number;
      nextFish: number;
      pendingFish?: string;
      luck?: number;
      nextLuck?: number;
    };
  };
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
  /** Home town id. */
  town?: string;
  /** Recipient-only snapshot projection of this player's secret ballots, by town id. */
  ballots?: Record<string, { candidate?: string; proposals: Record<number, boolean> }>;
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
  legacyWaterIntake?: boolean;
  /** Fixed intake: terrain edits can stop it, but never silently move it. */
  waterSource?: { intake: { x: number; z: number }; spring?: string; river?: string };
  /** Default pump recipes follow world rules; explicit premises overrides do not. */
  pumpRecipeManaged?: boolean;
  aircraftHangar?: boolean;
  /** Level selected by server for new foundations; absent on legacy buildings. */
  foundationY?: number;
  /** Local displacement of launch hardware from the terminal; preserves a fixed pad. */
  launchOffset?: { x: number; y: number; z: number };
  leaseOffer?: import('./property-contracts').LeaseOffer;
  operatingLease?: import('./property-contracts').OperatingLease;
  auction?: import('./property-contracts').PropertyAuction;
  /** Public staffing projection; never persisted as employment authority. */
  staffing?: { active: number; ideal: number; ownerOperating: boolean };
  ownerActiveUntil?: number;
  templateId?: string;
  young?: import('./livestock').YoungCohort[];
  meat?: import('./meat-freshness').MeatLot[];
  youngCareAt?: number;
  herdRationCredit?: { feed: number; water: number };
  continuousBreeding?: boolean;
  slaughterFees?: Stock;
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
  employeeNames?: Record<string, string>;
  /** Public activity projection; never a saved door animation state. */
  doorActivity?: { staffed: boolean; inside: boolean };
  /** Public visual projection; private fleet records remain on their owners. */
  storedBoats?: import('./stored-boats').StoredBoatDisplay[];
  price: number;
  investment: number;
  /** Outside stakes. Neighbours can fund a till they do not own and later collect a capped return. */
  stakes?: import('./stakes.ts').OutsideStake[];
  /** High-water till after capital inflows; earnings above this are collectable profit. */
  watermark?: number;
  stock: Stock;
  buy: Stock;
  sell: Stock;
  /** Last prices for explicitly paused shop offers; absent from active market quotes. */
  pausedPrices?: { buy?: Stock; sell?: Stock };
  /** Missing inherits modest bulk-sale defaults; [] explicitly disables discounts. */
  bulkDiscounts?: import('./bulk-discounts').BulkDiscount[];
  capacity: number;
  employees: string[];
  /** Paid places; absent follows the recommended crew automatically. */
  hiringLimit?: number;
  /** Dismissed workers may not immediately retake their job. */
  dismissedUntil?: Record<string, number>;
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
  /** Independent architectural model; absent preserves legacy geometry. */
  architecture?: string;
  size?: import('./building-designs').BuildingSize;
  smoking?: boolean;
  /** Public snapshot projection: production intensity, zero when blocked. */
  operating?: number;
  lodging?: {
    open: boolean;
    rate: number;
    guests: Record<
      string,
      { until: number; stock: Stock; life?: import('./stock-life').StockLife }
    >;
  };
  plots?: import('./farming.ts').Plot[];
  /** Purchased field capacity; legacy farms have four plots. */
  farmPolicy?: import('./farm-policy').FarmPolicy;
  farmStaffSpending?: { day: number; amount: number };
  farmPlots?: number;
  pasture?: import('./pasture-land').Pasture;
  farmLandCost?: number;
}
export interface Ledger {
  details?: { building?: string; trailer?: string; item?: string; quantity?: number };
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
export interface Settings
  extends
    Partial<ObstacleRules>,
    Partial<CalendarRules>,
    Partial<LandscapeRules>,
    Partial<CommunicationRules>,
    Partial<AlpineRules>,
    Partial<ClimateRules>,
    Partial<EconomyRules>,
    Partial<LoanRules>,
    Partial<CreditRules>,
    Partial<CharterRules>,
    Partial<TowingRules>,
    Partial<NpcHouseholdRules>,
    Partial<NpcReserveRules>,
    Partial<NpcBusinessRules>,
    Partial<NpcPricingRules>,
    Partial<NpcCargoRules>,
    Partial<NpcAccountRules>,
    Partial<ConstructionRules>,
    Partial<GatheringRules>,
    Partial<FarmYieldRules>,
    Partial<FishingRules>,
    Partial<VehicleRunningRules>,
    Partial<BoatNavigationRules>,
    Partial<GatheringImplementRules>,
    Partial<NpcJourneyRules>,
    Partial<NpcBusinessLoadRules>,
    Partial<SurvivalRules>,
    Partial<RadioRules>,
    Partial<CanoeRules>,
    Partial<RowboatRules>,
    Partial<StormRules>,
    Partial<WaterSourceRules>,
    Partial<LivestockRules>,
    Partial<MeatRules>,
    Partial<BuildingDoorRules>,
    Partial<FlightRules>,
    Partial<WalkingRules>,
    Partial<GatheringSceneryRules>,
    Partial<FuelRules> {
  crowAbilities: boolean;
  lotteryEnabled: boolean;
  lotteryTicketPrice: number;
  jobsEnabled: boolean;
  ownerOperation: boolean;
  postDeathGraceSeconds: number;
  vehicleMaintenance: boolean;
  vehicleLicences: boolean;
  /** Larger boats need the captain skill. Unset saves stay unrestricted. */
  requireCaptainSkill?: boolean;
  requireMapItem: boolean;
  parishOrders: boolean;
  parishOrderBudget: number;
  resetScriptOnDeath: boolean;
  loseSkillsOnDeath: boolean;
  loseInventoryOnDeath: boolean;
  loseBoatsOnDeath: boolean;
  boatCargoSpoilageDays: number;
  retainBoatFuelOnDeath: boolean;
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
  /** Maximum spring-tide high-to-low range in metres; zero disables tides. */
  tidalRange?: number;
  /** Wind-wave scale, 0 (flat) to 2. */
  oceanWaves?: number;
  /** Square map side in metres. The original village occupies the central 500 m. */
  mapSize: number;
  autoConsumeInventory: boolean;
  /** Eat and drink from inventory while the player is signed in. Defaults to
   * the offline behaviour when unset, so existing worlds keep today's rules. */
  autoConsumeInventoryOnline?: boolean;
  /** Automatic feeding may drink beer and wine. Off everywhere unless set. */
  autoConsumeAlcohol?: boolean;
  autoConsumeHomeStock: boolean;
  homeNeedsMultiplier: number;
  /** Ordinary Odd Jobs shift, in hundredths. Unset saves keep the old 1d. */
  labourShiftPay?: number;
  /** Ordinary labour income allowed per game day, in hundredths. Relief is exempt. */
  labourDailyCap?: number;
  /** Multiplies deposit recovery time; 4 is the default, 1 restores the old pace. */
  resourceRecoveryMultiplier?: number;
  hungerRate: number;
  thirstRate: number;
  maxAge: number;
  productionSeconds: number;
  pastureCapacityMultiplier: number;
  pasturePriceMultiplier: number;
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
  springs?: import('./springs').Spring[];
  waterSourcesVersion?: 1;
  smallCraft?: Record<string, import('./small-craft').SmallCraft>;
  smallCraftSeq?: number;
  /** Last safely surveyed public runway targets; never overwrites private property. */
  airfieldLandingVersion?: string;
  automaticProvisionsVersion?: 1 | 2;
  labourRulesVersion?: 1;
  captainRulesVersion?: 1;
  airfield?: import('./airfield').Airfield;
  /** Public works may relocate gathering sites, retaining depletion and task IDs. */
  resourceRelocations?: Record<string, { x: number; z: number }>;
  /** Saved additional gathering grounds; existing procedural and surveyed sites remain intact. */
  additionalResources?: import('./resources').ResourceNode[];
  resourceExpansionVersion?: 1;
  /** Public, expiring voluntary supply errands; never reservations of goods. */
  supplyIntents?: {
    player: string;
    name: string;
    building: string;
    item: string;
    expires: number;
    role?: 'supply' | 'found' | 'haul' | 'staff';
    kind?: string;
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
  hayPricing?: 1;
  tradePricing?: 1 | 2 | 3 | 4;
  vehicleServicesPricing?: 1;
  livestockPricing?: 1;
  animalPricing?: 1;
  gatherToolsPricing?: 1;
  estateRulesVersion?: 1;
  /** Default Puddlewick building types already supplied; never replenish on restart. */
  parishServices?: string[];
  publicParishVersion?: number;
  /** Last half-hour public shortage shipment, persisted across restarts. */
  harbourShipment?: number;
  exportShipment?: number;
  /** World time of the last processed export boundary, independent of rule changes. */
  exportShipmentAt?: number;
  crewPricing?: 1;
  employmentPolicyVersion?: 1;
  /** Lanes the parish has laid toward buildings off the road network. */
  roads?: import('./town.ts').Road[];
  /** Last game day on which road growth was considered. */
  roadGrowth?: number;
  /** Incremental public roadwork, resumed after saving/restarting. */
  roadProject?: import('./road-projects.ts').RoadProject;
  /** Original/generated lane segments replaced by completed bypasses. */
  retiredRoads?: string[];
  /** One-time retirement of excess public starter types; purchased property is protected. */
  parishRetired?: string[];
  /** One-time restoration of the public starter town meeting place. */
  publicCivicVersion?: 1;
  schemaVersion: 1;
  id: string;
  name: string;
  owner: string;
  template: string;
  time: number;
  created: number;
  settings: Settings;
  trailerTuning?: import('./trailers').TrailerTuning;
  vehicleTuning?: Record<number, import('./vehicle-config').VehicleTuning>;
  players: Record<string, Player>;
  /** Empty boats left at public fishing piers; boathouses store boats out of sight. */
  boatyardVersion?: number;
  /** Public hangar fuel bid and the one-time 500s till. */
  airfieldFuelDeskVersion?: 1;
  boathouseTackleVersion?: 1;
  fishingVoyageVersion?: number;
  oceanVersion?: number;
  lighthouseVersion?: number;
  spaceportSite?: import('./spaceport-site').SpaceportSite;
  coastalBluffs?: import('./coastal-bluffs').CoastalBluff[];
  boatDeathRulesVersion?: 1;
  /** Original terrain extent retained when surrounding navigable ocean is extended. */
  terrainMapSize?: number;
  northernIsland?: import('./northern-island').NorthernIsland;
  seafoodVersion?: number;
  meatVersion?: 1;
  trailers?: Record<string, import('./trailers').Trailer>;
  trailerSeq?: number;
  towJobs?: Record<string, import('./towing').TowJob>;
  boatRescues?: Record<
    string,
    {
      boat: {
        x: number;
        z: number;
        heading: number;
        paint: string;
        slot: number;
        smallCraft?: string;
      };
      cargo: Stock;
      cargoLife?: import('./stock-life').StockLife;
      hold?: Stock;
      holdLife?: import('./stock-life').StockLife;
      holdBasis?: Stock;
      /** A tow delivered this vessel to a shore-accessible landing. */
      landing?: string;
      /** Death-abandoned stores are separate from the respawned player's inventory. */
      provisions?: Stock;
      provisionsLife?: import('./stock-life').StockLife;
      net?: Player['trawl'];
      spoilage?: { daysLeft: number; checkedAt: number; spoiled?: boolean; never?: boolean };
      dinghy: { x: number; z: number; heading: number; moored: boolean; landing?: string };
    }
  >;
  mooredBoats?: Record<
    string,
    {
      x: number;
      z: number;
      heading: number;
      paint: string;
      landing: string;
      /** Saved bank access for a beached rowboat. */
      beached?: { x: number; z: number };
      cargo?: Stock;
      cargoLife?: import('./stock-life').StockLife;
      cargoBasis?: Stock;
      load?: number;
      /** Offshore motorboat tender; fuel remains in its owner’s per-vehicle tank. */
      towedBy?: number;
      rope?: number;
      owner: string;
      slot: number;
    }
  >;
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
  climate?: {
    /** Surface coverage (0–1), retained for older clients and material shaders. */
    snow: number;
    wetness: number;
    /** Settled snow depth in metres; undefined only on older saves. */
    snowDepth?: number;
    /** One-time natural snowpack rebalance version. */
    snowModel?: number;
    /** First 4 cm of winter snowfall, protected until spring. */
    winterBase?: number;
  };
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
  maintenance?: import('./maintenance').Maintenance;
  contractRules?: { leases: boolean; auctions: boolean };
  roundArchive?: import('./round-cycle').RoundCycle['history'];
  roundCycle?: import('./round-cycle').RoundCycle;
  courses?: import('./courses').CourseState[];
  towns: import('./civics.ts').Town[];
  /** World creator's rules for founding, borders and town government. */
  townCharter?: Partial<import('./civics.ts').TownCharter>;
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
  stormClass?: 'small' | 'coastal' | 'seaworthy';
  holdCapacity?: number;
  cargoKind?: import('./trailers').TrailerKind;
  persistentThrottle?: boolean;
  provisions?: boolean;
  crew?: number;
  requiresCaptain?: boolean;
  tank?: number;
  traction?: number;
  headlight?: number;
  lightRange?: number;
  collisionRadius?: number;
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
  length?: number;
  beam?: number;
  draft?: number;
  freeboard?: number;
  width?: number;
}
export interface Recipe {
  inputs: Stock;
  outputs: Stock;
  skill: string;
  seconds: number;
  tier: number;
}
export interface BuildingDef {
  idealEmployees?: number;
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
