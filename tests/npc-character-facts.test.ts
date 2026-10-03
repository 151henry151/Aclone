// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorld,
  addPlayer,
  makeBuilding,
  advance,
  act,
  say,
} from '../src/shared/simulation.ts';
import { observe } from '../src/server/npc/observation.ts';
import { characterRevision } from '../src/server/npc/character-facts.ts';
import {
  conversationView,
  rememberConversation,
  decisionAgenda,
} from '../src/server/npc/agenda.ts';
import { NpcMemory, type ResidentState } from '../src/server/npc/memory.ts';
import { Store } from '../src/server/store.ts';
import { Universe } from '../src/server/universe.ts';
import { Residents } from '../src/server/npc/residents.ts';
import { npcConfigSchema } from '../src/server/npc/config.ts';
import {
  recordCommitment,
  commitmentChoices,
  refreshEmployment,
} from '../src/server/npc/commitments.ts';
const idle = {
  intent: 'Rest',
  notebook: '',
  speech: null,
  plan: [{ kind: 'wait' as const, seconds: 60 }],
  repeat: 1,
  reconsiderSeconds: 60,
};

test('a resurrected resident sees actual skills before school catalogues and unverified memory', () => {
  const store = new Store(':memory:');
  try {
    const w = createWorld('puddlewick', 'Test', 'server'),
      p = addPlayer(w, 'mabel', 'Mabel');
    const s = {
      world: w.id,
      playerId: p.id,
      observedDeaths: 2,
      plan: [],
      index: 0,
      intent: 'Rest',
      notebook: 'I am a miller',
      agenda: {
        contacts: [
          {
            world: w.id,
            speakerId: 'hank',
            private: false,
            summary: 'I am already qualified as a miller',
            updatedAt: 1,
          },
        ],
        preferences: [],
      },
    } as unknown as ResidentState;
    p.skills = [];
    p.deaths = 2;
    const view = conversationView(
      observe(w, p, s, new NpcMemory(store), 'mabel'),
      s,
      'hank',
      false,
    );
    assert.deepEqual(view.characterFacts.acquiredSkills, []);
    assert.match(view.characterFacts.qualificationSummary, /NO qualifications/);
    assert.deepEqual(view.characterFacts.nextCourse, { costDenarii: 80, seconds: 60 });
    assert.equal(view.qualifications, undefined);
    assert.ok(view.availableSchoolSkills.skills.includes('miller'));
    // A question about the mill gets an exact, feasible training request instead
    // of making the dialogue model invent prerequisites or building IDs.
    s.helpQuestion = 'Please train and work at the mill';
    const workView = observe(w, p, s, new NpcMemory(store), 'mabel');
    const offer = workView.employmentOptions.find((o) => o.requiredSkill === 'miller')!;
    assert.equal(offer.qualifiedNow, false);
    assert.equal(offer.needsTraining, true);
    assert.equal(offer.trainingAndEmploymentBlocker, null);
    assert.equal(offer.requestIfAgreeingToTrainAndWork.employment.train, true);
    assert.equal(offer.requestIfAgreeingToTrainAndWork.employment.building, 'b6');
    assert.equal(view.notebook, '');
    assert.doesNotMatch(JSON.stringify(view.relationship), /already qualified/);
    assert.equal(
      s.agenda!.contacts[0].summary,
      'I am already qualified as a miller',
      'archive is retained',
    );
    rememberConversation(
      s,
      { world: w.id, speakerId: 'hank', private: false },
      'Hank offered work; I agreed to learn milling.',
      null,
      2,
    );
    assert.match(conversationView(view, s, 'hank', false).notebook, /offered work/);
    s.observedDeaths = 3;
    assert.equal(conversationView(view, s, 'hank', false).notebook, '');
    assert.deepEqual(decisionAgenda(s).relationships, []);
    const revision = characterRevision(p);
    p.hunger += 100;
    p.cash += 100;
    p.x += 1;
    assert.equal(characterRevision(p), revision, 'ordinary ticks do not invalidate chat');
    p.skills = ['miller'];
    assert.notEqual(characterRevision(p), revision);
  } finally {
    store.close();
  }
});

