import { changeResourceRecovery } from '../shared/resources';
import { integrateMeat } from '../shared/meat-migration';
import { alignLegacyCargoMoorings } from '../shared/boathouse';
import { normalizeTradingOffers } from '../shared/trading.ts';
import { migrateEmploymentPolicy } from '../shared/employment-policy.ts';
import { migrateProcurement } from '../shared/procurement.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import { migrateEstates } from '../shared/property.ts';
import { migrateEconomy } from '../shared/economy.ts';
import { migrateTown } from '../shared/town.ts';
import { normalizeTowns } from '../shared/civics.ts';
import { DatabaseSync, backup } from 'node:sqlite';
import { Worker } from 'node:worker_threads';
import {
  writeWorldCheckpoint,
  durablePragmas,
  type WorldCheckpoint,
  type CheckpointRow,
} from './checkpoint-data.ts';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { defaults, buildings } from '../shared/catalog.ts';
import { pendingPublicMessages } from '../shared/messages.ts';
import type { CaretakerLogPage } from '../shared/caretaker.ts';
import type { World } from '../shared/types.ts';
export class Store {
  db: DatabaseSync;
  private writer?: Worker;
  private pendingCheckpoint?: Promise<void>;
  get checkpointBusy() {
    return !!this.pendingCheckpoint;
  }
  async ready() {
    while (this.pendingCheckpoint) await this.pendingCheckpoint.catch(() => {});
  }
  private transactionDepth = 0;
  private commitActions: (() => void)[][] = [];
  constructor(public path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; ${durablePragmas}
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
        const legacyBuyFloor = world.settings.minimumBuyPrice === undefined;
        const oldRecovery = world.settings.resourceRecoveryMultiplier === undefined;
        world.settings = { ...defaults, ...world.settings };
        if (oldRecovery) {
          // Preserve the units already recovered at the former pace on upgrade.
          world.settings.resourceRecoveryMultiplier = 1;
          changeResourceRecovery(world, defaults.resourceRecoveryMultiplier!);
        }
        migrateTown(world);
        normalizeTowns(world);
        migrateEconomy(world);
        integrateMeat(world);
        alignLegacyCargoMoorings(world);
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
        for (const b of world.buildings) normalizeTradingOffers(b, legacyBuyFloor);
        return { world, saved: Number(row.saved) };
      });
  }
  transaction<T>(fn: () => T): T {
    if (this.checkpointBusy)
      throw Error('Await the periodic checkpoint before starting a database transaction');
    const level = this.transactionDepth++,
      savepoint = `nested_${level}`;
    const committed: (() => void)[] = [];
    this.commitActions.push(committed);
    try {
      this.db.exec(level ? `SAVEPOINT ${savepoint}` : 'BEGIN IMMEDIATE');
      let out: T;
      try {
        out = fn();
        this.db.exec(level ? `RELEASE ${savepoint}` : 'COMMIT');
      } catch (e) {
        if (level) {
          this.db.exec(`ROLLBACK TO ${savepoint}`);
          this.db.exec(`RELEASE ${savepoint}`);
        } else this.db.exec('ROLLBACK');
        throw e;
      }
      if (level) this.commitActions[level - 1].push(...committed);
      else for (const cleanup of committed) cleanup();
      return out;
    } finally {
      this.commitActions.pop();
      this.transactionDepth--;
    }
  }
  private prepareCheckpoint(w: World, now: number) {
    const pending = pendingPublicMessages(w);
    const record: WorldCheckpoint = {
      id: w.id,
      saved: now,
      state: JSON.stringify({ ...w, ledger: w.ledger.slice(-100) }),
      messages: [...new Set([...pending, ...w.messages])]
        .filter((m) => !m.to)
        .map((m) => [w.id, m.id!, m.time, m.name, m.text, m.kind, Number(!!m.npc)]),
      ledger: w.ledger.map((l) => [
        w.id,
        l.id,
        l.time,
        l.kind,
        l.amount,
        l.from,
        l.to,
        l.reason,
        l.details ? JSON.stringify(l.details) : null,
      ]),
    };
    const savedMessages = new Set(pending),
      savedLedger = new Set(w.ledger.map((l) => l.id)),
      retainedLedger = new Set(w.ledger.slice(-100).map((l) => l.id));
    return {
      record,
      committed: () => {
        const remaining = pending.filter((m) => !savedMessages.has(m));
        pending.length = 0;
        pending.push(...remaining);
        w.ledger = w.ledger.filter((l) => !savedLedger.has(l.id) || retainedLedger.has(l.id));
      },
    };
  }
  saveWorld(w: World, now = Date.now() / 1000, withinTransaction?: () => void) {
    pendingPublicMessages(w);
    this.transaction(() => {
      withinTransaction?.();
      const snapshot = this.prepareCheckpoint(w, now);
      writeWorldCheckpoint(this.db, snapshot.record);
      this.commitActions.at(-1)!.push(snapshot.committed);
    });
  }
  /** One frozen batch at a time. Callers must await ready() before another
   * database operation; movement and in-memory simulation need not wait. */
  checkpoint(worlds: Iterable<World>, playtime: CheckpointRow[] = []): Promise<void> {
    if (this.checkpointBusy || this.transactionDepth)
      return Promise.reject(Error('Checkpoint already busy'));
    const snapshots = [...worlds].map((w) => this.prepareCheckpoint(w, Date.now() / 1000));
    if (this.path === ':memory:')
      return Promise.reject(Error('Background checkpoints require a file-backed database'));
    if (!this.writer) {
      const worker = new Worker(new URL('./checkpoint-worker.mjs', import.meta.url), {
        workerData: { path: this.path },
        execArgv: [],
      });
      worker.on('error', () => {});
      worker.once('exit', () => {
        if (this.writer === worker) this.writer = undefined;
      });
      this.writer = worker;
    }
    const worker = this.writer;
    const result = new Promise<void>((resolve, reject) => {
      const clear = () => {
        worker.off('message', message);
        worker.off('error', error);
        worker.off('exit', exit);
      };
      const message = (value: { ok: boolean; error?: string }) => {
        clear();
        value.ok ? resolve() : reject(Error(value.error));
      };
      let failure: Error | undefined;
      const error = (value: Error) => {
        failure = value;
      };
      const exit = () => {
        clear();
        this.writer = undefined;
        reject(failure ?? Error('Checkpoint writer exited before acknowledging its commit'));
      };
      worker.once('message', message);
      worker.once('error', error);
      worker.once('exit', exit);
      worker.postMessage({ worlds: snapshots.map((s) => s.record), playtime });
    }).then(() => {
      for (const snapshot of snapshots) snapshot.committed();
    });
    this.pendingCheckpoint = result.finally(() => {
      this.pendingCheckpoint = undefined;
    });
    return this.pendingCheckpoint;
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
    await this.ready();
    mkdirSync(dirname(path), { recursive: true });
    await backup(this.db, path);
  }
  async shutdown() {
    await this.ready();
    const writer = this.writer;
    const stopped = writer && new Promise<void>((resolve) => writer.once('exit', () => resolve()));
    this.close();
    await stopped;
  }
  close() {
    if (this.checkpointBusy)
      throw Error('Await the periodic checkpoint before closing the database');
    this.writer?.postMessage({ close: true });
    this.writer = undefined;
    this.db.close();
  }
}
