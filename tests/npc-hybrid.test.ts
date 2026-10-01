// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configuredResidents } from '../src/server/npc/providers.ts';
import { JevBrain } from '../src/server/npc/jev.ts';
import { OpenAIBrain } from '../src/server/npc/openai.ts';
import { AnthropicBrain } from '../src/server/npc/anthropic.ts';

test('all enabled residents use Jev for gameplay and retain their original conversation provider and model settings', () => {
  const env = {
    NPC_ENABLED: 'true',
    NPC_BAKER_ENABLED: 'true',
    NPC_FARMER_ENABLED: 'true',
    NPC_INDEPENDENT_ENABLED: 'true',
    OPENAI_API_KEY: 'openai-test',
    CLAUDE_API_KEY: 'claude-test',
    JEV_API_KEY: 'jev-test',
  };
  const configured = configuredResidents(env)!;
  assert.deepEqual(
    configured.residents.map((r) => r.config.id),
    ['mabel', 'toby', 'rowan', 'elias'],
  );
  for (const r of configured.residents) {
    assert.ok(r.brain instanceof JevBrain);
    assert.equal(r.config.provider, 'jev');
    assert.equal(r.rates.inputUsdPerMillion, 0.042);
  }
  assert.ok(configured.residents[0].dialogue!.brain instanceof OpenAIBrain);
  assert.ok(configured.residents[1].dialogue!.brain instanceof AnthropicBrain);
  assert.ok(configured.residents[2].dialogue!.brain instanceof AnthropicBrain);
  assert.equal(configured.residents[0].dialogue!.rates.inputUsdPerMillion, 0.4);
  assert.equal(configured.residents[1].dialogue!.rates.inputUsdPerMillion, 1);
  assert.throws(
    () => configuredResidents({ NPC_ENABLED: 'true', OPENAI_API_KEY: 'test' }),
    /JEV_API_KEY/,
  );
});

import { createWorld, addPlayer, act, advance } from '../src/shared/simulation.ts';
import { gameplayChoices } from '../src/server/npc/farmer.ts';
import { stepSchema } from '../src/server/npc/decision.ts';
import type { ResidentState } from '../src/server/npc/memory.ts';
const state = (p: ReturnType<typeof addPlayer>, world: string): ResidentState => ({
  playerId: p.id,
  world,
  name: p.name,
  personality: 'Practical neighbour',
  notebook: 'I remember the owner',
  intent: 'Continue my existing employment',
  cursor: 0,
  nextAt: 0,
  plan: [],
  index: 0,
  repeats: 0,
  until: 0,
  waitUntil: 0,
  status: '',
  errors: 0,
});

for (const [kind, skill, input, output, vocation] of [
  ['mill', 'miller', 'wheat', 'flour', 'general'],
  ['bakery', 'baker', 'flour', 'bread', 'baker'],
] as const) {
  test(`Jev options renew an expired ${kind} shift, consume building inputs and verify real output/wages`, () => {
    const w = createWorld('puddlewick', 'Test', 'owner');
    const p = addPlayer(w, 'worker', 'Worker');
    const b = w.buildings.find((b) => b.kind === kind)!;
    b.owner = 'owner';
    b.stock = { [input]: 50, [output]: 0 };
    b.investment = 50000;
    p.x = b.x;
    p.z = b.z;
    p.skills = [skill];
    act(w, p.id, { type: 'job', building: b.id });
    w.time = 1800;
    p.activeUntil = 1200;
    const choices = gameplayChoices(w, p, state(p, w.id), vocation);
    const renew = choices.find((c) => c.description.startsWith('Renew my shift'))!;
    assert.ok(renew);
    assert.equal(
      renew.plan.some((s) => s.kind === 'act' && s.action.type === 'trade'),
      false,
    );
    assert.ok(
      renew.reconsiderSeconds! >= 600,
      'Routine paid work does not poll a model every minute',
    );
    for (const step of renew.plan) {
      stepSchema.parse(step);
      if (step.kind === 'act') act(w, p.id, step.action);
    }
    assert.equal(b.stock[output], 0);
    const before = p.cash;
    const carriedOutput = p.inventory[output] ?? 0;
    advance(w, 600);
    assert.ok(b.stock[output] > 0);
    assert.ok(b.stock[input] < 50);
    assert.ok(p.cash > before);
    assert.equal(p.inventory[output] ?? 0, carriedOutput);
    b.owner = p.id;
    assert.ok(
      !gameplayChoices(w, p, state(p, w.id), vocation).some((c) =>
        c.plan.some(
          (s) =>
            s.kind === 'act' &&
            'building' in s.action &&
            s.action.building === b.id &&
            ['job', 'work', 'trade'].includes(s.action.type),
        ),
      ),
    );
  });
}

test('Toby is offered ordinary baker training; Mabel keeps her existing qualifications and job options', () => {
  const w = createWorld('puddlewick', 'Test', 'owner');
  const p = addPlayer(w, 'toby', 'Toby');
  const choices = gameplayChoices(w, p, state(p, w.id), 'baker');
  assert.ok(
    choices.some((c) =>
      c.plan.some(
        (s) => s.kind === 'act' && s.action.type === 'learn' && s.action.skill === 'baker',
      ),
    ),
  );
  assert.ok(
    choices.some((c) =>
      c.plan.some(
        (s) => s.kind === 'act' && s.action.type === 'learn' && s.action.skill === 'farmer',
      ),
    ),
  );
  assert.ok(!choices.some((c) => c.plan.some((s) => s.kind === 'act' && s.action.type === 'job')));
  assert.deepEqual(p.skills, []);
});
