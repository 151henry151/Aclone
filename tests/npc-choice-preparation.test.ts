// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/server/store';
import { Universe } from '../src/server/universe';
import { Residents } from '../src/server/npc/residents';
import { npcConfigSchema } from '../src/server/npc/config';
import { createWorld, makeBuilding } from '../src/shared/simulation';
import { items } from '../src/shared/catalog';
import type { BrainRequest } from '../src/server/npc/decision';

function controllerFixture() {
  const store = new Store(':memory:');
  const w = createWorld('preparation', 'Preparation', 'owner');
  w.script = '';
  for (let i = 0; i < 48; i++) {
    const b = makeBuilding('shop-' + i, 'market', (i % 6) - 3, Math.floor(i / 6) - 4);
    b.owner = 'seller-' + i;
    b.stock = Object.fromEntries(Object.keys(items).map((k) => [k, 500]));
    b.sell = Object.fromEntries(Object.keys(items).map((k) => [k, 1]));
    b.buy = Object.fromEntries(Object.keys(items).map((k) => [k, 2]));
    b.investment = 10000;
    w.buildings.push(b);
  }
  const requests: BrainRequest[] = [];
  const residents = new Residents(
    store,
    new Universe(store),
    new Map([[w.id, w]]),
    [
      {
        config: npcConfigSchema.parse({
          id: 'planner',
          name: 'Planner',
          world: w.id,
          provider: 'jev',
          activeAlone: true,
          intervalMs: 5000,
        }),
        brain: {
          async decide(request) {
            requests.push(request);
            return {
              decision: {
                intent: 'Wait',
                notebook: '',
                speech: null,
                plan: [{ kind: 'wait', seconds: 600 }],
                repeat: 1,
                reconsiderSeconds: 600,
              },
              inputTokens: 1,
              outputTokens: 1,
            };
          },
        },
      },
    ],
    { dailyUsd: 20 },
  );
  const p = w.players[residents.status()[0].playerId];
  Object.assign(p, { x: 0, z: 0, cash: 500000, hunger: 0, thirst: 0 });
  return { store, w, p, residents, requests };
}

test('preparing a mature parish decision leaves movement heartbeats responsive', async () => {
  const { store, w, p, residents, requests } = controllerFixture();
  let last = performance.now(),
    maximum = 0,
    beats = 0;
  const heartbeat = setInterval(() => {
    const now = performance.now();
    maximum = Math.max(maximum, now - last);
    last = now;
    beats++;
  }, 10);
  try {
    residents.tick(0.05);
    await residents.settled();
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(requests.length, 1, 'one real decision is prepared');
    assert.ok(
      (requests[0].observation as { choices?: unknown[] }).choices?.length,
      'retain executable choices',
    );
    assert.ok(beats >= 2);
    assert.ok(
      maximum < 100,
      `decision preparation blocked movement heartbeat for ${maximum.toFixed(1)} ms`,
    );
  } finally {
    clearInterval(heartbeat);
    residents.close();
    store.close();
  }
});

import { ChoicePreparation, type ChoiceContext } from '../src/server/npc/choice-preparation';
import { addPlayer } from '../src/shared/simulation';
import type { ResidentState } from '../src/server/npc/memory';
import { savingChoices } from '../src/server/npc/ambitions';
import { supplyChoices } from '../src/server/npc/survival';
import { adaptiveChoices } from '../src/server/npc/adaptive';
import { economicMenu } from '../src/server/npc/enterprise';
import { preferChoices } from '../src/server/npc/preferences';
import { focusCommitments } from '../src/server/npc/commitments';
import { learnedChoices } from '../src/server/npc/agenda';
import { planQuotes } from '../src/server/npc/execution';
import type { Worker } from 'node:worker_threads';

function choiceFixture() {
  const w = createWorld('worker', 'Worker', 'owner');
  const p = addPlayer(w, 'planner', 'Planner');
  p.cash = 500000;
  p.hunger = p.thirst = 0;
  const state = {
    playerId: p.id,
    world: w.id,
    name: p.name,
    personality: 'Practical',
    notebook: '',
    intent: '',
    plan: [],
    index: 0,
    experiences: [],
  } as unknown as ResidentState;
  const context: ChoiceContext = {
    before: [],
    after: [],
    includeGoals: true,
    preference: 'trader',
    busyVisit: false,
  };
  return { w, p, state, context };
}
test('background choices exactly preserve the snapshot menu and reject overlapping jobs', async () => {
  const { w, p, state, context } = choiceFixture();
  const preparation = new ChoicePreparation();
  const before = JSON.stringify({ w, state });
  const expected = learnedChoices(
    state,
    economicMenu(
      w,
      p,
      preferChoices(
        focusCommitments(w, p, state, [
          ...savingChoices(w, p, state),
          ...supplyChoices(w, p, state),
          ...adaptiveChoices(w, p, state),
        ]),
        context.preference,
        p.job,
      ),
      context.preference,
      context.busyVisit,
      state,
    ),
  ).map((c) => ({ ...c, tradeQuotes: planQuotes(w, c.plan) }));
  assert.equal(
    JSON.stringify({ w, state }),
    before,
    'the reference dry-run leaves live state alone',
  );
  try {
    const saved = preparation.run(w, p, state, new AbortController().signal, context);
    await assert.rejects(
      preparation.run(w, p, state, new AbortController().signal, context),
      /already busy/,
    );
    assert.deepEqual(await saved, expected);
    assert.equal(JSON.stringify({ w, state }), before);
  } finally {
    await preparation.close();
  }
});