test('clarifying training replaces blocked copies and retrains after death before real employment', () => {
  const w = createWorld('puddlewick', 'Test', 'server'),
    p = addPlayer(w, 'mabel', 'Mabel');
  const school = makeBuilding('school', 'school', 0, 0),
    mill = makeBuilding('mill', 'mill', 40, 0);
  w.buildings = [school, mill];
  w.settings.hungerRate = w.settings.thirstRate = 0;
  p.skills = ['miller'];
  p.online = true;
  p.job = mill.id;
  mill.employees = [p.id];
  p.age = w.settings.maxAge;
  advance(w, 1);
  assert.equal(p.deaths, 1);
  assert.deepEqual(p.skills, []);
  assert.equal(p.job, undefined);
  const s = { commitments: [] } as unknown as ResidentState;
  const request = {
    summary: 'Take the mill job',
    cancel: false,
    delivery: null,
    employment: { building: mill.id, train: false },
  };
  for (let i = 0; i < 3; i++) {
    assert.ok(
      recordCommitment(
        s,
        { ...request, summary: `Take the job ${i}` },
        `old-${i}`,
        'hank',
        w,
        null,
      ),
    );
    refreshEmployment(w, p, s);
  }
  assert.equal(s.commitments!.filter((c) => c.status === 'blocked').length, 1);
  assert.ok(
    recordCommitment(
      s,
      {
        ...request,
        summary: 'Train then take the job',
        employment: { building: mill.id, train: true },
      },
      'new',
      'hank',
      w,
      null,
    ),
  );
  const plan = commitmentChoices(w, p, s)[0].plan;
  const cash = p.cash;
  for (const step of plan) {
    if (step.kind === 'travel') {
      const b = w.buildings.find((b) => b.id === step.destination)!;
      p.x = b.x;
      p.z = b.z;
    } else if (step.kind === 'act') act(w, p.id, step.action);
  }
  assert.equal(p.learning?.skill, 'miller');
  assert.equal(p.cash, cash - 8000);
  assert.equal(p.learning!.end - w.time, 60);
  advance(w, 60);
  for (const step of commitmentChoices(w, p, s)[0].plan) {
    if (step.kind === 'travel') {
      const b = w.buildings.find((b) => b.id === step.destination)!;
      p.x = b.x;
      p.z = b.z;
    } else if (step.kind === 'act') act(w, p.id, step.action);
  }
  refreshEmployment(w, p, s);
  assert.equal(p.job, mill.id);
  assert.ok(mill.employees.includes(p.id));
  assert.equal(s.commitments!.at(-1)!.status, 'completed');
  assert.ok(s.commitments!.slice(0, -1).every((c) => c.status === 'cancelled'));
});

for (const tickDuringReply of [false, true])
  test(`death while thinking discards previous-life speech and retries with live facts (tick=${tickDuringReply})`, async (t) => {
    let now = Date.now(),
      release!: () => void,
      calls = 0;
    t.mock.method(Date, 'now', () => now);
    const store = new Store(':memory:'),
      w = createWorld('puddlewick', 'Test', 'server');
    w.settings.hungerRate = w.settings.thirstRate = 0;
    const r = new Residents(
      store,
      new Universe(store),
      new Map([[w.id, w]]),
      [
        {
          config: npcConfigSchema.parse({
            id: 'mabel',
            provider: 'jev',
            presence: 'always',
            intervalMs: 5000,
          }),
          brain: {
            async decide() {
              return { decision: idle, inputTokens: 1, outputTokens: 0 };
            },
          },
          dialogue: {
            rates: { inputUsdPerMillion: 0.4, outputUsdPerMillion: 1.6 },
            brain: {
              async decide(req: any) {
                calls++;
                if (calls === 1)
                  await new Promise<void>((resolve) => {
                    release = resolve;
                  });
                else assert.deepEqual(req.observation.characterFacts.acquiredSkills, []);
                return {
                  decision: {
                    ...idle,
                    speech: {
                      text:
                        calls === 1
                          ? 'STALE: I am qualified as a miller.'
                          : 'I need to learn milling again.',
                      to: null,
                    },
                  },
                  inputTokens: 1,
                  outputTokens: 1,
                };
              },
            },
          },
        },
      ],
      { dailyUsd: 2 },
    );
    try {
      const p = w.players[r.memory.load('mabel')!.playerId];
      p.skills = ['miller'];
      addPlayer(w, 'human', 'Hank');
      say(w, 'Hank', 'Mabel, are you a miller?', 'chat');
      r.capture(w);
      r.tick(0.5, now);
      for (let i = 0; i < 10 && !release; i++)
        await new Promise((resolve) => setImmediate(resolve));
      assert.ok(release);
      p.age = w.settings.maxAge;
      advance(w, 1);
      if (tickDuringReply) r.tick(0.5, ++now);
      release();
      await r.settled();
      assert.ok(!w.messages.some((m) => m.text.includes('STALE')));
      now += 6000;
      r.tick(0.5, now);
      await r.settled();
      assert.ok(w.messages.some((m) => m.text === 'I need to learn milling again.'));
      assert.equal(calls, 2);
      assert.equal(p.online, true);
    } finally {
      r.close();
      store.close();
    }
  });
