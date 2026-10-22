// SPDX-License-Identifier: GPL-3.0-or-later
import { existsSync, readFileSync } from 'node:fs';
import { z } from 'zod';
import type { Store } from './store.ts';
import type { PlaytimeStatistics } from '../shared/player-statistics.ts';

const historySchema = z.object({
  events: z.array(z.tuple([z.string(), z.number().nonnegative(), z.string()])),
  coverage: z.array(
    z.object({ world: z.string(), lo: z.number().nonnegative(), hi: z.number().nonnegative() }),
  ),
});
export type PlaytimeHistory = z.infer<typeof historySchema>;

/** Count only complete connections in continuously retained history. Never bridge missing logs. */
export function reconstructPlaytime(history: PlaytimeHistory): Map<string, number> {
  const result = new Map<string, number>();
  for (const world of new Set(history.coverage.map((c) => c.world))) {
    const ranges: [number, number][] = [];
    for (const c of history.coverage.filter((c) => c.world === world).sort((a, b) => a.lo - b.lo)) {
      const last = ranges.at(-1);
      if (last && c.lo <= last[1]) last[1] = Math.max(last[1], c.hi);
      else ranges.push([c.lo, c.hi]);
    }
    const events = [
      ...new Set(history.events.filter((e) => e[0] === world).map((e) => JSON.stringify(e))),
    ]
      .map((e) => JSON.parse(e) as [string, number, string])
      .sort((a, b) => a[1] - b[1]);
    const starts = new Map<string, number>();
    for (const [, time, text] of events) {
      const match = /^(.*) (arrived|has left)\.$/.exec(text);
      if (!match) continue;
      const [, name, event] = match;
      if (event === 'arrived') starts.set(name, time);
      else {
        const start = starts.get(name);
        starts.delete(name);
        if (start !== undefined && ranges.some(([lo, hi]) => start >= lo && time <= hi))
          result.set(name, (result.get(name) ?? 0) + time - start);
      }
    }
  }
  return result;
}

/** Connected account time, including space, deduplicated across sockets; independent of world speed. */
export class Playtime {
  private rows = new Map<string, PlaytimeStatistics>();
  constructor(
    private store: Store,
    historyPath?: string,
  ) {
    store.db.exec(`CREATE TABLE IF NOT EXISTS player_playtime (
      account TEXT PRIMARY KEY, since TEXT NOT NULL, recorded REAL NOT NULL, estimated REAL NOT NULL
    )`);
    for (const row of store.db.prepare('SELECT * FROM player_playtime').all())
      this.rows.set(String(row.account), {
        since: String(row.since),
        recordedSeconds: Number(row.recorded),
        estimatedSeconds: Number(row.estimated),
      });
    const history: PlaytimeHistory =
      historyPath && existsSync(historyPath)
        ? historySchema.parse(JSON.parse(readFileSync(historyPath, 'utf8')))
        : { events: [], coverage: [] };
    // The external file contains old backup evidence; the current archive extends it to this startup.
    for (const row of store.db
      .prepare('SELECT world,MIN(time) lo,MAX(time) hi FROM public_messages GROUP BY world')
      .all())
      history.coverage.push({ world: String(row.world), lo: Number(row.lo), hi: Number(row.hi) });
    for (const row of store.db
      .prepare(
        "SELECT world,time,text FROM public_messages WHERE name='Parish notice' AND kind='system'",
      )
      .all())
      history.events.push([String(row.world), Number(row.time), String(row.text)]);
    const estimates = reconstructPlaytime(history);
    for (const row of store.db.prepare('SELECT id,name FROM accounts').all()) {
      if (!this.rows.has(String(row.id)))
        this.rows.set(String(row.id), {
          since: new Date().toISOString(),
          recordedSeconds: 0,
          estimatedSeconds: estimates.get(String(row.name)) ?? 0,
        });
    }
    this.save();
  }
  get(id: string): PlaytimeStatistics {
    let row = this.rows.get(id);
    if (!row)
      this.rows.set(
        id,
        (row = { since: new Date().toISOString(), recordedSeconds: 0, estimatedSeconds: 0 }),
      );
    return { ...row };
  }
  advance(ids: Iterable<string>, seconds: number) {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    for (const id of new Set(ids)) {
      this.get(id);
      this.rows.get(id)!.recordedSeconds += seconds;
    }
  }
  save() {
    this.store.transaction(() => {
      const write = this.store.db.prepare(
        'INSERT INTO player_playtime VALUES (?,?,?,?) ON CONFLICT(account) DO UPDATE SET recorded=excluded.recorded',
      );
      for (const [id, row] of this.rows)
        write.run(id, row.since, row.recordedSeconds, row.estimatedSeconds);
    });
  }
}
