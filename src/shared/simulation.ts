import { constructionRefund } from './construction.ts';
import { crowClasses, crowAbility, returnCrow, type CrowClass } from './robocrows.ts';
import { lotteryAction, tickLottery } from './lottery.ts';
import { readBook, tickTownEvents } from './world-stories.ts';
import { drinkAlcohol, intoxicatedSteer } from './intoxication.ts';
import { socialAction } from './social.ts';
import {
  vehicleCondition,
  vehicleRecord,
  recordTravel,
  requiredLicence,
  repairStatus,
  repairRecipientReady,
  restoreVehicle,
  stoppedOutside,
  SERVICE_FEE,
  MAP_PRICE,
} from './vehicle-services.ts';
import { herdSpec, tendHerd, breedHerd, birthHerd } from './livestock.ts';
import { maximumHealth, nutritionEffects, feedShelterNow, nextShelterMeal } from './nutrition.ts';
import { landscapeAction } from './landscape.ts';
import {
  worldItems,
  worldSkills,
  skillLesson,
  setCatalogue,
  worldBuildings,
  applyBuildingTemplate,
} from './world-catalogue.ts';
import { checkActionGuards, questAction, questEvent, resetQuests } from './quests.ts';
import { fulfilOrder, refreshOrders, migrateProcurement } from './procurement.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import { accounts, recordMoney, recordLife, addQuantities } from './reports.ts';
import {
  recordCreditIncome,
  advanceLoans,
  loanAction,
  settleForeclosure,
  forecloseEstate,
} from './loans.ts';
import { propertyQuote, releaseEstate, migrateEstates } from './property.ts';
import { harbourSupply, emergencyImport } from './harbour-supply.ts';
import {
  creatorAction,
  creatorEvent,
  tickCreator,
  creatorBlocksSegment,
  queueCreatorScript,
} from './creator.ts';
import { terrainHeight } from './terrain.ts';
import { fishingDock, travelHeight } from './dock';
export { terrainHeight } from './terrain.ts';
import { waterworksSite } from './shoreline.ts';
import { say, MAX_CHAT_LENGTH } from './messages.ts';
export { say } from './messages.ts';
import { productionStaff, productionSupplied, productionEfficiency } from './sound-state';
import { removeOwnerEmployment } from './economy.ts';
import { expandedTown } from './town.ts';
import { gather, finishGather } from './resources.ts';
import { MAX_MONEY_GIFT, moneyGiftReason, refuellingStatus } from './player-aid.ts';
import { advanceClimate, roadConditions } from './environment.ts';
import { shelter, lodgingAction, roomCount } from './lodging.ts';
import { fireWeapon, tickCombat, joinCombat, leaveCombat, ammunition } from './combat.ts';
import {
  items,
  vehicles,
  buildings as catalog,
  recipes,
  defaults,
  skills,
  checkpoints,
} from './catalog.ts';
import { farmAction, finishHarvest } from './farming.ts';
import { appearance, cottageStyle, tractorPaint } from './appearance.ts';
import { buildingBlocksMovement } from './building-shapes.ts';
import type { World, Player, Building, Stock, Action, Input, Ledger, Settings } from './types.ts';
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export const distance = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.hypot(a.x - b.x, a.z - b.z);
export function money(value: number, rate = 100) {
  const d = value / 100;
  const s = Math.floor(d / rate);
  return `${s ? s.toLocaleString('en-US') + 's ' : ''}${Number((d - s * rate).toFixed(2))}d`;
}
export function damage(value: number, armour: number) {
  return (value * 100) / Math.max(1, armour);
}

export function log(
  w: World,
  kind: Ledger['kind'],
  amount: number,
  from: string,
  to: string,
  reason: string,
  details?: Ledger['details'],
) {
  if (!Number.isSafeInteger(amount) || amount < 0) throw Error('Invalid ledger amount');
  if (amount) recordCreditIncome(w, to, amount, reason);
  if (amount) {
    const entry = {
      id: ++w.ledgerSeq,
      time: w.time,
      kind,
      amount,
      from,
      to,
      reason,
      ...(details ? { details } : {}),
    };
    w.ledger.push(entry);
    recordMoney(w, entry);
  }
}

