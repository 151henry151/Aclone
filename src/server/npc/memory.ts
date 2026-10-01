// SPDX-License-Identifier: GPL-3.0-or-later
import type { Store } from '../store.ts';
import type { Recovery } from './recovery.ts';
import type { Step } from './decision.ts';
export interface ResidentState {
  recovery?: Recovery;
  lastOutcome?: {
    time: number;
    ok: boolean;
    message: string;
    attempted?: Step;
    repeats: number;
  };
  helpQuestion?: string;
  questionFrom?: string;
  guideQuery?: string;
  needsDecision?: boolean;
  pending?: boolean;
  replyTo?: string;
  playerId: string;
  world: string;
  name: string;
  personality: string;
  notebook: string;
  intent: string;
  cursor: number;
  nextAt: number;
  plan: Step[];
  index: number;
  repeats: number;
  until: number;
  waitUntil: number;
  status: string;
  errors: number;
  observedTask?: string;
  observedDeaths?: number;
  critical?: boolean;
  recall?: JournalEntry[];
}
export interface JournalEntry {
  id: number;
  time: number;
  kind: string;
  data: unknown;
}
export class NpcMemory {
  constructor(public store: Store) {
    store.db
      .exec(`CREATE TABLE IF NOT EXISTS npc_residents (id TEXT PRIMARY KEY, state TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS npc_journal (id INTEGER PRIMARY KEY AUTOINCREMENT, resident TEXT NOT NULL, time REAL NOT NULL, kind TEXT NOT NULL, data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS npc_journal_resident ON npc_journal(resident,id);
      CREATE TABLE IF NOT EXISTS npc_control (resident TEXT PRIMARY KEY, paused INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS npc_calls (id INTEGER PRIMARY KEY AUTOINCREMENT, resident TEXT NOT NULL, at INTEGER NOT NULL, reserved REAL NOT NULL, charged REAL NOT NULL, input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS npc_calls_at ON npc_calls(at);`);
  }
  paused(id: string) {
    return !!this.store.db.prepare('SELECT paused FROM npc_control WHERE resident=?').get(id)
      ?.paused;
  }
  pause(id: string, paused: boolean) {
    this.store.db.prepare('INSERT OR REPLACE INTO npc_control VALUES (?,?)').run(id, +paused);
  }
  load(id: string): ResidentState | undefined {
    const row = this.store.db.prepare('SELECT state FROM npc_residents WHERE id=?').get(id);
    return row ? JSON.parse(String(row.state)) : undefined;
  }
  save(id: string, state: ResidentState) {
    this.store.db
      .prepare('INSERT OR REPLACE INTO npc_residents VALUES (?,?)')
      .run(id, JSON.stringify(state));
  }
  append(resident: string, time: number, kind: string, data: unknown) {
    this.store.db
      .prepare('INSERT INTO npc_journal(resident,time,kind,data) VALUES (?,?,?,?)')
      .run(resident, time, kind, JSON.stringify(data));
  }
  private rows(rows: Record<string, unknown>[]): JournalEntry[] {
    return rows.map((r) => ({
      id: Number(r.id),
      time: Number(r.time),
      kind: String(r.kind),
      data: JSON.parse(String(r.data)),
    }));
  }
  recent(id: string, limit = 12) {
    return this.rows(
      this.store.db
        .prepare('SELECT * FROM npc_journal WHERE resident=? ORDER BY id DESC LIMIT ?')
        .all(id, Math.min(100, limit)),
    ).reverse();
  }
  search(id: string, query: string, before: number | null) {
    const terms = query.trim().slice(0, 200).split(/\s+/).slice(0, 8);
    const where = terms.map(() => "data LIKE ? ESCAPE '\\'").join(' AND ');
    return this.rows(
      this.store.db
        .prepare(
          `SELECT * FROM npc_journal WHERE resident=? AND id<? AND ${where} ORDER BY id DESC LIMIT 20`,
        )
        .all(
          id,
          before ?? Number.MAX_SAFE_INTEGER,
          ...terms.map((t) => '%' + t.replace(/[\\%_]/g, '\\$&') + '%'),
        ),
    );
  }
  count(id: string) {
    return Number(
      this.store.db.prepare('SELECT count(*) AS n FROM npc_journal WHERE resident=?').get(id)!.n,
    );
  }
}
