// SPDX-License-Identifier: GPL-3.0-or-later
// Opt-in live FAQ evaluation: four synthetic questions, at most eight requests.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { createApp } from '../src/server/app.ts';
import { npcConfigSchema } from '../src/server/npc/config.ts';
import { OpenAIBrain } from '../src/server/npc/openai.ts';
import { act, addPlayer } from '../src/shared/simulation.ts';
if (!process.argv.includes('--live'))
  throw Error('Use --live for up to eight paid requests using synthetic questions.');
const key = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
if (!key) throw Error('Set OPENAI_API_KEY in the server environment');
const provider = new OpenAIBrain(key, 'gpt-4.1-mini');
let calls = 0;
const dir = mkdtempSync(join(tmpdir(), 'aclone-guide-live-'));
const app = await createApp({
  dataDir: dir,
  tick: false,
  npc: {
    residents: [
      {
        config: npcConfigSchema.parse({ activeAlone: true, intervalMs: 5000 }),
        brain: {
          async decide(...args: Parameters<typeof provider.decide>) {
            if (calls >= 8) throw Error('Live guide test request limit');
            calls++;
            return provider.decide(...args);
          },
        },
      },
    ],
    budget: { dailyUsd: 0.1, monthlyUsd: 0.1 },
  },
});
try {
  const w = app.worlds.get('puddlewick')!;
  w.script = '';
  const human = addPlayer(w, 'guide-reader', 'Robin Test');
  human.online = true;
  const id = app.residents!.status()[0].playerId;
  let now = Date.now();
  for (const [question, checks] of [
    [
      'Mabel, which keys open the full parish map and switch headlights? What is Parp?',
      [/\bM\b/i, /\bL\b/i, /horn/i],
    ],
    ['Mabel, how can I reset my password by email?', [/verif/i, /forgot|reset/i]],
    ['Mabel, why can I not buy or sell at my own shop?', [/stockroom/i]],
    [
      'Mabel, how long does coffee take to grow, and in which season can I plant it?',
      [/10|ten|60|sixty/i, /spring/i],
    ],
  ] as const) {
    const cursor = w.messageSeq ?? 0;
    act(w, human.id, { type: 'chat', text: question, to: id });
    let reply;
    for (let attempt = 0; attempt < 2; attempt++) {
      now += 6000;
      app.residents!.tick(0.05, now);
      await app.residents!.settled();
      reply = w.messages.find((m) => (m.id ?? 0) > cursor && m.npc && m.to === human.id);
      if (reply) break;
      // Execute a requested read-only lookup, then allow a follow-up turn.
      const step = app.residents!.memory.load('mabel')?.plan[0];
      assert.equal(step?.kind, 'guide', 'No answer or guide lookup; inspect provider state');
      app.residents!.tick(0.05, now + 500);
    }
    assert.ok(reply, 'Expected a private help reply');
    console.log(JSON.stringify({ question, answer: reply.text }));
    for (const pattern of checks) assert.match(reply.text, pattern);
  }
  console.log(JSON.stringify({ calls, estimatedUsd: app.residents!.budget.usage().dayUsd }));
  console.log('Live controls, recovery, ownership and farming help passed.');
} finally {
  await app.close();
  rmSync(dir, { recursive: true, force: true });
}