export function makeBuilding(id: string, kind: string, x: number, z: number): Building {
  const d = catalog[kind];
  if (!d) throw Error('Unknown building type');
  return {
    id,
    kind,
    name: d.name,
    x,
    z,
    rotation: 0,
    price: d.price,
    investment: 0,
    stock: { ...d.stock },
    buy: { ...d.buy },
    sell: { ...d.sell },
    capacity: d.capacity,
    employees: [],
    wage: d.wage,
    progress: 0,
    efficiency: 1,
    condition: 100,
    government: false,
    ...(d.recipe ? { recipe: d.recipe } : {}),
  };
}
export function createWorld(
  id: string,
  name: string,
  owner: string,
  template = 'economy',
  now = Date.now() / 1000,
): World {
  const w: World = {
    schemaVersion: 1,
    id,
    name,
    owner,
    template,
    time: 0,
    created: now,
    settings: { ...defaults },
    vehicleTuning: {},
    players: {},
    buildings: [],
    townLayout: 2,
    tradePricing: 4,
    livestockPricing: 1,
    animalPricing: 1,
    vehicleServicesPricing: 1,
    zones: [{ id: 'green', kind: 'safe', x: 0, z: 0, radius: 42 }],
    terrain: [],
    messages: [],
    ledger: [],
    ledgerSeq: 0,
    ball: { x: 90, z: 45, vx: 0, vz: 0 },
    scores: [0, 0],
    round: 0,
    projectiles: [],
    raceBest: {},
    towns: [{ name: 'Puddlewick', tax: 0.02, residents: [], wars: [] }],
    tier: 0,
    script:
      '-- Aclone world script. Register an event with on("PlayerLogin", function(e) ... end).\non("PlayerLogin", function(e)\n  announce("Welcome to the parish. Mind the tractor.")\nend)',
    scriptVariables: {},
    assets: [],
    kricket: { due: 0, score: {} },
    revision: 0,
  };
  expandedTown.forEach(({ kind, x, z }, i) => {
    const b = makeBuilding('b' + i, kind, x, z);
    b.government = [
      'market',
      'school',
      'pub',
      'garage',
      'workhouse',
      'starport',
      'bank',
      'town',
    ].includes(kind);
    if (b.government) {
      b.owner = 'treasury';
      b.investment = 250000;
    }
    w.buildings.push(b);
  });
  migrateEstates(w);
  migrateProcurement(w);
  if (template === 'combat') w.settings.fighting = true;
  if (template === 'playground') w.settings.hungerRate = w.settings.thirstRate = 0;
  say(w, 'Parish notice', 'Welcome to ' + name + '. A small world. Plenty to get on with.');
  return w;
}
export function addPlayer(w: World, id: string, name: string): Player {
  if (w.players[id]) return w.players[id];
  const p: Player = {
    id,
    name,
    authority: id === w.owner ? 20 : 0,
    cash: w.settings.startingCash,
    bank: 0,
    kudos: 0,
    level: 1,
    x: 0,
    y: 0.15,
    z: 17,
    heading: Math.PI,
    speed: 0,
    fuel: 64,
    health: 60000,
    hunger: 5000,
    thirst: 5000,
    age: 18,
    inventory: { bread: 2, water: 3, tackle: 1, rc: 2 },
    skills: [],
    activeUntil: 0,
    atHome: false,
    vehicle: 0,
    engine: true,
    lights: false,
    team: 0,
    lastShot: -100,
    lastHorn: -100,
    energy: 65000,
    kills: 0,
    deaths: 0,
    muted: false,
    online: false,
    lastSeen: 0,
    repeats: 0,
    importDay: 0,
    imports: 0,
  };
  w.players[id] = p;
  log(w, 'faucet', p.cash, 'treasury', id, 'starting cash');
  return p;
}
function requireThat(condition: unknown, message: string): asserts condition {
  if (!condition) throw Error(message);
}
function num(value: unknown, min: number, max: number, integer = false) {
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
function str(value: unknown, max = 80) {
  requireThat(
    typeof value === 'string' && value.trim().length > 0 && value.length <= max,
    'Invalid text',
  );
  return value.trim();
}
function qty(v: unknown) {
  return num(v, 1, 10000, true);
}
function owner(p: Player) {
  requireThat(p.authority >= 20, 'Owner authority required');
}
function nearby(w: World, p: Player, id: unknown) {
  const b = w.buildings.find((x) => x.id === id);
  requireThat(b, 'Building not found');
  requireThat(distance(p, b) < 18, 'Drive near the building first');
  requireThat(!b.construction, 'Supply the construction materials first');
  return b;
}
function owns(p: Player, b: Building) {
  requireThat(p.authority >= 20 || b.owner === p.id, 'Only the building owner can do that');
}
export function canCarry(p: Player, item: string, n: number, w?: World) {
  const def = worldItems(w)[item];
  return !!def && carry(p, w) + def.weight * n <= vehicles[p.vehicle].capacity;
}
export function carry(p: Player, w?: World) {
  return Object.entries(p.inventory).reduce(
    (s, [k, n]) => s + (worldItems(w)[k]?.weight ?? 0) * n,
    0,
  );
}
function stockAdd(stock: Stock, item: string, n: number) {
  stock[item] = (stock[item] ?? 0) + n;
}
function charge(w: World, p: Player, amount: number, reason: string) {
  requireThat(p.cash >= amount, 'Not enough cash');
  p.cash -= amount;
  log(w, 'sink', amount, p.id, 'treasury', reason);
}
function grant(w: World, p: Player, amount: number, reason: string) {
  p.cash += amount;
  log(w, 'faucet', amount, 'treasury', p.id, reason);
}
function usable(w: World, p: Player, item: string) {
  const def = worldItems(w)[item];
  requireThat(def && (p.inventory[item] ?? 0) > 0, 'You do not carry that item');
  requireThat(
    def.food || def.drink || def.fuel || def.health || def.maxHealth,
    'That item is equipment or a trade good',
  );
  if (def.fuel) {
    requireThat(p.fuel < 64, 'The tank is full');
    p.fuel = Math.min(64, p.fuel + def.fuel);
  } else {
    p.repeats = p.lastFood === item ? p.repeats + 1 : 0;
    p.lastFood = item;
    const scale = p.repeats >= 2 ? 0.5 : 1;
    p.hunger = Math.max(0, p.hunger - (def.food ?? 0) * scale);
    p.thirst = Math.max(0, p.thirst - (def.drink ?? 0) * scale);
  }
  nutritionEffects(p, def);
  drinkAlcohol(p, item, w.time);
  stockAdd(p.inventory, item, -1);
}
// All request validation precedes mutation. The server additionally wraps actions in a transaction.
export function act(w: World, id: string, a: Action): string {
  const items = worldItems(w),
    skills = worldSkills(w);
  const p = w.players[id];
  requireThat(p, 'Unknown player');
  const type = a.type;
  if (
    p.crowBody &&
    ![
      'crow',
      'crowAbility',
      'fire',
      'chargeWeapon',
      'chat',
      'command',
      'horn',
      'engine',
      'lights',
    ].includes(type)
  )
    throw Error('Return from the robocrow before other activities');
  checkActionGuards(w, p, a);
  if (type === 'landscape') return landscapeAction(w, p, a);
  if (type === 'catalogue') {
    setCatalogue(w, p, a.catalogue);
    return 'World catalogue saved.';
  }
  if (type === 'readBook') {
    readBook(w, p, str(a.book));
    return '';
  }
  if (type === 'lottery') return lotteryAction(w, p, a);
  if (type === 'quest') return questAction(w, p, a);
  if (
    ['creator', 'creatorBuilding', 'creatorRemove', 'creatorRecipe', 'interactObject'].includes(
      type,
    )
  )
    return creatorAction(w, p, a);
  let result = ''; // Routine success is acknowledged without a generic notification.
  switch (type) {
    case 'livestock': {
      const b = nearby(w, p, a.building);
      requireThat(a.operation === 'breed', 'Unknown livestock operation');
      const cost = breedHerd(w, p, b);
      log(w, 'sink', cost, b.id, 'treasury', 'livestock breeding');
      result = 'Breeding arranged. Keep the herd fed and cared for during the next hour.';
      break;
    }
    case 'fulfilOrder':
      result = fulfilOrder(w, p, a);
      break;
    case 'farm': {
      farmAction(w, p, nearby(w, p, a.building), a);
      break;
    }
    case 'trade': {
      const b = nearby(w, p, a.building),
        item = str(a.item);
      requireThat(b.owner !== id, 'Owners use the Stockroom, not trades with their own building');
      requireThat(items[item], 'Unknown item');
      const n = qty(a.quantity);
      requireThat(a.direction === 'buy' || a.direction === 'sell', 'Invalid trade direction');
      const buying = a.direction === 'buy';
      const price = (buying ? b.sell : b.buy)[item];
      requireThat(
        Number.isSafeInteger(price) && price >= 0,
        'This building does not trade that item',
      );
      const total = price * n;
      requireThat(Number.isSafeInteger(total), 'Trade too large');
      const day = Math.floor(w.time / 600);
      const imports = p.importDay === day ? p.imports : 0;
      if (buying) {
        if (herdSpec(b)?.animal === item)
          requireThat(
            (b.stock[item] ?? 0) - n >= herdSpec(b)!.minimum,
            `This herd keeps ${herdSpec(b)!.minimum} breeding ${item}; only surplus animals are for sale`,
          );
        requireThat((b.stock[item] ?? 0) >= n || emergencyImport(w, b, item), 'Not enough stock');
        requireThat(p.cash >= total, 'Not enough cash');
        requireThat(canCarry(p, item, n, w), 'Cargo hold is full');
        if (b.kind === 'starport')
          requireThat(imports + n <= w.settings.importCap, 'Daily port import limit reached');
      } else {
        requireThat((p.inventory[item] ?? 0) >= n, 'Not enough items');
        requireThat(b.investment >= total, 'Building has insufficient investment');
        requireThat((b.stock[item] ?? 0) + n <= b.capacity, 'Building storage is full');
      }
      if (buying) {
        const tax = Math.floor(total * clamp(w.settings.salesTax + (w.towns[0]?.tax ?? 0), 0, 1));
        const imported = emergencyImport(w, b, item) ? Math.max(0, n - (b.stock[item] ?? 0)) : 0;
        const importCost = imported ? Math.floor((((total - tax) * imported) / n) * 0.8) : 0;
        if (imported) stockAdd(b.stock, item, imported);
        p.cash -= total;
        b.investment += total - tax - importCost;
        if (importCost)
          log(w, 'sink', importCost, b.id, 'imports', `emergency shipment: ${imported} ${item}`);
        stockAdd(b.stock, item, -n);
        stockAdd(p.inventory, item, n);
        log(w, 'transfer', total - tax, id, b.id, 'purchase', {
          building: b.id,
          item,
          quantity: n,
        });
        log(w, 'sink', tax, id, 'treasury', 'sales tax', { building: b.id, item, quantity: n });
        if (b.kind === 'starport') {
          p.importDay = day;
          p.imports = imports + n;
        }
      } else {
        p.cash += total;
        b.investment -= total;
        stockAdd(b.stock, item, n);
        stockAdd(p.inventory, item, -n);
        log(w, 'transfer', total, b.id, id, 'sale', { building: b.id, item, quantity: n });
      }
      questEvent(w, p, buying ? 'buy' : 'sell', b.id, item, n);
      queueCreatorScript(w, 'TradeComplete', {
        id,
        building: b.id,
        item,
        quantity: n,
        amount: total,
        direction: a.direction as string,
      });
      addQuantities(buying ? accounts(w, b).sold : accounts(w, b).bought, { [item]: n });
      result = `${buying ? 'Bought' : 'Sold'} ${n} ${items[item].name} for ${money(total, w.settings.denariiPerSheckle)}.`;
      recordLife(w, p, {
        kind: 'trade',
        text: result,
        building: b.id,
        item,
        quantity: n,
        amount: total,
      });
      break;
    }
    case 'use':
      usable(w, p, str(a.item));
      result = 'That should help.';
      break;
    case 'buyBuilding': {
      const b = nearby(w, p, a.building);
      requireThat(!b.government && b.owner !== id, 'This property is not for sale');
      requireThat(!b.owner || b.forSale, 'The owner has not listed this property');
      const price = propertyQuote(w, b).total;
      requireThat(p.cash >= price, 'Not enough cash');
      const homes = b.kind === 'home' || b.kind === 'warehouse';
      requireThat(
        w.buildings.filter(
          (b) =>
            b.owner === id &&
            (homes
              ? ['home', 'warehouse'].includes(b.kind)
              : !['home', 'warehouse'].includes(b.kind)),
        ).length < (homes ? w.settings.maxHomes : w.settings.maxBuildings),
        'Property limit reached',
      );
      const seller = b.owner && w.players[b.owner];
      if (settleForeclosure(w, b, p, price)) {
        // Foreclosure receipts already allocate bank recovery and former-owner surplus.
      } else if (seller) {
        p.cash -= price;
        seller.cash += price;
        log(w, 'transfer', price, p.id, seller.id, 'property sale');
      } else charge(w, p, price, 'property purchase');
      if (seller)
        recordLife(w, seller, {
          kind: 'property',
          building: b.id,
          text: `Sold ${b.name}`,
          amount: price,
        });
      recordLife(w, p, {
        kind: 'property',
        building: b.id,
        text: `Purchased ${b.name}`,
        amount: price,
      });
      b.owner = id;
      delete b.estate;
      removeOwnerEmployment(w, b);
      b.forSale = false;
      result = `You now own ${b.name}. Bring a broom.`;
      break;
    }
    case 'listProperty': {
      const b = nearby(w, p, a.building);
      owns(p, b);
      requireThat(!b.government, 'Government property is not for sale');
      requireThat(!b.lien, 'Repay the mortgage before listing this property');
      b.price = num(a.price, 1, 100000000, true);
      b.forSale = true;
      result = 'Property listed for sale.';
      break;
    }
    case 'production': {
      owner(p);
      const b = nearby(w, p, a.building);
      requireThat(b.kind !== 'farm', 'Farm plots use the seasonal crop calendar');
      const readStock = (v: unknown) => {
        requireThat(v && typeof v === 'object' && !Array.isArray(v), 'Expected an item map');
        const stock: Stock = {};
        requireThat(Object.keys(v).length <= 8, 'At most eight recipe items');
        for (const [item, n] of Object.entries(v)) {
          requireThat(Object.hasOwn(items, item), 'Unknown item');
          stock[item] = num(n, 1, 1000, true);
        }
        return stock;
      };
      const inputs = readStock(a.inputs),
        outputs = readStock(a.outputs),
        seconds = num(a.seconds, 10, 86400, true),
        skill = str(a.skill);
      requireThat(
        skills.includes(skill) && Object.keys(outputs).length > 0,
        'Choose a valid profession and output',
      );
      b.production = { inputs, outputs, seconds, skill, tier: 0 };
      b.progress = 0;
      break;
    }
    case 'vehicleTuning': {
      owner(p);
      const slot = num(a.slot, 0, 23, true);
      const tuning = {
        speed: num(a.speed, 1, 100),
        acceleration: num(a.acceleration, 1, 50),
        turn: num(a.turn, 0.1, 6),
        armour: num(a.armour, 10, 1000),
        fuel: num(a.fuel, 0, 1),
      };
      w.vehicleTuning ??= {};
      w.vehicleTuning[slot] = tuning;
      break;
    }
    case 'investment': {
      const b = nearby(w, p, a.building);
      owns(p, b);
      const n = qty(a.amount);
      requireThat(a.direction === 'deposit' || a.direction === 'withdraw', 'Invalid direction');
      if (a.direction === 'deposit') {
        requireThat(p.cash >= n, 'Not enough cash');
        p.cash -= n;
        b.investment += n;
        log(w, 'transfer', n, id, b.id, 'investment');
      } else {
        requireThat(b.investment >= n, 'Not enough investment');
        b.investment -= n;
        p.cash += n;
        log(w, 'transfer', n, b.id, id, 'withdrawal');
      }
      break;
    }
    case 'stock': {
      const b = nearby(w, p, a.building);
      owns(p, b);
      const item = str(a.item),
        n = qty(a.quantity);
      requireThat(items[item], 'Unknown item');
      requireThat(['deposit', 'withdraw'].includes(String(a.direction)), 'Invalid direction');
      const put = a.direction === 'deposit';
      const source = put ? p.inventory : b.stock;
      requireThat((source[item] ?? 0) >= n, 'Not enough stock');
      requireThat(
        put ? (b.stock[item] ?? 0) + n <= b.capacity : canCarry(p, item, n, w),
        'Storage full',
      );
      stockAdd(source, item, -n);
      stockAdd(put ? b.stock : p.inventory, item, n);
      break;
    }
    case 'buildingAdmin': {
      const b = nearby(w, p, a.building);
      owns(p, b);
      const name = a.name === undefined ? b.name : str(a.name, 48);
      const wage = a.wage === undefined ? b.wage : num(a.wage, 0, 1000000, true);
      let price: number | undefined, item: string | undefined;
      if (a.item !== undefined) {
        item = str(a.item);
        requireThat(items[item], 'Unknown item');
        price = num(a.price, 0, 10000000, true);
        requireThat(a.side === 'buy' || a.side === 'sell', 'Invalid price side');
      }
      b.name = name;
      b.wage = wage;
      if (item && price !== undefined) (a.side === 'buy' ? b.buy : b.sell)[item] = price;
      break;
    }
    case 'job': {
      requireThat(w.settings.jobsEnabled !== false, 'Paid jobs are disabled in this world');
      const b = nearby(w, p, a.building);
      requireThat(b.owner !== id, 'You cannot take paid work or tasks at your own building');
      requireThat(!p.job || p.job === b.id, 'Quit your current job first');
      const recipe =
        b.kind === 'farm' ? recipes.farm : (b.production ?? (b.recipe && recipes[b.recipe]));
      requireThat(recipe, 'No work at this building');
      requireThat(
        p.skills.includes(recipe.skill),
        'Learn ' + recipe.skill + ' at the school first',
      );
      // Reaccepting an existing job renews its shift without a second staff slot.
      if (!b.employees.includes(id)) {
        requireThat(b.employees.length < 16, 'All jobs filled');
        b.employees.push(id);
      }
      if (p.job !== b.id)
        recordLife(w, p, { kind: 'job', building: b.id, text: `Took a job at ${b.name}` });
      if (p.job !== b.id) questEvent(w, p, 'job', b.id);
      queueCreatorScript(w, 'JobChanged', { id, building: b.id, previous: p.job ?? '' });
      p.job = b.id;
      p.activeUntil = w.time + 2 * productionInterval(w, b);
      result =
        'Employed here and working for the next two cycles; production is scheduled, not instant.';
      break;
    }
    case 'quit': {
      if (p.job) {
        const b = w.buildings.find((b) => b.id === p.job);
        if (b) b.employees = b.employees.filter((e) => e !== id);
        recordLife(w, p, { kind: 'job', building: p.job, text: `Left job at ${b?.name ?? p.job}` });
        queueCreatorScript(w, 'JobChanged', { id, building: '', previous: p.job });
        delete p.job;
      }
      break;
    }
    case 'work': {
      const b = nearby(w, p, a.building);
      if (w.settings.ownerOperation && b.owner === p.id) {
        const recipe = b.production ?? (b.recipe && recipes[b.recipe]);
        requireThat(
          recipe && b.kind !== 'farm',
          'This business uses different production controls',
        );
        requireThat(p.skills.includes(recipe.skill), 'Learn ' + recipe.skill + ' first');
        b.ownerActiveUntil = w.time + 2 * productionInterval(w, b);
        result = 'Operating your business for two cycles without wages.';
        break;
      }
      requireThat(b.owner !== id, 'You cannot take paid work or tasks at your own building');
      requireThat(w.settings.jobsEnabled !== false, 'Paid jobs are disabled in this world');
      requireThat(p.job === b.id, 'Take a job here first');
      p.activeUntil = w.time + 2 * productionInterval(w, b);
      result = 'Working for the next two cycles. The glamour is unbearable.';
      break;
    }
    case 'learn': {
      const b = nearby(w, p, a.building);
      requireThat(b.kind === 'school', 'Visit the school');
      const skill = str(a.skill);
      requireThat(skills.includes(skill), 'Unknown skill');
      requireThat(
        !p.learning && !p.skills.includes(skill) && p.skills.length < w.settings.maxSkills,
        'Already learning, already qualified, or skill limit reached',
      );
      const lesson = skillLesson(w, p, skill);
      requireThat(
        lesson.prerequisites.every((s) => p.skills.includes(s)),
        'Learn prerequisites first: ' + lesson.prerequisites.join(', '),
      );
      charge(w, p, lesson.price, 'tuition');
      p.learning = { skill, end: w.time + lesson.seconds };
      break;
    }
    case 'gather': {
      gather(w, p, str(a.node));
      break;
    }
    case 'task': {
      const b = nearby(w, p, a.building);
      requireThat(b.owner !== id, 'You cannot take paid work or tasks at your own building');
      requireThat(!p.task, 'Already busy');
      const task = str(a.task);
      if (task === 'labour')
        requireThat(w.settings.jobsEnabled !== false, 'Paid jobs are disabled in this world');
      requireThat(['labour', 'logging', 'quarrying', 'craft'].includes(task), 'Unknown task');
      requireThat(
        task === 'labour'
          ? b.kind === 'workhouse'
          : task === 'logging'
            ? b.kind === 'sawmill'
            : task === 'quarrying'
              ? b.kind === 'quarry'
              : b.kind === 'forge',
        'Wrong workplace',
      );
      requireThat(
        task === 'craft' || task === 'labour',
        'Gather at the marked woodland or mineral grounds using the Resources menu',
      );
      if (task === 'craft') {
        requireThat(
          (p.inventory.steel ?? 0) >= 1 && (p.inventory.wood ?? 0) >= 2,
          'Requires 1 steel and 2 wood',
        );
        requireThat(canCarry(p, 'tools', 1, w), 'Cargo full');
        stockAdd(p.inventory, 'steel', -1);
        stockAdd(p.inventory, 'wood', -2);
      } else if (task !== 'labour')
        requireThat(canCarry(p, task === 'logging' ? 'logs' : 'stone', 3, w), 'Cargo full');
      p.task = { kind: task, end: w.time + 15, building: b.id };
      p.speed = 0;
      result = 'A bit of honest work. 15 seconds.';
      break;
    }
    case 'lodging': {
      lodgingAction(w, p, nearby(w, p, a.building), a);
      break;
    }
    case 'home': {
      requireThat(p.game !== 'combat', 'Leave combat before entering a home');
      const b = nearby(w, p, a.building);
      requireThat(
        !b.construction &&
          ((b.kind === 'home' && b.owner === id) || (b.lodging?.guests[id]?.until ?? 0) > w.time),
        'You need your own home or a booked room',
      );
      requireThat(!p.task && !p.hitch && !p.crowBody, 'Finish your activity first');
      p.home = b.id;
      p.atHome = true;
      p.speed = 0;
      break;
    }
    case 'outside':
      p.atHome = false;
      break;
    case 'loan': {
      const b = nearby(w, p, a.building);
      result = loanAction(w, p, b, a);
      break;
    }
    case 'bank': {
      const b = nearby(w, p, a.building);
      requireThat(b.kind === 'bank', 'Visit the bank');
      const n = qty(a.amount);
      requireThat(a.direction === 'deposit' || a.direction === 'withdraw', 'Invalid direction');
      const deposit = a.direction === 'deposit';
      requireThat((deposit ? p.cash : p.bank) >= n, 'Insufficient funds');
      p.cash += deposit ? -n : n;
      p.bank += deposit ? n : -n;
      log(w, 'transfer', n, deposit ? id : id + ':bank', deposit ? id + ':bank' : id, 'bank');
      break;
    }
    case 'paint': {
      const b = nearby(w, p, a.building);
      requireThat(b.kind === 'garage', 'Visit the garage to repaint your tractor');
      const color = str(a.color);
      requireThat(tractorPaint(color), 'Choose a paint from the garage palette');
      requireThat(p.tractorPaint !== color, 'Your tractor already has that paint');
      charge(w, p, appearance.paintPrice, 'tractor repaint');
      p.tractorPaint = color;
      result = 'Fresh paint. Same dependable tractor.';
      break;
    }
    case 'buyMap': {
      const b = nearby(w, p, a.building);
      requireThat(b.kind === 'garage' && !b.construction, 'Visit a completed garage');
      requireThat(!(p.inventory.parishMap > 0), 'You already carry a parish map');
      requireThat(p.cash >= MAP_PRICE, 'Not enough cash');
      p.cash -= MAP_PRICE;
      b.investment += MAP_PRICE;
      stockAdd(p.inventory, 'parishMap', 1);
      log(w, 'transfer', MAP_PRICE, p.id, b.id, 'map printing');
      break;
    }
    case 'serviceVehicle': {
      const b = nearby(w, p, a.building);
      requireThat(b.kind === 'garage' && !b.construction, 'Visit a completed garage');
      requireThat(
        repairRecipientReady(p),
        'Stop an available vehicle outside below full condition',
      );
      requireThat(p.inventory.steel > 0, 'Carry Steel spare parts');
      const fee = b.owner === p.id ? 0 : SERVICE_FEE;
      requireThat(p.cash >= fee, 'Not enough cash');
      p.cash -= fee;
      b.investment += fee;
      stockAdd(p.inventory, 'steel', -1);
      restoreVehicle(w, p);
      log(w, 'transfer', fee, p.id, b.id, 'vehicle service');
      break;
    }
    case 'repairVehicle': {
      const target = w.players[str(a.player)],
        status = repairStatus(w, p, target);
      requireThat(!status.reason, status.reason ?? 'Cannot repair');
      stockAdd(p.inventory, 'steel', -1);
      restoreVehicle(w, target);
      say(
        w,
        'Roadside help',
        `${p.name} repaired your vehicle with Steel spare parts.`,
        'system',
        target.id,
      );
      say(w, 'Roadside help', `You repaired ${target.name}'s vehicle.`, 'system', p.id);
      break;
    }
    case 'vehicle': {
      const slot = num(a.slot, 0, 23, true);
      requireThat(
        p.game !== 'combat' || [0, 5].includes(slot),
        'Arena combat uses tractors or walking',
      );
      requireThat(slot !== 7 && slot !== 6, 'Use a robocrow item; ostriches happen by accident');
      const licence = requiredLicence(w, slot);
      requireThat(
        !licence || p.skills.includes(licence),
        `Learn ${licence} at school to drive this vehicle`,
      );
      const fleet = p.fleet ?? [0, 5];
      requireThat(
        carry(p, w) <= vehicles[slot].capacity,
        'Unload cargo before changing to a smaller vehicle',
      );
      if (slot !== 5 && slot !== 0) {
        const b = nearby(w, p, a.building);
        requireThat(b.kind === 'garage', 'Visit the garage');
        if (!fleet.includes(slot)) {
          charge(w, p, vehicles[slot].price, 'vehicle purchase');
          fleet.push(slot);
        }
      }
      p.fleet = fleet;
      p.vehicle = slot;
      vehicleRecord(w, p);
      p.speed = 0;
      p.y = terrainHeight(w, p.x, p.z);
      break;
    }
    case 'engine':
      p.engine = !p.engine;
      break;
    case 'lights':
      p.lights = !p.lights;
      break;
    case 'crowAbility':
      return crowAbility(w, p, str(a.operation));
    case 'crow': {
      requireThat(p.game !== 'combat', 'Leave combat before flying a robocrow');
      if (p.crowBody) {
        returnCrow(w, p);
      } else {
        requireThat(
          !p.task && !p.game && !p.hitch && !p.atHome,
          'Finish your activity and go outside first',
        );
        const crowClass = str(a.class ?? 'scout') as CrowClass;
        requireThat(Object.hasOwn(crowClasses, crowClass), 'Unknown robocrow class');
        requireThat(
          crowClass === 'scout' || (w.settings.crowAbilities && w.settings.fighting),
          'Advanced robocrows are disabled',
        );
        requireThat((p.inventory.rc ?? 0) > 0, 'Carry a Disposable robocrow');
        if (w.settings.crowAbilities && w.settings.fighting) {
          p.crowClass = crowClass;
          p.crowIntegrity = crowClasses[crowClass].integrity;
        }
        stockAdd(p.inventory, 'rc', -1);
        p.crowBody = { x: p.x, z: p.z, vehicle: p.vehicle };
        p.vehicle = 7;
        p.y += 8;
      }
      p.speed = 0;
      break;
    }
    case 'joinGame': {
      const game = str(a.game);
      requireThat(['hornball', 'race', 'fishing', 'kricket'].includes(game), 'Unknown game');
      requireThat(!p.task && p.game !== 'combat', 'Finish your task or leave combat first');
      if (game === 'fishing') {
        requireThat((p.inventory.tackle ?? 0) > 0, 'Carry Fishing tackle');
        requireThat(w.settings.fishingMode !== 0, 'Fishing is disabled');
      }
      if (game === 'kricket') requireThat(!w.kricket.bowler || !w.kricket.batter, 'Pitch is full');
      p.game = game;
      p.atHome = false;
      if (game === 'hornball') {
        const joined = Object.values(w.players).filter((p) => p.game === 'hornball' && p.id !== id);
        p.team =
          joined.filter((p) => p.team === 0).length <= joined.filter((p) => p.team === 1).length
            ? 0
            : 1;
        p.x = p.team ? 102 : 78;
        p.z = 45 + ((joined.length % 3) - 1) * 5;
        p.heading = p.team ? -Math.PI / 2 : Math.PI / 2;
        p.vehicle = 0;
      }
      if (game === 'race') {
        p.x = -75;
        p.z = -20;
        p.vehicle = 0;
        p.race = { start: w.time + 3, next: 1 };
        p.heading = -Math.PI / 4;
      }
      if (game === 'fishing') {
        requireThat((p.inventory.tackle ?? 0) > 0, 'Carry Fishing tackle');
        requireThat(w.settings.fishingMode !== 0, 'Fishing is disabled');
        p.x = fishingDock.x;
        p.z = fishingDock.z + 2;
        p.y = travelHeight(w, p.x, p.z);
        const mode = w.settings.fishingMode;
        p.fishAt =
          w.time +
          (mode === 5 ? 10 : mode === 2 ? 60 : 30) +
          Math.random() * (mode === 5 ? 20 : 180);
        p.fishUntil = (p.fishAt ?? 0) + 8;
      }
      if (game === 'kricket') {
        requireThat(!w.kricket.bowler || !w.kricket.batter, 'Pitch is full');
        if (!w.kricket.bowler) w.kricket.bowler = id;
        else w.kricket.batter = id;
        p.x = 70;
        p.z = -70;
        p.vehicle = 5;
      }
      p.speed = 0;
      break;
    }
    case 'leaveGame': {
      leaveCombat(w, p);
      delete p.game;
      delete p.race;
      delete p.fishAt;
      delete p.fishUntil;
      if (w.kricket.batter === id) delete w.kricket.batter;
      if (w.kricket.bowler === id) delete w.kricket.bowler;
      break;
    }
    case 'horn': {
      requireThat(w.time - p.lastHorn >= 0.35, 'Let the horn breathe');
      p.lastHorn = w.time;
      if (p.game === 'hornball' && distance(p, w.ball) < 22) {
        const d = Math.max(1, distance(p, w.ball));
        w.ball.vx += ((w.ball.x - p.x) / d) * 17;
        w.ball.vz += ((w.ball.z - p.z) / d) * 17;
      }
      result = 'Parp.';
      break;
    }
    case 'reel': {
      requireThat(p.game === 'fishing' && p.fishAt !== undefined, 'Cast a line first');
      requireThat(
        w.time >= p.fishAt && w.time <= (p.fishUntil ?? 0),
        'No bite yet, or that one got away',
      );
      requireThat(canCarry(p, 'fish', 1, w), 'Cargo full');
      stockAdd(p.inventory, 'fish', 1);
      p.kudos++;
      p.fishAt = w.time + 20;
      p.fishUntil = p.fishAt + 8;
      result = 'A small fish. A substantial achievement.';
      break;
    }
    case 'kricket': {
      requireThat(p.game === 'kricket', 'Join Ultrakricket first');
      if (w.kricket.bowler === id) {
        requireThat(!w.kricket.due, 'The grenade is already in flight');
        w.kricket.due = w.time + 3;
        result = 'Bowled. Three seconds ought to do it.';
      } else {
        requireThat(w.kricket.batter === id && w.kricket.due > 0, 'Wait for a delivery');
        const good = Math.abs(w.time - w.kricket.due) < 0.65;
        w.kricket.score[id] = (w.kricket.score[id] ?? 0) + (good ? 6 : 0);
        if (!good) kill(w, p, true);
        else p.kudos += 2;
        w.kricket.due = 0;
        result = good ? 'Six! An entirely regulation explosion.' : 'A duck. Almost literally.';
      }
      break;
    }
    case 'joinCombat':
      joinCombat(w, p, str(a.mode));
      break;
    case 'chargeWeapon':
    case 'fire':
      fireWeapon(w, p, a);
      break;
    case 'refit': {
      const b = nearby(w, p, a.building);
      requireThat(b.kind === 'garage', 'Visit the garage');
      requireThat(w.time - p.lastShot >= 10, 'Wait ten seconds after firing');
      charge(w, p, 2500, 'ammunition refit');
      p.ammo = { ...ammunition };
      p.energy = 65000;
      break;
    }
    case 'construct': {
      const requested = str(a.kind),
        kind = w.catalogue?.templates[requested]?.base ?? requested,
        def = worldBuildings(w)[requested];
      const site =
        kind === 'waterworks' && (a.x !== undefined || a.z !== undefined)
          ? { x: num(a.x, -240, 240), z: num(a.z, -240, 240) }
          : p;
      requireThat(distance(p, site) <= 4, 'Move within four metres of the construction site');
      const style = kind === 'home' && a.style !== undefined ? str(a.style) : undefined;
      requireThat(style === undefined || cottageStyle(style), 'Choose a cottage style');
      requireThat(def && def.tier <= w.tier, 'Building unavailable at this civilization tier');
      requireThat(
        !w.zones.some((z) => z.kind === 'noBuild' && distance(site, z) < z.radius),
        'Construction prohibited in this zone',
      );
      requireThat(
        w.buildings.every((b) => distance(site, b) > 12),
        'Too close to another building',
      );
      const shore = kind === 'waterworks' ? waterworksSite(w, site) : undefined;
      requireThat(
        kind !== 'waterworks' || shore,
        'Waterworks require dry ground directly on a shoreline with water within 10 metres',
      );
      const home = ['home', 'warehouse'].includes(kind);
      requireThat(
        w.buildings.filter(
          (b) =>
            b.owner === id &&
            (home
              ? ['home', 'warehouse'].includes(b.kind)
              : !['home', 'warehouse'].includes(b.kind)),
        ).length < (home ? w.settings.maxHomes : w.settings.maxBuildings),
        'Property limit reached',
      );
      charge(w, p, Math.round(def.price * (1 + w.towns[0].tax)), 'construction');
      const b = makeBuilding('b' + ++w.revision + '-' + Math.floor(w.time), kind, site.x, site.z);
      applyBuildingTemplate(w, b, requested);
      b.owner = id;
      if (shore) b.rotation = shore.rotation;
      if (style) b.style = style;
      b.investment = 0;
      b.stock = {};
      b.construction = { ...def.materials };
      b.constructionCost = def.price;
      w.buildings.push(b);
      result = 'Construction site placed. Deliver the materials listed at the site.';
      break;
    }
    case 'cancelConstruction': {
      const b = w.buildings.find((b) => b.id === a.building);
      requireThat(b && b.construction, 'Choose an unfinished construction site');
      requireThat(b.owner === p.id, 'Only the building owner can cancel construction');
      requireThat(distance(p, b) < 18, 'Drive near the construction site first');
      requireThat(!b.government && !b.lien, 'This property cannot be cancelled');
      const refund = constructionRefund(w, b);
      w.buildings = w.buildings.filter((site) => site !== b);
      if (w.creator) w.creator.rules = w.creator.rules.filter((r) => r.target !== b.id);
      grant(w, p, refund, 'Construction refund: ' + b.name);
      result =
        'Construction cancelled. Refunded ' + money(refund, w.settings.denariiPerSheckle) + '.';
      break;
    }
    case 'supply': {
      const b = w.buildings.find((b) => b.id === a.building);
      requireThat(b && distance(p, b) < 18 && b.construction, 'No nearby construction site');
      for (const [item, n] of Object.entries(b.construction)) {
        const take = Math.min(n, p.inventory[item] ?? 0);
        stockAdd(p.inventory, item, -take);
        b.construction[item] -= take;
      }
      if (Object.values(b.construction).every((n) => !n)) {
        delete b.construction;
        delete b.constructionCost;
        questEvent(w, p, 'build', b.templateId ?? b.kind);
        queueCreatorScript(w, 'BuildingComplete', { id, building: b.id, kind: b.kind });
        result = 'Building complete. Civilisation marches on.';
      }
      break;
    }
    case 'repair': {
      const b = nearby(w, p, a.building);
      owns(p, b);
      charge(w, p, Math.round((b.price * (100 - b.condition)) / 100), 'repairs');
      b.condition = 100;
      break;
    }
    case 'demolish': {
      const b = nearby(w, p, a.building);
      owns(p, b);
      requireThat(!b.government, 'Government buildings cannot be demolished');
      requireThat(!b.lien, 'Repay the mortgage before demolishing this property');
      requireThat(
        !Object.values(w.players).some((p) =>
          p.loans?.some((l) => l.bank === b.id && l.status !== 'paid'),
        ),
        'Outstanding loans must be settled before demolishing this bank',
      );
      requireThat(
        !Object.values(b.lodging?.guests ?? {}).some(
          (g) => g.until > w.time || Object.values(g.stock).some((n) => n > 0),
        ),
        'Guests must check out and collect their supplies first',
      );
      w.buildings = w.buildings.filter((x) => x !== b);
      if (w.creator) w.creator.rules = w.creator.rules.filter((r) => r.target !== b.id);
      break;
    }
    case 'settings': {
      owner(p);
      const patch = a.patch;
      requireThat(patch && typeof patch === 'object' && !Array.isArray(patch), 'Invalid settings');
      const clean: Partial<Settings> = {};
      for (const [key, v] of Object.entries(patch)) {
        requireThat(Object.hasOwn(w.settings, key), 'Unknown setting');
        const old = w.settings[key as keyof Settings];
        if (typeof old === 'boolean') requireThat(typeof v === 'boolean', 'Expected boolean');
        else if (key === 'weaponMode')
          requireThat(
            typeof v === 'string' && ['energy', 'ammo'].includes(v),
            'Choose energy or ammo',
          );
        else num(v, key === 'seaLevel' ? -50 : 0, key === 'startingCash' ? 1e8 : 1e6);
        if (
          [
            'salesTax',
            'wageTax',
            'offlineEfficiency',
            'estateEquityShare',
            'estateAnnualDiscount',
            'deathCashRetention',
            'deathBankRetention',
          ].includes(key)
        )
          num(v, 0, 1);
        if (['denariiPerSheckle', 'productionSeconds', 'maxAge', 'exchangeRate'].includes(key))
          num(v, 1, 1e6);
        if (
          [
            'parishOrderBudget',
            'startingCash',
            'denariiPerSheckle',
            'maxBuildings',
            'maxHomes',
            'maxSkills',
            'importCap',
            'exchangeRate',
            'exchangeCap',
          ].includes(key)
        )
          num(v, 0, 100000000, true);
        if (key === 'postDeathGraceSeconds') num(v, 0, 86400, true);
        if (key === 'productionSeconds') num(v, 10, 86400, true);
        if (key === 'lotteryTicketPrice') num(v, 1, 1000000, true);
        if (key === 'killReward') num(v, 0, 100000, true);
        if (key === 'fishingMode') num(v, 0, 5, true);
        if (key === 'seaLevel') num(v, -50, 50);
        (clean as Record<string, unknown>)[key] = v;
      }
      Object.assign(w.settings, clean);
      w.revision++;
      break;
    }
    case 'terrain': {
      owner(p);
      const x = num(a.x, -250, 250),
        z = num(a.z, -250, 250),
        radius = num(a.radius, 1, 100),
        height = num(a.height, -30, 30);
      requireThat(w.terrain.length < 256, 'Terrain stamp limit reached');
      w.terrain.push({ x, z, radius, height });
      w.revision++;
      break;
    }
    case 'zone': {
      owner(p);
      const kind = str(a.kind);
      requireThat(
        ['safe', 'noBuild', 'spawn', 'game', 'script', 'vehicle'].includes(kind),
        'Invalid zone',
      );
      const x = num(a.x, -250, 250),
        z = num(a.z, -250, 250),
        radius = num(a.radius, 1, 100);
      requireThat(w.zones.length < 128, 'Zone limit reached');
      w.zones.push({
        id: 'z' + ++w.revision,
        kind: kind as World['zones'][0]['kind'],
        x,
        z,
        radius,
      });
      break;
    }
    case 'place': {
      owner(p);
      const kind = str(a.kind),
        x = num(a.x, -250, 250),
        z = num(a.z, -250, 250);
      requireThat(catalog[kind], 'Unknown building');
      requireThat(w.buildings.length < 500, 'Building limit reached');
      const shore = kind === 'waterworks' ? waterworksSite(w, { x, z }) : undefined;
      requireThat(kind !== 'waterworks' || shore, 'Waterworks require a dry shoreline site');
      const b = makeBuilding('editor' + ++w.revision, kind, x, z);
      if (shore) b.rotation = shore.rotation;
      b.owner = id;
      w.buildings.push(b);
      break;
    }
    case 'town': {
      const b = nearby(w, p, a.building);
      requireThat(b.kind === 'town', 'Visit the town plinth');
      const town = w.towns[0];
      if (a.operation === 'join') {
        if (!town.residents.includes(id)) town.residents.push(id);
        p.town = town.name;
      } else if (a.operation === 'stand') {
        requireThat(town.residents.includes(id), 'Become a resident first');
        requireThat(!town.mayor || town.mayor === id, 'This town already has a mayor');
        town.mayor = id;
      } else if (a.operation === 'tax') {
        requireThat(town.mayor === id || p.authority === 20, 'Only the mayor can set town tax');
        town.tax = num(a.tax, 0, 0.5);
      }
      break;
    }
    case 'postMail':
    case 'deleteMail':
    case 'family':
    case 'offerTrade':
    case 'acceptTrade':
    case 'cancelTrade':
      return socialAction(w, p, a);
    case 'group': {
      const kind = str(a.kind);
      requireThat(['tribe', 'family'].includes(kind), 'Unknown group');
      if (kind === 'family')
        return socialAction(w, p, { type: 'family', operation: 'create', name: a.name });
      p.tribe = str(a.name, 32);
      break;
    }
    case 'hitch': {
      requireThat(p.game !== 'combat', 'Leave combat before hitching a ride');
      const target = w.players[String(a.player)];
      requireThat(
        target &&
          target.id !== id &&
          stoppedOutside(p) &&
          stoppedOutside(target) &&
          target.vehicle !== 5 &&
          distance(p, target) < 10 &&
          Math.abs(p.y - target.y) <= 3,
        'No nearby driver',
      );
      requireThat(
        Object.values(w.players).filter((p) => p.hitch === target.id).length <
          vehicles[target.vehicle].hitch,
        'No passenger room',
      );
      p.hitch = target.id;
      break;
    }
    case 'detach':
      delete p.hitch;
      break;
    case 'giveMoney': {
      const target = w.players[str(a.player)],
        n = num(a.amount, 1, MAX_MONEY_GIFT, true);
      const reason = moneyGiftReason(w, p, target);
      requireThat(!reason, reason ?? 'Cannot give money');
      requireThat(p.cash >= n, 'Not enough cash in hand');
      requireThat(Number.isSafeInteger(target.cash + n), 'Recipient cash limit reached');
      p.cash -= n;
      target.cash += n;
      log(w, 'transfer', n, p.id, target.id, 'player gift');
      say(
        w,
        'Money gift',
        `${p.name} gave you ${money(n, w.settings.denariiPerSheckle)}.`,
        'system',
        target.id,
      );
      say(
        w,
        'Money gift',
        `You gave ${target.name} ${money(n, w.settings.denariiPerSheckle)}.`,
        'system',
        p.id,
      );
      break;
    }
    case 'refuelPlayer': {
      const target = w.players[str(a.player)],
        status = refuellingStatus(w, p, target);
      requireThat(!status.reason, status.reason ?? 'Cannot refuel');
      stockAdd(p.inventory, 'fuel', -1);
      target.fuel = Math.min(64, target.fuel + status.units);
      const amount = Number(status.units.toFixed(2));
      say(
        w,
        'Roadside help',
        `${p.name} refuelled your vehicle (+${amount} fuel).`,
        'system',
        target.id,
      );
      say(
        w,
        'Roadside help',
        `You used 1 Fuel to refuel ${target.name} (+${amount} fuel).`,
        'system',
        p.id,
      );
      break;
    }
    case 'give': {
      const target = w.players[String(a.player)],
        item = str(a.item),
        n = qty(a.quantity);
      requireThat(
        target && target.id !== id && distance(p, target) < 15,
        'Recipient must be nearby',
      );
      requireThat(items[item] && (p.inventory[item] ?? 0) >= n, 'Not enough items');
      requireThat(canCarry(target, item, n, w), 'Recipient cargo full');
      stockAdd(p.inventory, item, -n);
      stockAdd(target.inventory, item, n);
      break;
    }
    case 'chat': {
      requireThat(!p.muted && !w.settings.chatLocked, 'Chat is currently muted');
      const text = str(a.text, MAX_CHAT_LENGTH);
      if (text.startsWith('*')) return command(w, p, text);
      const to = a.to === undefined ? undefined : str(a.to);
      requireThat(!to || w.players[to], 'Unknown recipient');
      say(w, p.name, text, 'chat', to);
      if (p.npc) w.messages.at(-1)!.npc = true;
      break;
    }
    case 'command':
      return command(w, p, str(a.text, 300));
    case 'respawn':
      leaveCombat(w, p);
      if (p.game === 'combat') delete p.game;
      p.x = 0;
      p.z = 17;
      p.y = 0.15;
      p.speed = 0;
      break;
    default:
      throw Error('Unknown action');
  }
  return result;
}
export function command(w: World, p: Player, text: string): string {
  const [cmd, ...args] = text.replace(/^\*/, '').split(/\s+/);
  const publicCommands = [
    'help',
    'showfuel',
    'showjobs',
    'jobs',
    'showowned',
    'economy',
    'me',
    'resetpos',
  ];
  requireThat(
    publicCommands.includes(cmd) ||
      p.authority >=
        ({
          say: 4,
          announce: 10,
          kick: 10,
          gag: 10,
          teleport: 12,
          cash: 16,
          grantitem: 16,
          settime: 16,
          sethealth: 16,
          setvehicle: 16,
          fighting: 20,
        }[cmd] ?? 20),
    'Insufficient authority',
  );
  const target = () => {
    const t = Object.values(w.players).find((p) => p.name === args[0] || p.id === args[0]);
    requireThat(t, 'Player not found');
    return t;
  };
  switch (cmd) {
    case 'help':
      return 'Player: *showfuel *showjobs *showowned *economy *me *resetpos. Admin: *say *announce *kick *gag *teleport *cash *grantitem *settime *sethealth *setvehicle *fighting.';
    case 'showfuel':
      return `Fuel: ${p.fuel.toFixed(1)} / 64`;
    case 'showjobs':
    case 'jobs':
      return w.buildings
        .filter((b) => b.recipe)
        .map((b) => `${b.name}: ${money(b.wage)} / cycle`)
        .join(' · ');
    case 'showowned':
      return (
        w.buildings
          .filter((b) => b.owner === p.id)
          .map((b) => b.name)
          .join(', ') || 'You own no property. A refreshingly simple life.'
      );
    case 'economy':
      return `${w.settings.maxBuildings} businesses, ${w.settings.maxHomes} homes. Sales tax ${(w.settings.salesTax * 100).toFixed(0)}%.`;
    case 'me':
      say(w, p.name, args.join(' '), 'emote');
      break;
    case 'resetpos':
      p.x = 0;
      p.z = 17;
      p.speed = 0;
      break;
    case 'say':
    case 'announce':
      say(w, 'Caretaker', args.join(' '));
      break;
    case 'cash':
      grant(w, target(), num(Number(args[1]) * 100, 1, 100000000, true), 'admin grant');
      break;
    case 'grantitem': {
      const t = target(),
        item = args[1],
        n = qty(Number(args[2]));
      requireThat(worldItems(w)[item] && canCarry(t, item, n, w), 'Unknown item or cargo full');
      stockAdd(t.inventory, item, n);
      break;
    }
    case 'sethealth':
      target().health = num(Number(args[1]), 1, maximumHealth(target()));
      break;
    case 'setvehicle':
      target().vehicle = num(Number(args[1]), 0, 23, true);
      break;
    case 'gag':
      target().muted = !target().muted;
      break;
    case 'kick':
      target().online = false;
      break;
    case 'teleport': {
      const t = target(),
        x = num(Number(args[1]), -250, 250),
        z = num(Number(args[2]), -250, 250);
      t.x = x;
      t.z = z;
      t.speed = 0;
      break;
    }
    case 'settime':
      w.settings.time = num(Number(args[0]), 0, 86400);
      break;
    case 'fighting':
      requireThat(['0', '1'].includes(args[0]), 'Use 0 or 1');
      w.settings.fighting = args[0] === '1';
      break;
    default:
      throw Error('Unknown command. Try *help.');
  }
  return 'Command applied.';
}
export function move(w: World, p: Player, input: Input, dt: number) {
  if (p.game === 'fishing') p.y = travelHeight(w, p.x, p.z);
  if (p.task || p.atHome || p.hitch || (p.race && w.time < p.race.start) || p.game === 'fishing')
    return;
  const licence = requiredLicence(w, p.vehicle);
  if (licence && !p.skills.includes(licence)) {
    p.speed = 0;
    return;
  }
  const condition = w.settings.vehicleMaintenance && !p.game ? vehicleCondition(p) : 100;
  const v = { ...vehicles[p.vehicle], ...w.vehicleTuning?.[p.vehicle] },
    ground = v.mode === 3 ? terrainHeight(w, p.x, p.z) : travelHeight(w, p.x, p.z),
    water = ground < w.settings.seaLevel;
  const throttle = clamp(input.throttle, -1, 1);
  const powered = (p.engine && p.fuel > 0) || v.fuel === 0;
  const surface =
    [0, 1, 4].includes(v.mode) && p.y <= ground + 1 ? roadConditions(w) : { speed: 1, grip: 1 };
  const crowSpeed = p.crowBody && p.crowClass ? crowClasses[p.crowClass].speed : 1;
  const cap =
    crowSpeed * v.speed * (input.boost ? 1.7 : 1) * surface.speed * (0.7 + condition * 0.003);
  p.speed +=
    ((powered ? throttle : 0) * v.acceleration * surface.grip - p.speed * (throttle ? 0.13 : 1.8)) *
    dt;
  p.speed = clamp(p.speed, -cap * 0.4, cap);
  p.heading +=
    intoxicatedSteer(p, w.time, clamp(input.steer, -1, 1)) *
    v.turn *
    surface.grip *
    (input.boost ? 1.15 : 1) *
    dt *
    ([0, 1, 4].includes(v.mode) && p.speed < 0 ? -1 : 1) *
    (Math.abs(p.speed) > 0.1 ? 1 : 0);
  if (v.mode === 2 || v.mode === 6)
    p.y = Math.max(
      ground,
      p.y + ((input.lift ?? 0) * 12 + (v.mode === 2 ? (Math.abs(p.speed) > 14 ? 2 : -4) : 0)) * dt,
    );
  else if ((input.lift ?? 0) > 0 && (p.inventory.jetpack ?? 0) > 0 && p.fuel > 0) {
    p.y += 12 * dt;
    p.fuel = Math.max(0, p.fuel - 0.08 * dt);
  } else p.y = Math.max(ground, p.y - 9.8 * dt);
  if (v.mode === 3) {
    p.y = Math.max(ground, w.settings.seaLevel);
    if (!water) p.speed *= Math.exp(-4 * dt);
  }
  if (v.mode === 5) p.y = Math.max(ground, w.settings.seaLevel) + 0.5;
  const nx = clamp(p.x + Math.sin(p.heading) * p.speed * dt, -250, 250),
    nz = clamp(p.z + Math.cos(p.heading) * p.speed * dt, -250, 250);
  if (
    !creatorBlocksSegment(w, p, { x: nx, z: nz, y: p.y }, p.vehicle === 5 ? 0.25 : 1.3, true) &&
    !w.buildings.some((b) =>
      buildingBlocksMovement(
        b,
        p,
        { x: nx, z: nz },
        p.y - terrainHeight(w, b.x, b.z),
        p.vehicle === 5 ? 0.25 : 1.3,
      ),
    )
  ) {
    recordTravel(w, p, Math.hypot(nx - p.x, nz - p.z));
    p.x = nx;
    p.z = nz;
    if (v.mode !== 3) p.y = Math.max(p.y, travelHeight(w, p.x, p.z));
  } else p.speed *= -0.2;
  if (water && ![2, 3, 5, 6].includes(v.mode) && p.y < w.settings.seaLevel - 1) {
    p.x = 0;
    p.z = 17;
    p.speed = 0;
  }
  if (powered)
    p.fuel = Math.max(
      0,
      p.fuel -
        (Math.abs(p.speed) / v.speed) *
          v.fuel *
          (input.boost ? 2 : 1) *
          (1 + (100 - condition) * 0.003) *
          dt,
    );
}
function kill(w: World, p: Player, comic = false, cause = 'injury', at = w.time) {
  if (!comic) p.needsGraceUntil = at + (w.settings.postDeathGraceSeconds ?? 0);
  if (!comic)
    recordLife(w, p, { kind: 'death', cause, text: `New life after ${cause}`, x: p.x, z: p.z });
  p.deaths++;
  delete p.nutrition;
  delete p.alcohol;
  p.ammo = { ...ammunition };
  p.invulnerableUntil = w.time + 3;
  p.health = 60000;
  p.hunger = 5000;
  p.thirst = 5000;
  p.speed = 0;
  p.x = 0;
  p.z = 17;
  p.y = 0.15;
  p.atHome = false;
  delete p.hitch;
  delete p.task;
  delete p.crowBody;
  delete p.crowClass;
  delete p.crowIntegrity;
  delete p.crowMark;
  delete p.crowRecallAt;
  if (comic) {
    p.vehicle = 6;
    say(
      w,
      'Parish notice',
      p.game === 'combat'
        ? `${p.name} was knocked out. Returning to the team base.`
        : `${p.name} has become an ostrich. These things happen.`,
    );
  } else {
    resetQuests(w, p);
    if (w.settings.resetScriptOnDeath) p.scriptState = {};
    queueCreatorScript(w, 'PlayerDeath', { id: p.id, cause, deaths: p.deaths });
    p.age = 18;
    if (w.settings.loseSkillsOnDeath) {
      p.skills = [];
      delete p.learning;
    }
    if (w.settings.loseInventoryOnDeath) p.inventory = {};
    if (w.settings.loseJobOnDeath) {
      delete p.job;
      p.activeUntil = 0;
    }
    const cashLoss = p.cash - Math.floor(p.cash * w.settings.deathCashRetention);
    const bankLoss = p.bank - Math.floor(p.bank * w.settings.deathBankRetention);
    p.cash -= cashLoss;
    p.bank -= bankLoss;
    log(w, 'sink', cashLoss, p.id, 'treasury', 'death cash loss');
    log(w, 'sink', bankLoss, p.id + ':bank', 'treasury', 'death savings loss');
    if (w.settings.losePropertyOnDeath) forecloseEstate(w, p);
    for (const b of w.buildings) {
      if (w.settings.loseJobOnDeath) b.employees = b.employees.filter((id) => id !== p.id);
      if (w.settings.losePropertyOnDeath && b.owner === p.id) {
        if (roomCount(b)) {
          if (b.lodging) b.lodging.open = false;
          continue;
        }
        if (!w.settings.retainEstateContents) {
          b.stock = {};
          log(w, 'sink', b.investment, b.id, 'treasury', 'estate closure');
          b.investment = 0;
        }
        releaseEstate(w, b);
      }
    }
    say(
      w,
      'Parish notice',
      `${p.name} has begun a new life. This world ${w.settings.loseSkillsOnDeath ? 'clears' : 'preserves'} qualifications and ${w.settings.losePropertyOnDeath ? 'releases ordinary property' : 'preserves property'}.`,
    );
  }
}
export function productionInterval(w: World, b: Building) {
  return (
    b.production?.seconds ??
    (((b.recipe ? recipes[b.recipe]?.seconds : 600) ?? 600) / 600) * w.settings.productionSeconds
  );
}
function cycle(w: World, b: Building, at: number) {
  const r = b.production ?? (b.recipe && recipes[b.recipe]);
  if (!r || b.construction || b.kind === 'farm') return;
  if (b.kind === 'waterworks' && !waterworksSite(w, b, b.rotation)) {
    b.efficiency = 0;
    return;
  }
  removeOwnerEmployment(w, b);
  const staff = productionStaff(w, b, at);
  const healthyHerd = tendHerd(w, b, staff.length, at);
  birthHerd(w, b, at);
  if (!healthyHerd) {
    b.efficiency = 0;
    return;
  }
  const efficiency = productionEfficiency(w, b, staff.length, at);
  b.efficiency = efficiency;
  b.progress += efficiency;
  if (b.progress < 1) return;
  const times = Math.floor(b.progress);
  b.progress -= times;
  for (let i = 0; i < times; i++) {
    if (!productionSupplied(b, r, staff.length, true)) return;
    const inputs = Object.fromEntries(
      Object.entries(r.inputs).filter(([id]) => !herdSpec(b) || !['feed', 'water'].includes(id)),
    );
    for (const [item, n] of Object.entries(inputs)) stockAdd(b.stock, item, -n);
    for (const [item, n] of Object.entries(r.outputs)) stockAdd(b.stock, item, n);
    const statement = accounts(w, b);
    statement.batches++;
    addQuantities(statement.consumed, inputs);
    addQuantities(statement.produced, r.outputs);
    for (const p of staff) {
      const tax = Math.floor(b.wage * w.settings.wageTax);
      b.investment -= b.wage;
      p.cash += b.wage - tax;
      log(w, 'transfer', b.wage - tax, b.id, p.id, 'wage');
      log(w, 'sink', tax, b.id, 'treasury', 'wage tax');
    }
  }
}
/** Exact need/health boundaries keep disconnect catch-up equivalent to live ticks.
 * Split only at room expiry and death, not at every simulated second. */
function advanceSurvival(w: World, p: Player, start: number, seconds: number) {
  let elapsed = 0;
  while (elapsed < seconds) {
    const grace = Math.max(0, (p.needsGraceUntil ?? 0) - start - elapsed);
    if (grace > 0) {
      elapsed += Math.min(grace, seconds - elapsed);
      continue;
    }
    const current = shelter({ ...w, time: start + elapsed }, p);
    if (!current) p.atHome = false;
    // Snap numerical boundaries so a near-zero duration cannot stall catch-up.
    for (const need of ['hunger', 'thirst'] as const) {
      for (const boundary of [30000, 50000])
        if (Math.abs(p[need] - boundary) < 1e-7) p[need] = boundary;
    }
    if (current) feedShelterNow(w, p, current.stock, start + elapsed);
    const hungerRate = w.settings.hungerRate * (current ? 0.8 : 1),
      thirstRate = w.settings.thirstRate * (current ? 0.8 : 1);
    const starving = p.hunger >= 50000 || p.thirst >= 50000;
    const boundary = (value: number, rate: number) =>
      value < 50000 && rate > 0 ? (50000 - value) / rate : Infinity;
    const duration = Math.min(
      seconds - elapsed,
      current ? current.until - start - elapsed : Infinity,
      current ? nextShelterMeal(w, p, current.stock, hungerRate, thirstRate) : Infinity,
      boundary(p.hunger, hungerRate),
      boundary(p.thirst, thirstRate),
      starving ? p.health / 6 : Infinity,
    );
    p.hunger = Math.min(50000, p.hunger + hungerRate * duration);
    p.thirst = Math.min(50000, p.thirst + thirstRate * duration);
    p.health = Math.max(0, Math.min(maximumHealth(p), p.health + (starving ? -6 : 2) * duration));
    elapsed += duration;
    if (p.health <= 1e-7)
      kill(w, p, false, p.thirst >= 50000 ? 'dehydration' : 'starvation', start + elapsed);
  }
  if (p.atHome && !shelter(w, p)) p.atHome = false;
}

export function advance(w: World, seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  // Fixed economic boundaries make catch-up independent of client frame rate.
  const start = w.time,
    end = start + seconds;
  for (const b of w.buildings) {
    const interval = productionInterval(w, b);
    for (let t = (Math.floor(start / interval) + 1) * interval; t <= end; t += interval)
      cycle(w, b, t);
  }
  advanceClimate(w, start, end);
  w.time = end;
  harbourSupply(w, end);
  refreshOrders(w);
  tickTownEvents(w);
  tickLottery(w);
  if (seconds <= 10) tickCreator(w);
  if (w.settings.dayLength > 0)
    w.settings.time = (w.settings.time + (seconds * 86400) / w.settings.dayLength) % 86400;
  for (const p of Object.values(w.players)) {
    if (p.crowClass && (!w.settings.crowAbilities || !w.settings.fighting)) returnCrow(w, p);
    if (p.online) {
      p.age += seconds / (600 * 365);
      p.lastSeen = end;
      delete p.inactivityProcessed;
    }
    const absenceAt = p.lastSeen + w.settings.maxOfflineDays * 86400;
    const absenceDue =
      !p.online &&
      w.settings.maxOfflineDays > 0 &&
      end >= absenceAt &&
      p.inactivityProcessed !== p.lastSeen;
    const boundary = absenceDue ? Math.max(start, absenceAt) : end;
    // Apply the absence penalty at its deadline, after earlier loan payments and
    // survival, then simulate the rest of the absence in the new life.
    advanceLoans(w, p, start, boundary);
    advanceSurvival(w, p, start, boundary - start);
    if (absenceDue) {
      p.inactivityProcessed = p.lastSeen;
      say(w, 'Parish notice', `${p.name} exceeded this world's offline absence limit.`);
      kill(w, p, false, 'offline absence limit', boundary);
      advanceLoans(w, p, boundary, end);
      advanceSurvival(w, p, boundary, end - boundary);
    }
    if (p.online) {
      p.energy = Math.min(65000, p.energy + 3000 * seconds);
      if (!p.health || p.age >= w.settings.maxAge)
        kill(w, p, false, p.age >= w.settings.maxAge ? 'old age' : 'injury');
    }
    if (p.learning && p.learning.end <= end) {
      p.skills.push(p.learning.skill);
      questEvent(w, p, 'study', p.learning.skill);
      queueCreatorScript(w, 'SkillLearned', { id: p.id, skill: p.learning.skill });
      recordLife(w, p, { kind: 'qualification', text: `Qualified as ${p.learning.skill}` });
      say(w, 'School', `${p.name} qualified as ${p.learning.skill}.`);
      delete p.learning;
    }
    if (p.task && p.task.end <= end) {
      const t = p.task;
      if (t.kind === 'gather') {
        if (finishGather(p, w)) {
          questEvent(w, p, 'gather', t.resource ?? '', t.item, t.amount);
          if (p.online) creatorEvent(w, 'task', p, t.resource ?? '');
        }
        continue;
      }
      delete p.task;
      if (t.kind === 'harvest') finishHarvest(w, p, t.building!, t.plot!);
      else if (t.kind === 'labour') {
        grant(w, p, 4500, 'labour task');
        p.kudos++;
      } else
        stockAdd(
          p.inventory,
          t.kind === 'logging' ? 'logs' : t.kind === 'quarrying' ? 'stone' : 'tools',
          t.kind === 'craft' ? 1 : 3,
        );
      if (p.online) creatorEvent(w, 'task', p, t.building ?? t.resource ?? '');
    }
    if (p.hitch) {
      const driver = w.players[p.hitch];
      if (driver) {
        p.x = driver.x;
        p.z = driver.z;
        p.y = driver.y + 2;
      } else delete p.hitch;
    }
    if (p.race && end >= p.race.start) {
      const target = checkpoints[p.race.next % checkpoints.length];
      if (distance(p, target) < 10) {
        p.race.next++;
        if (p.race.next > checkpoints.length) {
          const lap = end - p.race.start;
          w.raceBest[p.name] = Math.min(w.raceBest[p.name] ?? Infinity, lap);
          p.kudos += 5;
          delete p.race;
          delete p.game;
          say(w, 'Race marshal', `${p.name} finished in ${lap.toFixed(1)} seconds.`);
        }
      }
    }
    if (p.game === 'fishing' && p.fishUntil !== undefined && end > p.fishUntil) {
      if (w.settings.fishingMode === 2 && canCarry(p, 'fish', 1, w))
        stockAdd(p.inventory, 'fish', 1);
      p.fishAt = end + (w.settings.fishingMode === 5 ? 20 : 90);
      p.fishUntil = p.fishAt + 8;
    }
  }
  // Resolve residents once; avoid scanning every resident for every cottage each tick.
  const occupied = new Set(
    Object.values(w.players)
      .filter((p) => p.atHome)
      .map((p) => shelter(w, p)?.b.id),
  );
  for (const b of w.buildings) {
    for (const plot of b.plots ?? [])
      if (plot.harvest) {
        const task = w.players[plot.harvest.player]?.task;
        if (task?.kind !== 'harvest' || task.building !== b.id) delete plot.harvest;
      }
    b.smoking =
      !b.construction &&
      (b.kind === 'home' || roomCount(b)
        ? occupied.has(b.id)
        : b.employees.some((id) => {
            const worker = w.players[id];
            return (
              worker?.online &&
              worker.job === b.id &&
              worker.activeUntil >= end &&
              distance(worker, b) < 18
            );
          }));
    if (!b.government) {
      const owner = b.owner && w.players[b.owner];
      if (!owner || !owner.online) continue;
      const skill = b.recipe && recipes[b.recipe].skill;
      const factor = !owner ? 100 : skill && !owner.skills.includes(skill) ? 10 : 1;
      b.condition = Math.max(
        b.lodging ? 1 : 0,
        b.condition - (seconds * 100 * factor) / (160 * 365 * 600),
      );
    }
  }
  w.buildings = w.buildings.filter((b) => b.condition > 0);
  const ball = w.ball,
    dt = Math.min(seconds, 1);
  ball.x += ball.vx * dt;
  ball.z += ball.vz * dt;
  ball.vx *= Math.exp(-1.1 * dt);
  ball.vz *= Math.exp(-1.1 * dt);
  if ((ball.x < 62 || ball.x > 118) && Math.abs(ball.z - 45) < 9) {
    const team = ball.x > 118 ? 0 : 1;
    w.scores[team]++;
    for (const p of Object.values(w.players).filter(
      (p) => p.game === 'hornball' && p.team === team,
    ))
      p.kudos += 3;
    say(w, 'Hornball', `Goal! Rust ${w.scores[0]} : ${w.scores[1]} Moss`);
    Object.assign(ball, { x: 90, z: 45, vx: 0, vz: 0 });
  } else if (ball.x < 60 || ball.x > 120 || ball.z < 20 || ball.z > 70)
    Object.assign(ball, { x: 90, z: 45, vx: 0, vz: 0 });
  tickCombat(w, seconds, (p) => kill(w, p, true));
  if (w.kricket.due && end > w.kricket.due + 1) {
    const batter = w.kricket.batter && w.players[w.kricket.batter];
    if (batter) kill(w, batter, true);
    w.kricket.due = 0;
  }
  const tier0 = ['farm', 'mill', 'bakery', 'sawmill', 'quarry', 'mason'];
  const tier1 = ['mine', 'forge', 'brewery', 'workshop', 'refinery'];
  if (tier0.every((kind) => w.buildings.some((b) => b.kind === kind && !b.construction)))
    w.tier = Math.max(w.tier, 1);
  if (tier1.every((kind) => w.buildings.some((b) => b.kind === kind && !b.construction)))
    w.tier = Math.max(w.tier, 2);
}
