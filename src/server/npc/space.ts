// SPDX-License-Identifier: GPL-3.0-or-later
import type { Account, Universe } from '../universe.ts';
import type { World, Player, Action } from '../../shared/types.ts';
import type { FarmerChoice } from './farmer.ts';
import { galaxy } from '../../shared/catalog.ts';
import { shipStats, spaceGoods, stationPrice, jumpQuote } from '../../shared/galaxy.ts';
import { operation } from './player-operations.ts';
import { distance, log } from '../../shared/simulation.ts';
export const spaceOperations = new Set([
  'exchange',
  'takeoff',
  'land',
  'jump',
  'ship',
  'spaceTrade',
  'upgrade',
  'courier',
  'survey',
  'rescue',
]);
export const systemFor = (world: string) =>
  world === 'brass' ? 'brindle' : world === 'meadow' ? 'farthing' : 'hearth';
export function spaceAction(universe: Universe, a: Account, action: Action) {
  switch (action.type) {
    case 'jump':
      universe.travel(a, String(action.system));
      break;
    case 'ship':
      universe.buyShip(a, String(action.ship));
      break;
    case 'spaceTrade':
      if (typeof action.buy !== 'boolean') throw Error('Choose buy or sell');
      universe.trade(a, String(action.item), Number(action.quantity), action.buy);
      break;
    case 'upgrade':
      universe.upgrade(a, String(action.kind));
      break;
    case 'courier':
      universe.courier(a, String(action.operation));
      break;
    case 'survey':
      universe.survey(a);
      break;
    case 'rescue':
      universe.rescue(a);
      break;
    default:
      throw Error('Unknown space operation');
  }
}
export function exchange(w: World, p: Player, a: Account, n: number) {
  if (!w.buildings.some((b) => b.kind === 'starport' && distance(p, b) < 18))
    throw Error('Visit the spaceport');
  const day = Math.floor(w.time / 86400),
    old = a.exchanged[w.id];
  const record = old?.day === day ? { ...old } : { day, amount: 0 };
  if (!Number.isSafeInteger(n) || n <= 0 || record.amount + n > w.settings.exchangeCap)
    throw Error('Daily exchange limit reached');
  const cost = n * w.settings.exchangeRate * 100;
  if (p.cash < cost) throw Error('Not enough local cash');
  p.cash -= cost;
  a.credits += n;
  record.amount += n;
  a.exchanged[w.id] = record;
  log(w, 'sink', cost, p.id, 'universe', 'credit conversion');
}
export function spaceChoices(
  a: Account,
  worlds: Map<string, World>,
  universe: Universe,
): FarmerChoice[] {
  const choices: FarmerChoice[] = [];
  const add = (
    description: string,
    op: Parameters<typeof operation>[0],
    params: Parameters<typeof operation>[1] = {},
  ) =>
    choices.push({
      id: `space_${choices.length}`,
      description,
      plan: [operation(op, params)],
      reconsiderSeconds: 30,
    });
  if (a.transit)
    return [
      {
        id: 'space_wait',
        description: `Wait for arrival at ${a.transit.destination}; no new travel during transit.`,
        plan: [
          {
            kind: 'wait',
            seconds: Math.max(1, Math.min(600, Math.ceil(a.transit.arrives - Date.now() / 1000))),
          },
        ],
        reconsiderSeconds: 30,
      },
    ];
  const stats = shipStats(a),
    from = galaxy.systems.find((s) => s.id === a.system)!;
  for (const w of worlds.values())
    if (systemFor(w.id) === a.system && (!w.settings.locked || w.owner === a.id))
      add(`Land in ${w.name}; local money and skills belong to each world separately.`, 'land', {
        world: w.id,
      });
  if (!a.visited?.includes(a.system))
    add('Survey this system once for 15 credits and possible frontier relic.', 'survey');
  for (const s of galaxy.systems) {
    const d = Math.hypot(s.x - from.x, s.y - from.y);
    if (s.id !== a.system && d <= stats.range && a.credits >= jumpQuote(a, a.system, s.id).cost)
      add(
        `Jump to ${s.name} for ${jumpQuote(a, a.system, s.id).cost} credits and ${jumpQuote(a, a.system, s.id).seconds} seconds; ${a.mission?.destination === s.id ? 'current delivery destination' : ''}`,
        'jump',
        { system: s.id },
      );
  }
  if (!a.mission)
    add('Accept an ordinary courier contract; reserve ten hold spaces and fuel.', 'courier', {
      operation: 'accept',
    });
  else {
    if (a.system === a.mission.destination)
      add(`Deliver my courier cargo for ${a.mission.reward} credits.`, 'courier', {
        operation: 'deliver',
      });
    add('Cancel my courier contract without reward.', 'courier', { operation: 'cancel' });
  }
  for (const item of spaceGoods) {
    const price = stationPrice(a.system, item),
      stock = universe.market(a.system).stock[item];
    const free =
      stats.capacity -
      Object.values(a.cargo).reduce((a, b) => a + b, 0) -
      (a.mission?.quantity ?? 0);
    const n = Math.min(5, stock, free, Math.floor(Math.max(0, a.credits - 10) / price.buy));
    if (n > 0)
      add(
        `Buy ${n} ${item} for ${n * price.buy} credits; compare other stations before trading.`,
        'spaceTrade',
        { item, quantity: n, buy: true },
      );
    const sell = Math.min(a.cargo[item] ?? 0, 400 - stock, 100);
    if (sell > 0)
      add(`Sell ${sell} ${item} for ${sell * price.sell} credits.`, 'spaceTrade', {
        item,
        quantity: sell,
        buy: false,
      });
  }
  for (const kind of ['drive', 'hold']) {
    const level = a.upgrades?.[kind] ?? 0,
      cost = (level + 1) * (kind === 'drive' ? 80 : 60);
    if (level < 3 && a.credits >= cost)
      add(`Upgrade ${kind} for ${cost} credits.`, 'upgrade', { kind });
  }
  for (const ship of galaxy.ships)
    if (
      ship.id !== a.ship &&
      (a.hangar?.includes(ship.id) || a.credits >= ship.price) &&
      (ship.id !== 'alien' || (a.discoveries?.length ?? 0) >= 3)
    )
      add(
        `Select or buy ${ship.name}, listed price ${ship.price} credits. ${ship.role}; range ${ship.range}, cargo ${ship.capacity}, base fuel ${ship.fuelPerPc} cr/pc, cruise ${ship.secondsPerPc} s/pc, shielding ${Math.round(ship.shield * 100)}%.`,
        'ship',
        {
          ship: ship.id,
        },
      );
  if (
    a.system !== 'hearth' &&
    !a.mission &&
    !Object.values(a.cargo).some((n) => n > 0) &&
    a.credits < 10
  )
    add('Request ordinary stranded-pilot rescue to Hearth.', 'rescue');
  return choices.length
    ? choices
    : [
        {
          id: 'space_rest',
          description: 'Wait and reassess my available route.',
          plan: [{ kind: 'wait', seconds: 60 }],
          reconsiderSeconds: 60,
        },
      ];
}
