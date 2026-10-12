// SPDX-License-Identifier: GPL-3.0-or-later
// Offline experiment infrastructure. Never constructed by the game server.
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as sleep } from 'node:timers/promises';
import type { Brain, BrainResult } from './decision.ts';
import type { TokenRates } from './budget.ts';

/** Separate from the world checkpoint: restoring a world cannot refund paid calls. */
export class CanarySpend {
  readonly db: DatabaseSync;
  stopped?: string;
  private nextDispatch = 0;
  private errors = 0;
  constructor(
    path: string,
    readonly limitUsd: number,
    private spacingMs = 500,
  ) {
    if (!(limitUsd > 0 && Number.isFinite(limitUsd))) throw Error('A positive USD cap is required');
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS requests(id INTEGER PRIMARY KEY, resident TEXT, charged REAL, status TEXT, input INTEGER DEFAULT 0, output INTEGER DEFAULT 0);
      CREATE TABLE IF NOT EXISTS settings(cap REAL NOT NULL);`);
    const previous = this.db.prepare('SELECT cap FROM settings').get();
    if (previous && previous.cap !== limitUsd)
      throw Error('Cannot change an existing experiment cap');
    if (!previous) this.db.prepare('INSERT INTO settings VALUES (?)').run(limitUsd);
  }
  usage() {
    return this.db
      .prepare(
        'SELECT count(*) requests, coalesce(sum(charged),0) usd, coalesce(sum(input),0) inputTokens, coalesce(sum(output),0) outputTokens FROM requests',
      )
      .get()!;
  }
  wrap(resident: string, inner: Brain, rates: TokenRates): Brain {
    return {
      prepare: inner.prepare?.bind(inner),
      decide: async (request, signal) => {
        if (this.stopped) throw Error(this.stopped);
        const bytes = Buffer.byteLength(request.preparedBody ?? JSON.stringify(request));
        const reserved =
          ((bytes + 2048) * rates.inputUsdPerMillion + 2400 * rates.outputUsdPerMillion) / 1e6;
        // No await between checking and reserving; concurrent calls cannot overshoot.
        if (Number(this.usage().usd) + reserved > this.limitUsd) {
          this.stopped = 'Test spending ceiling reached';
          throw Error(this.stopped);
        }
        const id = Number(
          this.db
            .prepare("INSERT INTO requests(resident,charged,status) VALUES (?,?,'reserved')")
            .run(resident, reserved).lastInsertRowid,
        );
        const delay = Math.max(0, this.nextDispatch - performance.now());
        this.nextDispatch = Math.max(performance.now(), this.nextDispatch) + this.spacingMs;
        try {
          await sleep(delay, undefined, { signal });
          signal.throwIfAborted();
        } catch (e) {
          this.db.prepare("UPDATE requests SET charged=0,status='not-sent' WHERE id=?").run(id);
          throw e;
        }
        try {
          const result = await inner.decide(request, signal);
          const cost =
            (result.inputTokens * rates.inputUsdPerMillion +
              result.outputTokens * rates.outputUsdPerMillion) /
            1e6;
          if (!Number.isFinite(cost) || cost < 0) throw Error('Invalid provider usage');
          this.db
            .prepare("UPDATE requests SET charged=?,input=?,output=?,status='complete' WHERE id=?")
            .run(cost, result.inputTokens, result.outputTokens, id);
          if (cost > reserved)
            this.stopped = 'Provider usage exceeded conservative token reservation';
          this.errors = 0;
          return result;
        } catch (e) {
          // Ambiguous failures retain their reservation, including process crashes.
          this.db
            .prepare("UPDATE requests SET status='uncertain' WHERE id=? AND status='reserved'")
            .run(id);
          if (++this.errors >= 3 || /HTTP (401|403|429)/.test(String(e)))
            this.stopped = 'Provider failures; paused before further paid calls';
          throw e;
        }
      },
    };
  }
}

/** Fetch in real time, then deliver at the corresponding simulated latency.
 * The runner waits for transports, never advances past an unknown arrival time.
 * Rate-limit waiting is intentionally included: this is a conservative delay. */
export class CanaryClock {
  private transports = new Set<Promise<void>>();
  private deliveries: { at: number; deliver: () => void }[] = [];
  constructor(readonly now: () => number) {}
  get pending() {
    return this.transports.size + this.deliveries.length;
  }
  wrap(inner: Brain): Brain {
    return {
      prepare: inner.prepare?.bind(inner),
      decide: (request, signal) => {
        const at = this.now(),
          started = performance.now();
        return new Promise<BrainResult>((resolve, reject) => {
          const job = inner
            .decide(request, signal)
            .then(
              (result) => {
                this.deliveries.push({
                  at: at + performance.now() - started,
                  deliver: () => resolve(result),
                });
              },
              (error) => {
                this.deliveries.push({
                  at: at + performance.now() - started,
                  deliver: () => reject(error),
                });
              },
            )
            .finally(() => this.transports.delete(job));
          this.transports.add(job);
        });
      },
    };
  }
  async synchronize() {
    if (this.transports.size) await Promise.all([...this.transports]);
    const ready = this.deliveries.filter((d) => d.at <= this.now());
    this.deliveries = this.deliveries.filter((d) => d.at > this.now());
    for (const d of ready) d.deliver();
    // Flush the controller's result, checkpoint and finally handlers without
    // real-time sleeps on millions of ordinary physics steps.
    for (let i = 0; i < (ready.length ? 8 : 0); i++) await Promise.resolve();
  }
}
