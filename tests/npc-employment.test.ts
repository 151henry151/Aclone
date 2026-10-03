// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorld,
  addPlayer,
  makeBuilding,
  act,
  advance,
  say,
} from '../src/shared/simulation.ts';
import {
  commitmentChoices,
  employmentBlocker,
  recordCommitment,
  refreshEmployment,
  focusCommitments,
} from '../src/server/npc/commitments.ts';
import {
  conversationTool,
  conversationRequest,
  unqueuedPromise,
} from '../src/server/npc/conversation.ts';
import { failStep } from '../src/server/npc/recovery.ts';
import { stepSchema, type Step } from '../src/server/npc/decision.ts';
import type { ResidentState } from '../src/server/npc/memory.ts';
import { Store } from '../src/server/store.ts';
import { Universe } from '../src/server/universe.ts';
import { Residents } from '../src/server/npc/residents.ts';
import { npcConfigSchema } from '../src/server/npc/config.ts';
const request = {
  summary: 'Learn milling and work at Hank’s mill',
  cancel: false,
  delivery: null,
  employment: { building: 'mill', train: true },
};
function setup() {
  const w = createWorld('puddlewick', 'Test', 'owner');
  w.settings.hungerRate = w.settings.thirstRate = 0;
  const p = addPlayer(w, 'elias', 'Elias');
  const school = makeBuilding('school', 'school', 0, 0),
    mill = makeBuilding('mill', 'mill', 36, 0),
    farm = makeBuilding('farm', 'farm', -36, 0);
  mill.owner = 'human';
  mill.investment = 100000;
  mill.stock = { wheat: 50, flour: 0 };
  w.buildings = [school, mill, farm];
  p.skills = ['farmer'];
  p.job = farm.id;
  farm.employees = [p.id];
  return { w, p, school, mill, farm, state: { commitments: [] } as unknown as ResidentState };
}
function execute(
  w: ReturnType<typeof createWorld>,
  p: ReturnType<typeof addPlayer>,
  steps: Step[],
) {
  for (const step of steps) {
    stepSchema.parse(step);
    if (step.kind === 'travel') {
      const b = w.buildings.find((b) => b.id === step.destination)!;
      p.x = b.x;
      p.z = b.z;
    } else if (step.kind === 'act') act(w, p.id, step.action);
  }
}
test('employment agreement pays tuition, waits for a second qualification, changes job and verifies employment', () => {
  const { w, p, school, mill, farm, state } = setup();
  assert.equal(recordCommitment(state, request, 'chat-1', 'human', w, null), true);
  assert.equal(recordCommitment(state, request, 'chat-2', 'human', w, null), false);
  const cash = p.cash;
  const study = commitmentChoices(w, p, state)[0];
  assert.ok(study.plan.some((s) => s.kind === 'travel' && s.destination === school.id));
  execute(w, p, study.plan);
  assert.equal(p.cash, cash - 16000);
  assert.equal(p.learning?.skill, 'miller');
  assert.equal(p.job, farm.id, 'keep old job until qualified and at new employer');
  assert.equal(p.learning!.end - w.time, 2400);
  const wait = commitmentChoices(w, p, state)[0];
  assert.deepEqual(wait.plan, [{ kind: 'wait', seconds: 300 }]);
  const restored = structuredClone(state);
  advance(w, 2400);
  const work = commitmentChoices(w, p, restored)[0];
  assert.deepEqual(
    work.plan.filter((s) => s.kind === 'act').map((s) => s.action.type),
    ['quit', 'job'],
  );
  assert.equal(restored.commitments![0].status, 'pending');
  execute(w, p, work.plan);
  refreshEmployment(w, p, restored);
  assert.equal(p.job, mill.id);
  assert.ok(!farm.employees.includes(p.id));
  assert.equal(restored.commitments![0].status, 'completed');
  assert.match(restored.commitments![0].outcome, /not finished production/);
  const flour = mill.stock.flour;
  advance(w, 600);
  assert.ok(mill.stock.flour > flour);
});
test('training blockers are truthful and remain pending for repair without free qualifications or cash', () => {
  const { w, p, mill, state } = setup();
  p.skills = ['farmer', 'baker', 'forester'];
  assert.match(employmentBlocker(w, p, request.employment)!, /skill limit/);
  recordCommitment(state, request, 'request', 'human', w);
  assert.equal(commitmentChoices(w, p, state).length, 0);
  assert.equal(state.commitments![0].status, 'blocked');
  p.skills = [];
  p.cash = 1;
  assert.match(employmentBlocker(w, p, request.employment)!, /tuition/);
  p.cash = 100000;
  assert.ok(commitmentChoices(w, p, state).length);
  mill.owner = p.id;
  assert.match(employmentBlocker(w, p, request.employment)!, /cannot employ myself/);
  mill.owner = 'human';
  mill.employees = Array.from({ length: 16 }, (_, i) => String(i));
  assert.match(employmentBlocker(w, p, request.employment)!, /filled/);
});
test('ready agreements exclude unrelated rest but retain survival choices and failed-route recovery', () => {
  const { w, p, state } = setup();
  recordCommitment(state, request, 'request', 'human', w);
  const agreed = commitmentChoices(w, p, state);
  const rest = { id: 'rest', description: 'Rest', plan: [{ kind: 'wait' as const, seconds: 60 }] };
  assert.deepEqual(focusCommitments(w, p, state, [...agreed, rest]), agreed);
  p.thirst = 40000;
  assert.equal(focusCommitments(w, p, state, [...agreed, rest]).length, 2);
  p.thirst = 1000;
  state.recovery = {};
  const travel = agreed[0].plan.find((s) => s.kind === 'travel')!;
  failStep(state.recovery, w.time, travel, 'Route blocked');
  failStep(state.recovery, w.time, travel, 'Route blocked');
  assert.deepEqual(focusCommitments(w, p, state, [...agreed, rest]), [rest]);
  assert.deepEqual(commitmentChoices(w, p, state), []);
  assert.equal(state.commitments![0].status, 'blocked');
  assert.match(state.commitments![0].outcome, /Route blocked/);
});
test('conversation tool requires explicit nullable employment and old delivery requests remain readable', () => {
  const visit = (schema: any) => {
    if (!schema || typeof schema !== 'object') return;
    if (schema.type === 'object')
      assert.deepEqual([...schema.required].sort(), Object.keys(schema.properties).sort());
    for (const v of Object.values(schema))
      if (typeof v === 'object') Array.isArray(v) ? v.forEach(visit) : visit(v);
  };
  visit(conversationTool.parameters);
  assert.ok(
    conversationRequest({ notebook: '', speech: null, gameplayRequest: request })!.employment,
  );
  const { w, state } = setup();
  assert.equal(
    recordCommitment(
      state,
      { summary: 'Do something', cancel: false, delivery: null },
      'note',
      'human',
      w,
    ),
    false,
  );
  assert.ok(unqueuedPromise("Absolutely, Hank. I'll head to school right now and learn miller."));
  assert.ok(!unqueuedPromise("I'll explain how milling works."));
});

