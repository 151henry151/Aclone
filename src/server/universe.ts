// SPDX-License-Identifier: GPL-3.0-or-later
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { galaxy, items } from '../shared/catalog.ts';
import type { Stock } from '../shared/types.ts';
import type { Store } from './store.ts';
export interface Account {
  id: string;
  name: string;
  credits: number;
  ship: string;
  system: string;
  cargo: Stock;
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
    return r ? (JSON.parse(String(r.state)) as Account) : undefined;
  }
  save(a: Account) {
    this.store.db.prepare('UPDATE accounts SET state=? WHERE id=?').run(JSON.stringify(a), a.id);
  }
  travel(a: Account, target: string) {
    const from = galaxy.systems.find((s) => s.id === a.system),
      to = galaxy.systems.find((s) => s.id === target),
      ship = galaxy.ships.find((s) => s.id === a.ship)!;
    if (!from || !to || to === from) throw Error('Choose another star system');
    const d = Math.hypot(to.x - from.x, to.y - from.y);
    if (d > ship.range) throw Error('Outside your ship’s jump range');
    const cost = Math.ceil(d);
    if (a.credits < cost) throw Error('Not enough credits for jump fuel');
    a.credits -= cost;
    a.system = to.id;
    this.save(a);
  }
  buyShip(a: Account, id: string) {
    const ship = galaxy.ships.find((s) => s.id === id);
    if (!ship || ship.id === a.ship || a.credits < ship.price)
      throw Error('Ship unavailable or insufficient credits');
    if (Object.values(a.cargo).reduce((s, n) => s + n, 0) > ship.capacity)
      throw Error('Empty your cargo before downgrading');
    a.credits -= ship.price;
    a.ship = id;
    this.save(a);
  }
  trade(a: Account, item: string, n: number, buy: boolean) {
    if (
      !['electronics', 'rareEarth', 'shipParts'].includes(item) ||
      !Number.isSafeInteger(n) ||
      n <= 0 ||
      n > 100
    )
      throw Error('Invalid space trade');
    const index = galaxy.systems.findIndex((s) => s.id === a.system);
    const price = Math.ceil((items[item].price / 1000) * (1 + index * 0.4));
    const total = n * (buy ? price : Math.max(1, price - 1));
    if (buy) {
      const ship = galaxy.ships.find((s) => s.id === a.ship)!;
      if (
        a.credits < total ||
        Object.values(a.cargo).reduce((s, n) => s + n, 0) + n > ship.capacity
      )
        throw Error('Insufficient credits or cargo space');
    } else if ((a.cargo[item] ?? 0) < n) throw Error('Not enough cargo');
    a.credits += buy ? -total : total;
    a.cargo[item] = (a.cargo[item] ?? 0) + (buy ? n : -n);
    this.save(a);
  }
}
