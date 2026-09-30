// SPDX-License-Identifier: GPL-3.0-or-later
import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { World } from '../shared/types.ts';
export class Store {
  db: DatabaseSync;
  constructor(public path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS worlds (id TEXT PRIMARY KEY,state TEXT NOT NULL,saved REAL NOT NULL);
 CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY,name TEXT UNIQUE COLLATE NOCASE NOT NULL,token_hash TEXT UNIQUE NOT NULL,state TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS ledger (world TEXT NOT NULL,id INTEGER NOT NULL,time REAL NOT NULL,kind TEXT NOT NULL,amount INTEGER NOT NULL,sender TEXT NOT NULL,recipient TEXT NOT NULL,reason TEXT NOT NULL,PRIMARY KEY(world,id));`);
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
  }
  loadWorlds() {
    return this.db
      .prepare('SELECT state,saved FROM worlds')
      .all()
      .map((row) => ({ world: JSON.parse(String(row.state)) as World, saved: Number(row.saved) }));
  }
  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const out = fn();
      this.db.exec('COMMIT');
      return out;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  saveWorld(w: World, now = Date.now() / 1000, withinTransaction?: () => void) {
    this.transaction(() => {
      withinTransaction?.();
      const insert = this.db.prepare('INSERT OR IGNORE INTO ledger VALUES (?,?,?,?,?,?,?,?)');
      for (const l of w.ledger)
        insert.run(w.id, l.id, l.time, l.kind, l.amount, l.from, l.to, l.reason);
      this.db
        .prepare('INSERT OR REPLACE INTO worlds VALUES (?,?,?)')
        .run(w.id, JSON.stringify({ ...w, ledger: w.ledger.slice(-100) }), now);
    });
    w.ledger = w.ledger.slice(-100);
  }
  async backup(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    await backup(this.db, path);
  }
  close() {
    this.db.close();
  }
}