test('an idle choice-worker exit is replaced without losing the next job', async () => {
  const { w, p, state, context } = choiceFixture();
  const preparation = new ChoicePreparation();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const expected = await preparation.run(w, p, state, new AbortController().signal, context);
    await (preparation as unknown as { worker: Worker }).worker.terminate();
    const next = preparation.run(w, p, state, new AbortController().signal, context);
    const result = await Promise.race([
      next,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(Error('Replacement worker did not finish')), 3000);
      }),
    ]);
    assert.deepEqual(result, expected);
  } finally {
    if (timer) clearTimeout(timer);
    await preparation.close();
  }
});

async function waitForPreparation(residents: Residents) {
  const preparation = (residents as unknown as { choicePreparation: ChoicePreparation })
    .choicePreparation;
  for (let i = 0; i < 100 && !(preparation as unknown as { worker?: Worker }).worker; i++)
    await new Promise((r) => setTimeout(r, 5));
  assert.ok((preparation as unknown as { worker?: Worker }).worker, 'actual worker dispatched');
  return preparation;
}
for (const change of ['terrain', 'character'] as const)
  test(`discard ${change} changes during preparation before charging a decision`, async () => {
    const { store, w, p, residents, requests } = controllerFixture();
    try {
      residents.tick(0.05);
      await waitForPreparation(residents);
      if (change === 'terrain') w.revision++;
      else p.deaths++;
      await residents.settled();
      assert.equal(requests.length, 0);
      assert.equal(store.db.prepare('SELECT count(*) n FROM npc_calls').get()!.n, 0);
      residents.tick(0.05, Date.now() + 60001);
      await residents.settled();
      assert.equal(requests.length, 1, 'fresh facts can be prepared on the next turn');
    } finally {
      residents.close();
      store.close();
    }
  });

test('closing during preparation cancels before a model is charged', async () => {
  const { store, residents, requests } = controllerFixture();
  try {
    residents.tick(0.05);
    const preparation = await waitForPreparation(residents);
    const worker = (preparation as unknown as { worker: Worker }).worker;
    residents.close();
    await preparation.close();
    assert.equal(worker.threadId, -1);
    assert.equal(requests.length, 0);
    assert.equal(store.db.prepare('SELECT count(*) n FROM npc_calls').get()!.n, 0);
  } finally {
    store.close();
  }
});

test('failed preparation charges no model call and can retry', async (t) => {
  const { store, residents, requests } = controllerFixture();
  t.mock.method(console, 'error', () => {});
  try {
    residents.tick(0.05);
    const preparation = await waitForPreparation(residents);
    await (preparation as unknown as { worker: Worker }).worker.terminate();
    await residents.settled();
    assert.equal(requests.length, 0);
    assert.equal(store.db.prepare('SELECT count(*) n FROM npc_calls').get()!.n, 0);
    residents.tick(0.05, Date.now() + 60001);
    await residents.settled();
    assert.equal(requests.length, 1);
  } finally {
    residents.close();
    store.close();
  }
});

test('operator pause during preparation prevents paid dispatch without another tick', async () => {
  const { store, residents, requests } = controllerFixture();
  try {
    residents.tick(0.05);
    await waitForPreparation(residents);
    residents.memory.pause('planner', true);
    await residents.settled();
    assert.equal(requests.length, 0);
    assert.equal(store.db.prepare('SELECT count(*) n FROM npc_calls').get()!.n, 0);
  } finally {
    residents.close();
    store.close();
  }
});

test('background observation preserves current facts and only the selected resident memory', async () => {
  const { store, w, p, residents } = controllerFixture();
  const state = (residents as any).residents[0].state as ResidentState;
  const preparation = new ChoicePreparation();
  try {
    residents.memory.append('planner', w.time, 'test', { text: 'My own journal' });
    residents.memory.append('other-resident', w.time, 'test', { text: 'PRIVATE OTHER JOURNAL' });
    const { observe } = await import('../src/server/npc/observation');
    const expected = structuredClone(observe(w, p, state, residents.memory, 'planner'));
    const before = JSON.stringify({ w, state });
    const actual = await preparation.observe(
      w,
      p,
      state,
      residents.memory,
      'planner',
      new AbortController().signal,
    );
    assert.deepEqual(actual, expected);
    assert.ok(JSON.stringify(actual).includes('My own journal'));
    assert.ok(!JSON.stringify(actual).includes('PRIVATE OTHER JOURNAL'));
    assert.equal(JSON.stringify({ w, state }), before);
  } finally {
    await preparation.close();
    residents.close();
    store.close();
  }
});

test('a new private conversation during observation is prepared again before dispatch', async (t) => {
  const { store, residents, requests } = controllerFixture();
  const resident = (residents as any).residents[0];
  const preparation = (residents as any).choicePreparation as ChoicePreparation;
  const original = preparation.observe.bind(preparation);
  let changed = false;
  t.mock.method(preparation, 'observe', (...args: Parameters<typeof preparation.observe>) => {
    const pending = original(...args);
    if (!changed) {
      changed = true;
      Object.assign(resident.state, {
        conversationId: 42,
        helpQuestion: 'A different private question',
        questionFrom: 'another-human',
        replyTo: 'another-human',
      });
    }
    return pending;
  });
  try {
    residents.tick(0.05);
    await residents.settled();
    assert.equal(requests.length, 0, 'do not send old facts to a new conversation');
    assert.equal(store.db.prepare('SELECT count(*) n FROM npc_calls').get()!.n, 0);
    residents.tick(0.05, Date.now() + 60001);
    await residents.settled();
    assert.equal(requests.length, 1, 'retry with the new conversation');
    assert.equal((requests[0].observation as any).currentConversation.speakerId, 'another-human');
  } finally {
    residents.close();
    store.close();
  }
});
