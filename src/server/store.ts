import { normalizeTradingOffers } from '../shared/trading.ts';
import { migrateEmploymentPolicy } from '../shared/employment-policy.ts';
import { migrateProcurement } from '../shared/procurement.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import { migrateEstates } from '../shared/property.ts';
import { migrateEconomy } from '../shared/economy.ts';
import { migrateTown } from '../shared/town.ts';
import { normalizeTowns } from '../shared/civics.ts';
import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { defaults, buildings } from '../shared/catalog.ts';
import { pendingPublicMessages } from '../shared/messages.ts';
import type { CaretakerLogPage } from '../shared/caretaker.ts';
import type { World } from '../shared/types.ts';
export class Store {
  db: DatabaseSync;
  private transactionDepth = 0;
  constructor(public path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS worlds (id TEXT PRIMARY KEY,state TEXT NOT NULL,saved REAL NOT NULL);
 CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY,name TEXT UNIQUE COLLATE NOCASE NOT NULL,token_hash TEXT UNIQUE NOT NULL,state TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS ledger (world TEXT NOT NULL,id INTEGER NOT NULL,time REAL NOT NULL,kind TEXT NOT NULL,amount INTEGER NOT NULL,sender TEXT NOT NULL,recipient TEXT NOT NULL,reason TEXT NOT NULL,PRIMARY KEY(world,id));`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS public_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT, world TEXT NOT NULL, message_id INTEGER NOT NULL,
      time REAL NOT NULL, name TEXT NOT NULL, text TEXT NOT NULL, kind TEXT NOT NULL,
      npc INTEGER NOT NULL, UNIQUE(world,message_id));
      CREATE INDEX IF NOT EXISTS public_messages_world_page ON public_messages(world,id);
      CREATE INDEX IF NOT EXISTS public_messages_notice_page ON public_messages(world,kind,id);`);
    const version = this.db.prepare("SELECT value FROM meta WHERE key='schema'").get();
    if (version && !['1', '2'].includes(String(version.value)))
      throw Error('Unsupported database schema');
    this.db.prepare("INSERT OR IGNORE INTO meta VALUES ('schema','1')").run();
    if (
      !this.db
        .prepare('PRAGMA table_info(accounts)')
        .all()
        .some((c) => c.name === 'name_key')
    ) {
      this.transaction(() => {
        this.db.exec('ALTER TABLE accounts ADD COLUMN name_key TEXT');
        for (const row of this.db.prepare('SELECT id,name FROM accounts').all())
          this.db
            .prepare('UPDATE accounts SET name_key=? WHERE id=?')
            .run(String(row.name).normalize('NFKC').toLocaleLowerCase('en-US'), row.id);
        this.db.exec('CREATE UNIQUE INDEX account_name_key ON accounts(name_key)');
      });
    }
    this.db.prepare("UPDATE meta SET value='2' WHERE key='schema'").run();
    if (
      !this.db
        .prepare('PRAGMA table_info(ledger)')
        .all()
        .some((c) => c.name === 'details')
    )
      this.db.exec('ALTER TABLE ledger ADD COLUMN details TEXT');
  }
  loadWorlds() {
    return this.db
      .prepare('SELECT state,saved FROM worlds')
      .all()
      .map((row) => {
        const world = JSON.parse(String(row.state)) as World;
        pendingPublicMessages(world);
        // Older saves predate configurable maps. Only the public starter parish
        // opens onto the full countryside; every other world keeps its old bounds.
        if (!Number.isFinite(world.settings.mapSize))
          world.settings.mapSize =
            world.id === 'puddlewick' && world.owner === 'server' && world.template === 'economy'
              ? defaults.mapSize
              : 500;
        world.settings = { ...defaults, ...world.settings };
        migrateTown(world);
        normalizeTowns(world);
        migrateEconomy(world);
        migrateEmploymentPolicy(world);
        migrateEstates(world);
        migrateProcurement(world);
        for (const b of world.buildings)
          if (
            b.government &&
            b.id !== 'parish-government-stores' &&
            (!b.owner || b.owner === 'treasury') &&
            ['market', 'starport'].includes(b.kind)
          )
            for (const key of [
              'potatoes',
              'coffee',
              'gravel',
              'dirt',
              'compost',
              'bricks',
              'furniture',
              'wine',
              'meals',
              'teaBlend',
              'roastCoffee',
            ]) {
              b.buy[key] ??= buildings[b.kind].buy[key];
              b.sell[key] ??= buildings[b.kind].sell[key];
              b.stock[key] ??= 0;
            }
        for (const b of world.buildings) normalizeTradingOffers(b);
        return { world, saved: Number(row.saved) };
      });
  }
  transaction<T>(fn: () => T): T {
    const level = this.transactionDepth++,
      savepoint = `nested_${level}`;
    try {
      this.db.exec(level ? `SAVEPOINT ${savepoint}` : 'BEGIN IMMEDIATE');
      try {
        const out = fn();
        this.db.exec(level ? `RELEASE ${savepoint}` : 'COMMIT');
        return out;
      } catch (e) {
        if (level) {
          this.db.exec(`ROLLBACK TO ${savepoint}`);
          this.db.exec(`RELEASE ${savepoint}`);
        } else this.db.exec('ROLLBACK');
        throw e;
      }
    } finally {
      this.transactionDepth--;
    }
  }
  saveWorld(w: World, now = Date.now() / 1000, withinTransaction?: () => void) {
    const pending = pendingPublicMessages(w);
    this.transaction(() => {
      withinTransaction?.();
      const message = this.db.prepare(
        `INSERT OR IGNORE INTO public_messages (world,message_id,time,name,text,kind,npc) VALUES (?,?,?,?,?,?,?)`,
      );
      const lastMessage = Number(
        this.db
          .prepare('SELECT COALESCE(MAX(message_id),0) AS id FROM public_messages WHERE world=?')
          .get(w.id)!.id,
      );
      for (const m of new Set([...pending, ...w.messages]))
        if (!m.to && m.id! > lastMessage)
          message.run(w.id, m.id!, m.time, m.name, m.text, m.kind, Number(!!m.npc));
      const insert = this.db.prepare(
        'INSERT OR IGNORE INTO ledger (world,id,time,kind,amount,sender,recipient,reason,details) VALUES (?,?,?,?,?,?,?,?,?)',
      );
      for (const l of w.ledger)
        insert.run(
          w.id,
          l.id,
          l.time,
          l.kind,
          l.amount,
          l.from,
          l.to,
          l.reason,
          l.details ? JSON.stringify(l.details) : null,
        );
      this.db
        .prepare('INSERT OR REPLACE INTO worlds VALUES (?,?,?)')
        .run(w.id, JSON.stringify({ ...w, ledger: w.ledger.slice(-100) }), now);
    });
    // An enclosing transaction may still roll back this save. Keep the buffer
    // until a top-level save commits; duplicate rows are skipped on retry.
    if (this.transactionDepth === 0) pending.length = 0;
    w.ledger = w.ledger.slice(-100);
  }
  publicMessages(
    world: string,
    notices = false,
    before = Number.MAX_SAFE_INTEGER,
  ): CaretakerLogPage {
    const rows = this.db
      .prepare(
        `SELECT id,time,name,text,kind,npc FROM public_messages
       WHERE world=? AND id<? ${notices ? "AND kind='system'" : ''}
       ORDER BY id DESC LIMIT 101`,
      )
      .all(world, before);
    const entries = rows.slice(0, 100).map((r) => ({
      id: Number(r.id),
      time: Number(r.time),
      name: String(r.name),
      text: String(r.text),
      kind: String(r.kind),
      npc: !!r.npc,
    }));
    return { entries, ...(rows.length > 100 ? { before: entries.at(-1)!.id } : {}) };
  }
  async backup(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    await backup(this.db, path);
  }
  close() {
    this.db.close();
  }
}
