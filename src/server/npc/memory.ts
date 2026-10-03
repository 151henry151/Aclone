// SPDX-License-Identifier: GPL-3.0-or-later
import type { Store } from '../store.ts';
import type { Recovery } from './recovery.ts';
import type { Step } from './decision.ts';
import type { Presence } from './habits.ts';
import type { Commitment } from './commitments.ts';
export interface ResidentState {
  pendingAgreementReply?: { world: string; text: string; to?: string; conversationId?: number };
  agenda?: import('./agenda.ts').AgendaMemory;
  presence?: Presence;
  commitments?: Commitment[];
  decisionProvider?: string;
  behaviorVersion?: number;
  evaluation?: {
    time: number;
    cash: number;
    bank: number;
    health: number;
    inventory: Record<string, number>;
    job: string | null;
  };
  experiences?: {
    goal: string;
    elapsedSeconds: number;
    cashChange: number;
    bankChange: number;
    healthChange: number;
    previousJob: string | null;
    currentJob: string | null;
  }[];
  fishCaught?: number;
  originWorld?: string;
  inSpace?: boolean;
  conversationId?: number;
  publicConversations?: {
    speakerId: string;
    world: string;
    messageId: number;
    expiresAt: number;
  }[];
  dialogueNoticeKey?: string;
  dialogueAttempt?: { key: string; attempts: number; nextAt: number; done: boolean };
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
      CREATE INDEX IF NOT EXISTS npc_journal_chat ON npc_journal(resident,id) WHERE kind='chat';
      CREATE TABLE IF NOT EXISTS npc_control (resident TEXT PRIMARY KEY, paused INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS npc_calls (id INTEGER PRIMARY KEY AUTOINCREMENT, resident TEXT NOT NULL, at INTEGER NOT NULL, reserved REAL NOT NULL, charged REAL NOT NULL, input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS npc_calls_at ON npc_calls(at);`);
    // Additive migration preserves old residents, journals and outstanding charges.
    const columns = new Set(
      store.db
        .prepare('PRAGMA table_info(npc_calls)')
        .all()
        .map((r) => r.name),
    );
    for (const [name, type] of Object.entries({
      rates: 'TEXT',
      cache_write_tokens: 'INTEGER NOT NULL DEFAULT 0',
      cache_read_tokens: 'INTEGER NOT NULL DEFAULT 0',
    }))
      if (!columns.has(name)) store.db.exec(`ALTER TABLE npc_calls ADD COLUMN ${name} ${type}`);
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
  /** Keep conversational turns available even when action records crowd the journal. */
  conversation(id: string, speakerId: string, playerId: string, privateChat: boolean) {
    return this.rows(
      this.store.db
        .prepare(
          `SELECT * FROM npc_journal WHERE resident=? AND kind='chat'
        AND json_extract(data, '$.kind')='chat'
        AND ((json_extract(data, '$.sender')=? AND ${privateChat ? "json_extract(data, '$.to')=?" : "json_extract(data, '$.to') IS NULL"})
          OR (json_extract(data, '$.sender')=? AND ${privateChat ? "json_extract(data, '$.to')=?" : "json_extract(data, '$.to') IS NULL"}))
        ORDER BY id DESC LIMIT 8`,
        )
        .all(
          id,
          speakerId,
          ...(privateChat ? [playerId] : []),
          playerId,
          ...(privateChat ? [speakerId] : []),
        ),
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