test('chat request reaches actual school and mill through the resident executor, survives restart and uses one conversation call', async (t) => {
  let now = Date.now(),
    speeches = 0,
    includeRequest = true;
  t.mock.method(Date, 'now', () => now);
  const store = new Store(':memory:'),
    universe = new Universe(store);
  const { w, farm, mill } = setup();
  delete w.players.elias;
  farm.employees = [];
  const human = addPlayer(w, 'human', 'Hank');
  human.online = true;
  const worlds = new Map([[w.id, w]]);
  const idle = {
    intent: 'Rest',
    notebook: '',
    speech: null,
    plan: [{ kind: 'wait' as const, seconds: 180 }],
    repeat: 1,
    reconsiderSeconds: 180,
  };
  const options = [
    {
      config: npcConfigSchema.parse({
        id: 'elias',
        name: 'Elias Vale',
        provider: 'jev',
        activeAlone: true,
        intervalMs: 5000,
      }),
      brain: {
        async decide(req: any) {
          const choices = req.observation.choices;
          // Prefer unrelated rest if it is offered: accepted work must actually be prioritized.
          const c =
            choices.find(
              (c: any) =>
                !c.id.startsWith('commitment_') && c.plan.length === 1 && c.plan[0].kind === 'wait',
            ) ?? choices[0];
          return {
            decision: { ...idle, plan: c.plan, intent: c.description.slice(0, 300) },
            inputTokens: 10,
            outputTokens: 0,
          };
        },
      },
      dialogue: {
        provider: 'anthropic' as const,
        rates: { inputUsdPerMillion: 1, outputUsdPerMillion: 5 },
        brain: {
          async decide() {
            speeches++;
            return {
              decision: {
                ...idle,
                speech: {
                  text: "I'll head to school right now and then take your mill job.",
                  to: null,
                },
              },
              gameplayRequest: includeRequest ? request : null,
              inputTokens: 10,
              outputTokens: 5,
            };
          },
        },
      },
    },
  ];
  let residents = new Residents(store, universe, worlds, options);
  try {
    const p = w.players[residents.status()[0].playerId];
    p.skills = ['farmer'];
    p.job = farm.id;
    farm.employees = [p.id];
    p.x = 0;
    p.z = 12;
    say(w, human.name, 'Elias, please learn milling and take the job at my mill.', 'chat');
    residents.capture(w);
    residents.tick(0.5, now);
    await residents.settled();
    assert.equal(speeches, 1);
    const response = w.messages.filter((m) => m.name === p.name).at(-1)!;
    assert.match(response.text, /I have agreed to learn/);
    assert.match(response.text, /not a report of finished training or a job change/);
    assert.doesNotMatch(response.text, /\b(Jev|OpenAI|Claude|LLMs?|planner|gameplay|queued)\b/i);
    assert.equal(response.to, undefined);
    residents.close();
    residents = new Residents(store, universe, worlds, options);
    for (
      let i = 0;
      i < 15000 && residents.memory.load('elias')!.commitments![0].status !== 'completed';
      i++
    ) {
      now += 250;
      advance(w, 0.25);
      residents.tick(0.25, now);
      await residents.settled();
    }
    assert.equal(residents.memory.load('elias')!.commitments![0].status, 'completed');
    assert.ok(p.skills.includes('miller'));
    assert.equal(p.job, mill.id);
    assert.equal(speeches, 1);
    includeRequest = false;
    say(w, human.name, 'Elias, please do another errand for me.', 'chat');
    residents.capture(w);
    now += 6000;
    residents.tick(0.5, now);
    await residents.settled();
    assert.equal(speeches, 2);
    assert.match(
      w.messages.filter((m) => m.name === p.name).at(-1)!.text,
      /have not taken on a new errand/,
    );
    assert.equal(residents.memory.load('elias')!.commitments!.length, 1);
  } finally {
    residents.close();
    store.close();
  }
});
