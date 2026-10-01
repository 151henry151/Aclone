// SPDX-License-Identifier: GPL-3.0-or-later
// Explicit opt-in: disposable world, at most four Jev and two Claude calls, $0.50 cap.
import assert from 'node:assert/strict';
import { Store } from '../src/server/store.ts';
import { Universe } from '../src/server/universe.ts';
import { Residents } from '../src/server/npc/residents.ts';
import { configuredResidents } from '../src/server/npc/providers.ts';
import { createWorld, addPlayer, say, advance } from '../src/shared/simulation.ts';
if (!process.argv.includes('--live'))
  throw Error('Use --live to permit up to six paid provider calls');
const configured = configuredResidents({
  ...process.env,
  NPC_ENABLED: 'false',
  NPC_BAKER_ENABLED: 'false',
  NPC_FARMER_ENABLED: 'true',
  NPC_FARMER_ACTIVE_ALONE: 'true',
  NPC_FARMER_INTERVAL_MS: '5000',
})!;
const store = new Store(':memory:');
const option = configured.residents[0];
const w = createWorld(option.config.world, 'Farmer smoke test', 'test-owner');
const worlds = new Map([[w.id, w]]);
let residents = new Residents(store, new Universe(store), worlds, [option], {
  dailyUsd: 0.5,
  monthlyUsd: 0.5,
  callsPerHour: 6,
});
try {
  const id = residents.status()[0].playerId,
    p = w.players[id];
  const human = addPlayer(w, 'test-owner', 'Test owner');
  const school = w.buildings.find((b) => b.kind === 'school')!;
  const farm = w.buildings.find((b) => b.kind === 'farm')!;
  farm.owner = human.id;
  farm.investment = 50000;
  farm.stock = {};
  let now = Date.now();
  const think = async (question?: string) => {
    // Restart controller between staged fixtures, also exercising durable identity/memory.
    residents.close();
    const saved = residents.memory.load(option.config.id)!;
    saved.plan = [];
    saved.nextAt = 0;
    saved.waitUntil = 0;
    saved.needsDecision = true;
    residents.memory.save(option.config.id, saved);
    residents = new Residents(store, new Universe(store), worlds, [option], {
      dailyUsd: 0.5,
      monthlyUsd: 0.5,
      callsPerHour: 6,
    });
    now = Date.now();
    if (question) {
      say(w, human.name, question, 'chat', id);
      residents.capture(w);
    }
    residents.tick(0.05, now);
    await residents.settled();
    const state = residents.memory.load(option.config.id)!;
    if (state.errors)
      throw Error('AI smoke failed; inspect API billing/model access (provider bodies withheld)');
    console.log(
      JSON.stringify({
        goal: state.intent,
        plan: state.plan,
        reply: w.messages.filter((m) => m.name === p.name).at(-1)?.text,
      }),
    );
    // Fixtures are at the relevant service entrance; navigation has separate tests.
    for (let i = 1; i <= 6; i++) residents.tick(0.05, Math.max(Date.now(), now) + i * 500);
  };
  // Move fixtures, never real residents. No skills or wages are injected.
  p.x = school.x;
  p.z = school.z + 12;
  const cash = p.cash;
  await think(
    'Rowan, please learn farmer at this school now so you can work at my farm. Remember that I grow pears.',
  );
  assert.equal(p.learning?.skill, 'farmer');
  assert.equal(p.cash, cash - 8000);
  advance(w, 60);
  assert.ok(p.skills.includes('farmer'));
  p.x = farm.x;
  p.z = farm.z + 12;
  await think();
  assert.equal(p.job, farm.id, 'Jev should choose available farm employment');
  await think();
  assert.ok(
    farm.plots?.some((plot) => plot.crop),
    'Jev should choose a seasonally valid crop',
  );
  const plot = farm.plots!.find((plot) => plot.crop)!;
  // Fast-forward this isolated fixture to ripeness; keep survival needs noncritical.
  w.time = plot.ready;
  const before = p.cash;
  await think('Rowan, the crop is ripe now; please harvest it. Also, do you remember what I grow?');
  assert.equal(p.task?.kind, 'harvest');
  advance(w, 15);
  assert.ok(p.cash > before);
  assert.ok(Object.values(farm.stock).some((n) => n > 0));
  const reply = w.messages.filter((m) => m.name === p.name).at(-1)!;
  assert.equal(reply.to, human.id);
  assert.match(reply.text, /pear/i);
  const calls = store.db
    .prepare('SELECT status, input_tokens, output_tokens, charged FROM npc_calls ORDER BY id')
    .all();
  assert.equal(calls.length, 6);
  assert.ok(calls.every((c) => c.status === 'complete'));
  console.log(
    JSON.stringify({
      ok: true,
      calls: calls.length,
      stock: farm.stock,
      netHarvestPay: p.cash - before,
      estimatedUsd: residents.budget.usage().dayUsd,
    }),
  );
} finally {
  residents.close();
  store.close();
}
