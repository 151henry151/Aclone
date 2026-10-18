// SPDX-License-Identifier: GPL-3.0-or-later
// Synthetic decision-quality fixtures, not a population or navigation test.
// Uses the production adapter and exact wire packing, with independent cost/call ceilings.
import cases from '../tests/fixtures/npc-decision-cases.json' with { type: 'json' };
import { Store } from '../src/server/store.ts';
import { NpcMemory } from '../src/server/npc/memory.ts';
import { NpcBudget, budgetSchema } from '../src/server/npc/budget.ts';
import { JevBrain, jevInstructions } from '../src/server/npc/jev.ts';
if (!process.argv.includes('--live'))
  throw Error('Use --live for up to 16 paid synthetic Jev calls, capped at $0.05.');
const key = process.env.TYPESAFE_API_KEY || process.env.JEV_API_KEY;
if (!key) throw Error('Set the Jev key privately in the environment');
const store = new Store(':memory:');
const budget = new NpcBudget(
  new NpcMemory(store),
  budgetSchema.parse({ dailyUsd: 0.05, monthlyUsd: 0.05 }),
);
const brain = new JevBrain(key, 'jev-1.13.0');
const rows: {
  fixture: string;
  reversed: boolean;
  selected: string;
  pass: boolean;
  tokens: number;
}[] = [];
let calls = 0;
try {
  for (const fixture of cases)
    for (const reversed of [false, true]) {
      const entries = Object.entries(fixture.options).filter(
        (e): e is [string, string] => typeof e[1] === 'string',
      );
      if (reversed) entries.reverse();
      const request = brain.prepare({
        instructions: jevInstructions,
        observation: {
          self: fixture.state,
          choices: entries.map(([id, description]) => ({
            id,
            description,
            plan: [{ kind: 'wait', seconds: 1 }],
          })),
        },
      });
      if (calls >= 16) throw Error('Call limit reached');
      const reservation = budget.reserve(
        'synthetic',
        Buffer.byteLength(request.preparedBody!),
        0,
        Date.now(),
        { inputUsdPerMillion: 0.042, outputUsdPerMillion: 0 },
      );
      if (reservation === undefined) throw Error('Evaluation budget exhausted');
      calls++;
      try {
        const result = await brain.decide(request, new AbortController().signal);
        budget.settle(reservation, result.inputTokens, result.outputTokens);
        const row = {
          fixture: fixture.id,
          reversed,
          selected: result.selection!.id,
          pass: result.selection!.id === fixture.expected,
          tokens: result.inputTokens,
        };
        rows.push(row);
        console.log(JSON.stringify(row));
      } catch (error) {
        budget.failed(reservation);
        throw error;
      }
    }
  console.log(
    JSON.stringify({
      model: 'jev-1.13.0',
      passed: rows.filter((r) => r.pass).length,
      total: rows.length,
      chargedUsd: budget.usage().dayUsd,
      meanInputTokens: rows.reduce((n, r) => n + r.tokens, 0) / rows.length,
    }),
  );
  if (rows.some((r) => !r.pass)) process.exitCode = 1;
} finally {
  store.close();
}
