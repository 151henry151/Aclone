// SPDX-License-Identifier: GPL-3.0-or-later
import { z } from 'zod';
import type { NpcMemory } from './memory.ts';
export const budgetSchema = z.object({
  monthlyUsd: z.number().min(0).max(10000).default(20),
  dailyUsd: z.number().min(0).max(1000).default(0.6),
  callsPerHour: z.number().int().min(1).max(10000).default(120),
  gameplayShare: z.number().min(0).max(1).default(0.5),
  concurrency: z.number().int().min(1).max(8).default(2),
  inputUsdPerMillion: z.number().nonnegative().default(0.4),
  outputUsdPerMillion: z.number().nonnegative().default(1.6),
});
export const tokenRatesSchema = z.object({
  inputUsdPerMillion: z.number().nonnegative(),
  outputUsdPerMillion: z.number().nonnegative(),
  cacheWriteMultiplier: z.number().nonnegative().default(1),
  cacheReadMultiplier: z.number().nonnegative().default(1),
});
export type TokenRates = z.input<typeof tokenRatesSchema>;
export type BudgetConfig = z.infer<typeof budgetSchema>;
/** Population-wide durable reservations. A crash or ambiguous API error keeps
 * the full reservation charged, so restarting cannot reset or evade the cap. */
export class NpcBudget {
  constructor(
    private memory: NpcMemory,
    readonly config: BudgetConfig,
  ) {}
  usage(now = Date.now()) {
    const date = new Date(now),
      day = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
      month = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
    const db = this.memory.store.db;
    return {
      dayUsd: Number(
        db.prepare('SELECT coalesce(sum(charged),0) AS n FROM npc_calls WHERE at>=?').get(day)!.n,
      ),
      monthUsd: Number(
        db.prepare('SELECT coalesce(sum(charged),0) AS n FROM npc_calls WHERE at>=?').get(month)!.n,
      ),
      hourCalls: Number(
        db
          .prepare("SELECT count(*) AS n FROM npc_calls WHERE at>? AND status!='not-sent'")
          .get(now - 3600000)!.n,
      ),
      // Unclassified historical charges still count toward every global cap.
      // Only known conversation charges consume the separate chat allowance.
      chatDayUsd: Number(
        db
          .prepare(
            "SELECT coalesce(sum(charged),0) AS n FROM npc_calls WHERE at>=? AND lane='chat'",
          )
          .get(day)!.n,
      ),
      chatMonthUsd: Number(
        db
          .prepare(
            "SELECT coalesce(sum(charged),0) AS n FROM npc_calls WHERE at>=? AND lane='chat'",
          )
          .get(month)!.n,
      ),
      chatHourCalls: Number(
        db
          .prepare(
            "SELECT count(*) AS n FROM npc_calls WHERE at>? AND lane='chat' AND status!='not-sent'",
          )
          .get(now - 3600000)!.n,
      ),
      ...this.config,
    };
  }
  reserve(
    resident: string,
    inputBytes: number,
    outputLimit: number,
    now = Date.now(),
    rates: TokenRates = this.config,
    lane: 'gameplay' | 'chat' = 'gameplay',
  ) {
    const pricing = tokenRatesSchema.parse(rates);
    // UTF-8 bytes plus a fixed envelope allowance conservatively bound text token usage.
    const reserved =
      ((inputBytes + 2048) *
        pricing.inputUsdPerMillion *
        Math.max(1, pricing.cacheWriteMultiplier, pricing.cacheReadMultiplier) +
        outputLimit * pricing.outputUsdPerMillion) /
      1e6;
    return this.memory.store.transaction(() => {
      const u = this.usage(now);
      const chatShare = 1 - this.config.gameplayShare;
      if (
        lane === 'chat' &&
        (u.chatDayUsd + reserved > this.config.dailyUsd * chatShare ||
          u.chatMonthUsd + reserved > this.config.monthlyUsd * chatShare ||
          u.chatHourCalls >= Math.ceil(this.config.callsPerHour * chatShare))
      )
        return undefined;
      if (
        u.hourCalls >= this.config.callsPerHour ||
        u.dayUsd + reserved > this.config.dailyUsd ||
        u.monthUsd + reserved > this.config.monthlyUsd
      )
        return undefined;
      const result = this.memory.store.db
        .prepare(
          "INSERT INTO npc_calls(resident,at,reserved,charged,rates,lane,status) VALUES (?,?,?,?,?,?,'pending')",
        )
        .run(resident, now, reserved, reserved, JSON.stringify(pricing), lane);
      return Number(result.lastInsertRowid);
    });
  }
  settle(
    id: number,
    inputTokens: number,
    outputTokens: number,
    cacheWriteTokens = 0,
    cacheReadTokens = 0,
  ) {
    if (
      ![inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens].every(
        (n) => Number.isSafeInteger(n) && n >= 0,
      )
    )
      throw Error('AI response missing token accounting');
    const row = this.memory.store.db.prepare('SELECT rates FROM npc_calls WHERE id=?').get(id);
    if (!row) throw Error('Unknown AI reservation');
    const pricing = tokenRatesSchema.parse(row.rates ? JSON.parse(String(row.rates)) : this.config);
    const charged =
      ((inputTokens +
        cacheWriteTokens * pricing.cacheWriteMultiplier +
        cacheReadTokens * pricing.cacheReadMultiplier) *
        pricing.inputUsdPerMillion +
        outputTokens * pricing.outputUsdPerMillion) /
      1e6;
    this.memory.store.db
      .prepare(
        "UPDATE npc_calls SET charged=?,input_tokens=?,output_tokens=?,cache_write_tokens=?,cache_read_tokens=?,status='complete' WHERE id=?",
      )
      .run(charged, inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens, id);
  }
  notSent(id: number) {
    this.memory.store.db
      .prepare("UPDATE npc_calls SET status='not-sent',charged=0 WHERE id=? AND status='pending'")
      .run(id);
  }
  failed(id: number) {
    this.memory.store.db.prepare("UPDATE npc_calls SET status='uncertain' WHERE id=?").run(id);
  }
}
