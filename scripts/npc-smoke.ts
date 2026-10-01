// SPDX-License-Identifier: GPL-3.0-or-later
// Explicitly opt-in: performs at most two real API requests using synthetic chat.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { createApp } from '../src/server/app.ts';
import { npcConfigSchema } from '../src/server/npc/config.ts';
import { OpenAIBrain } from '../src/server/npc/openai.ts';
import { addPlayer, act, advance } from '../src/shared/simulation.ts';
if (!process.argv.includes('--live'))
  throw Error(
    'Use --live to opt into up to two paid OpenAI API requests. Unit/browser tests do not use the API.',
  );
const key = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
if (!key) throw Error('Set OPENAI_API_KEY in the server environment');
const dir = mkdtempSync(join(tmpdir(), 'aclone-npc-live-'));
const config = npcConfigSchema.parse({ activeAlone: true });
const provider = new OpenAIBrain(key, config.model, async (...args) => {
  const response = await fetch(...args);
  if (!response.ok) {
    const body = (await response
      .clone()
      .json()
      .catch(() => ({}))) as { error?: { code?: unknown; type?: unknown; param?: unknown } };
    const safe = (value: unknown) =>
      typeof value === 'string' && /^[a-zA-Z0-9_.[\]-]{1,100}$/.test(value) ? value : undefined;
    console.error(
      'OpenAI request rejected:',
      JSON.stringify({
        status: response.status,
        code: safe(body.error?.code),
        type: safe(body.error?.type),
        param: safe(body.error?.param),
      }),
    );
  }
  return response;
});
let calls = 0;
const brain = {
  async decide(...args: Parameters<typeof provider.decide>) {
    if (calls >= 2) throw Error('Live test request limit');
    calls++;
    return provider.decide(...args);
  },
};
let app = await createApp({
  dataDir: dir,
  tick: false,
  npc: { residents: [{ config, brain }], budget: { dailyUsd: 0.1, monthlyUsd: 0.1 } },
});
try {
  let w = app.worlds.get('puddlewick')!;
  w.script = '';
  const human = addPlayer(w, 'synthetic-robin', 'Robin Test');
  human.online = true;
  const id = app.residents!.status()[0].playerId;
  act(w, human.id, {
    type: 'chat',
    text: 'Hello Mabel! I collect blue tractors. Please remember that. Could you show me how you earn a wage at the Odd Jobs Office?',
    to: id,
  });
  const start = Date.now();
  app.residents!.tick(0.05, start);
  await app.residents!.settled();
  const journal = app.residents!.memory.recent('mabel', 50);
  assert.ok(
    journal.some((e) => e.kind === 'decision'),
    'provider returned no validated plan: ' +
      JSON.stringify(journal.filter((e) => e.kind === 'provider-error')),
  );
  const initialCash = w.players[id].cash;
  for (let i = 1; i <= 2400; i++) {
    w = app.worlds.get('puddlewick')!;
    advance(w, 0.05);
    app.residents!.tick(0.05, start + i * 50);
  }
  await app.residents!.settled();
  // Allow the second response to execute too, rather than stopping at re-planning.
  for (let i = 2401; i <= 4800; i++) {
    w = app.worlds.get('puddlewick')!;
    advance(w, 0.05);
    app.residents!.tick(0.05, start + i * 50);
  }
  await app.residents!.settled();
  w = app.worlds.get('puddlewick')!;
  const state = app.residents!.memory.load('mabel')!;
  console.log(
    JSON.stringify(
      {
        calls,
        chat: w.messages.filter((m) => m.npc),
        cashBefore: initialCash,
        cashAfter: w.players[id].cash,
        intent: state.intent,
        notebook: state.notebook,
        usage: app.residents!.budget.usage(),
        recent: app.residents!.memory.recent('mabel', 30),
      },
      null,
      2,
    ),
  );
  await app.close();
  app = await createApp({ dataDir: dir, tick: false, npc: { residents: [{ config, brain }] } });
  assert.equal(app.residents!.status()[0].playerId, id);
  assert.equal(app.residents!.memory.load('mabel')!.notebook, state.notebook);
  assert.ok(app.residents!.memory.search('mabel', 'blue tractors', null).length);
  console.log(
    'Live provider plan, chat journal and durable memory/restart checks passed. Review action results above for gameplay outcomes.',
  );
} finally {
  await app.close();
  rmSync(dir, { recursive: true, force: true });
}
