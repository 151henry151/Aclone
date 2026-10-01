// SPDX-License-Identifier: GPL-3.0-or-later
import { z } from 'zod';
import type { NpcMemory } from './memory.ts';
export const budgetSchema = z.object({
  monthlyUsd: z.number().min(0).max(10000).default(20),
  dailyUsd: z.number().min(0).max(1000).default(0.6),
  callsPerHour: z.number().int().min(1).max(10000).default(120),
  concurrency: z.number().int().min(1).max(8).default(2),
  inputUsdPerMillion: z.number().nonnegative().default(0.4),
  outputUsdPerMillion: z.number().nonnegative().default(1.6),
});
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
        db.prepare('SELECT count(*) AS n FROM npc_calls WHERE at>?').get(now - 3600000)!.n,
      ),
      ...this.config,
    };
  }
  reserve(resident: string, inputBytes: number, outputLimit: number, now = Date.now()) {
    // UTF-8 bytes plus a fixed envelope allowance conservatively bound text token usage.
    const reserved =
      ((inputBytes + 2048) * this.config.inputUsdPerMillion +
        outputLimit * this.config.outputUsdPerMillion) /
      1e6;
    return this.memory.store.transaction(() => {
      const u = this.usage(now);
      if (
        u.hourCalls >= this.config.callsPerHour ||
        u.dayUsd + reserved > this.config.dailyUsd ||
        u.monthUsd + reserved > this.config.monthlyUsd
      )
        return undefined;
      const result = this.memory.store.db
        .prepare(
          "INSERT INTO npc_calls(resident,at,reserved,charged,status) VALUES (?,?,?,?,'pending')",
        )
        .run(resident, now, reserved, reserved);
      return Number(result.lastInsertRowid);
    });
  }
  settle(id: number, inputTokens: number, outputTokens: number) {
    const charged =
      (inputTokens * this.config.inputUsdPerMillion +
        outputTokens * this.config.outputUsdPerMillion) /
      1e6;
    this.memory.store.db
      .prepare(
        "UPDATE npc_calls SET charged=?,input_tokens=?,output_tokens=?,status='complete' WHERE id=?",
      )
      .run(charged, inputTokens, outputTokens, id);
  }
  failed(id: number) {
    this.memory.store.db.prepare("UPDATE npc_calls SET status='uncertain' WHERE id=?").run(id);
  }
}
