// SPDX-License-Identifier: GPL-3.0-or-later
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { shipStats, stationPrice, spaceGoods } from '../shared/galaxy.ts';
import { galaxy } from '../shared/catalog.ts';
import type { Stock } from '../shared/types.ts';
import type { Store } from './store.ts';
export interface Account {
  id: string;
  name: string;
  credits: number;
  ship: string;
  system: string;
  cargo: Stock;
  hangar?: string[];
  upgrades?: Record<string, number>;
  visited?: string[];
  discoveries?: string[];
  transit?: { destination: string; arrives: number };
  mission?: { origin: string; destination: string; reward: number; quantity: number };
  exchanged: Record<string, { day: number; amount: number }>;
}
export const tokenHash = (s: string) => createHash('sha256').update(s).digest('hex');
export class Universe {
  constructor(private store: Store) {}
  register(name: string) {
    name = name.normalize('NFKC').trim();
    const nameKey = name.toLocaleLowerCase('en-US');
    if (this.store.db.prepare('SELECT id FROM accounts WHERE name_key=?').get(nameKey))
      throw Error('That name is taken. Sign in to return.');
    if (!/^[\p{L}\p{N} _-]{2,24}$/u.test(name))
      throw Error('Use 2–24 letters, numbers, spaces, hyphens or underscores');
    const id = randomUUID(),
      token = randomBytes(32).toString('base64url');
    const a: Account = {
      id,
      name,
      credits: 50,
      ship: 'shuttle',
      system: 'hearth',
      cargo: {},
      exchanged: {},
    };
    try {
      this.store.db
        .prepare('INSERT INTO accounts (id,name,token_hash,state,name_key) VALUES (?,?,?,?,?)')
        .run(id, name, tokenHash(token), JSON.stringify(a), nameKey);
    } catch {
      throw Error('That name is taken. Use your saved pilot key to return.');
    }
    return { account: a, token };
  }
  authenticate(token: string) {
    if (typeof token !== 'string' || token.length > 100) return undefined;
    const r = this.store.db
      .prepare('SELECT state FROM accounts WHERE token_hash=?')
      .get(tokenHash(token));
    if (!r) return undefined;
    const a = JSON.parse(String(r.state)) as Account;
    this.arrive(a);
    return a;
  }
  save(a: Account) {
    this.store.db.prepare('UPDATE accounts SET state=? WHERE id=?').run(JSON.stringify(a), a.id);
  }
  /** Write copies; failed SQL never leaves the connected pilot ahead of durable state. */
  private change(a: Account, fn: (draft: Account) => void, transit = false) {
    if (a.transit && !transit) throw Error('Ship is in transit; wait for arrival');
    const draft = structuredClone(a);
    this.store.transaction(() => {
      fn(draft);
      this.save(draft);
    });
    for (const key of Object.keys(a)) delete (a as unknown as Record<string, unknown>)[key];
    Object.assign(a, draft);
  }
  market(system: string) {
    if (!galaxy.systems.some((s) => s.id === system)) throw Error('Unknown station');
    const row = this.store.db.prepare('SELECT value FROM meta WHERE key=?').get('market:' + system);
    const now = Math.floor(Date.now() / 3600000);
    const state = row
      ? (JSON.parse(String(row.value)) as { hour: number; stock: Stock })
      : { hour: now, stock: Object.fromEntries(spaceGoods.map((i) => [i, 200])) };
    if (now > state.hour) {
      for (const item of spaceGoods)
        state.stock[item] = Math.min(200, state.stock[item] + (now - state.hour) * 20);
      state.hour = now;
    }
    return state;
  }
  travel(a: Account, target: string) {
    this.change(a, (d) => {
      const from = galaxy.systems.find((s) => s.id === d.system),
        to = galaxy.systems.find((s) => s.id === target);
      if (!from || !to || from === to) throw Error('Choose another star system');
      const distance = Math.hypot(to.x - from.x, to.y - from.y);
      if (distance > shipStats(d).range) throw Error('Outside your ship’s jump range');
      const cost = Math.ceil(distance);
      if (d.credits < cost) throw Error('Not enough credits for jump fuel');
      d.credits -= cost;
      d.transit = { destination: to.id, arrives: Date.now() / 1000 + 6 + cost * 2 };
    });
  }
  arrive(a: Account, now = Date.now() / 1000) {
    if (!a.transit || a.transit.arrives > now) return false;
    this.change(
      a,
      (d) => {
        d.system = d.transit!.destination;
        delete d.transit;
      },
      true,
    );
    return true;
  }
  buyShip(a: Account, id: string) {
    this.change(a, (d) => {
      const ship = galaxy.ships.find((s) => s.id === id);
      if (!ship || id === d.ship) throw Error('Choose another ship');
      const owned = d.hangar ?? [d.ship];
      const price = owned.includes(id) ? 0 : ship.price;
      if (d.credits < price) throw Error('Insufficient credits');
      if (id === 'alien' && !owned.includes(id) && (d.discoveries?.length ?? 0) < 3)
        throw Error('Find three alien relics by surveying frontier systems');
      if (
        Object.values(d.cargo).reduce((s, n) => s + n, 0) + (d.mission?.quantity ?? 0) >
        shipStats({ ...d, ship: id }).capacity
      )
        throw Error('Empty your cargo before changing ships');
      d.credits -= price;
      d.hangar = [...new Set([...owned, id])];
      d.ship = id;
    });
  }
  upgrade(a: Account, kind: string) {
    this.change(a, (d) => {
      if (!['drive', 'hold'].includes(kind)) throw Error('Unknown upgrade');
      const level = d.upgrades?.[kind] ?? 0;
      if (level >= 3) throw Error('Already fully upgraded');
      const cost = (level + 1) * (kind === 'drive' ? 80 : 60);
      if (d.credits < cost) throw Error('Insufficient credits');
      d.credits -= cost;
      d.upgrades ??= {};
      d.upgrades[kind] = level + 1;
    });
  }
  trade(a: Account, item: string, n: number, buy: boolean) {
    this.change(a, (d) => {
      if (!spaceGoods.includes(item) || !Number.isSafeInteger(n) || n <= 0 || n > 100)
        throw Error('Invalid space trade');
      const station = this.market(d.system),
        price = stationPrice(d.system, item),
        total = n * (buy ? price.buy : price.sell);
      if (buy) {
        if (station.stock[item] < n) throw Error('Station is out of stock');
        if (
          d.credits < total ||
          Object.values(d.cargo).reduce((s, n) => s + n, 0) + n + (d.mission?.quantity ?? 0) >
            shipStats(d).capacity
        )
          throw Error('Insufficient credits or cargo space');
      } else if ((d.cargo[item] ?? 0) < n) throw Error('Not enough cargo');
      if (!buy && station.stock[item] + n > 400) throw Error('Station warehouse is full');
      d.credits += buy ? -total : total;
      d.cargo[item] = (d.cargo[item] ?? 0) + (buy ? n : -n);
      station.stock[item] += buy ? -n : n;
      this.store.db
        .prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')
        .run('market:' + d.system, JSON.stringify(station));
    });
  }
  courier(a: Account, operation: string) {
    this.change(a, (d) => {
      if (operation === 'accept') {
        if (d.mission) throw Error('Finish your existing contract');
        if (Object.values(d.cargo).reduce((s, n) => s + n, 0) + 10 > shipStats(d).capacity)
          throw Error('Reserve ten cargo spaces');
        const from = galaxy.systems.find((s) => s.id === d.system)!;
        const options = galaxy.systems.filter(
          (s) => s.id !== d.system && Math.hypot(s.x - from.x, s.y - from.y) <= shipStats(d).range,
        );
        const to = options[Math.floor((d.visited?.length ?? 0) % options.length)];
        if (!to) throw Error('Upgrade your drive first');
        const fuel = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y));
        if (d.credits < fuel) throw Error('Keep enough credits for delivery fuel');
        d.mission = { origin: d.system, destination: to.id, quantity: 10, reward: 20 + fuel * 3 };
      } else if (operation === 'deliver') {
        if (!d.mission || d.system !== d.mission.destination)
          throw Error('Deliver at your contract destination');
        d.credits += d.mission.reward;
        delete d.mission;
      } else if (operation === 'cancel') {
        if (!d.mission) throw Error('No active contract');
        delete d.mission;
      } else throw Error('Unknown contract action');
    });
  }
  survey(a: Account) {
    this.change(a, (d) => {
      if (d.visited?.includes(d.system)) throw Error('This system is already surveyed');
      d.visited ??= [];
      d.visited.push(d.system);
      d.credits += 15;
      if (['lantern', 'rime', 'vessel'].includes(d.system)) {
        d.discoveries ??= [];
        d.discoveries.push(d.system);
      }
    });
  }
  rescue(a: Account) {
    this.change(a, (d) => {
      if (
        d.system === 'hearth' ||
        d.mission ||
        Object.values(d.cargo).some((n) => n > 0) ||
        d.credits >= 10
      )
        throw Error('Rescue is for stranded pilots with empty holds and under 10cr');
      d.system = 'hearth';
    });
  }
}
