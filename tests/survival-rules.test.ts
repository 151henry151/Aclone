// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance } from '../src/shared/simulation';
import { skillLesson, catalogueSchema } from '../src/shared/world-catalogue';
import { labourQuote, RELIEF_PAY } from '../src/shared/public-labour';
import { jobTraining } from '../src/server/npc/job-training';
function fixture() {
  const w = createWorld('survival-rules', 'Survival rules', 'owner'),
    p = addPlayer(w, 'owner', 'Owner');
  w.script = '';
  w.settings.hungerRate = w.settings.thirstRate = 0;
  p.cash = 1000000;
  p.online = true;
  return { w, p };
}
const defaults = {
  schoolFirstPrice: 8000,
  schoolLaterPrice: 16000,
  schoolFirstSeconds: 60,
  schoolLaterSeconds: 2400,
  licencesCountSkills: true,
  labourReliefPay: 15000,
  labourReliefMeans: 5000,
  labourReliefCooldown: 1800,
  labourShiftSeconds: 15,
};
test('school and public relief defaults retain current behaviour and missing-key saves fall back without migration', async () => {
  const { w, p } = fixture();
  for (const [k, v] of Object.entries(defaults)) assert.equal((w.settings as any)[k], v, k);
  assert.equal(skillLesson(w, p, 'farmer').price, 8000);
  assert.equal(skillLesson(w, p, 'farmer').seconds, 60);
  p.skills = ['driver'];
  assert.equal(skillLesson(w, p, 'farmer').price, 16000);
  assert.equal(skillLesson(w, p, 'farmer').seconds, 2400);
  p.cash = p.bank = 0;
  assert.equal(labourQuote(w, p).pay, RELIEF_PAY);
  assert.equal(RELIEF_PAY, 15000);
  for (const k of Object.keys(defaults)) delete (w.settings as any)[k];
  const { survivalRules } = await import('../src/shared/survival-rules');
  for (const [k, v] of Object.entries(defaults))
    assert.equal((survivalRules(w.settings) as any)[k], v);
  assert.equal(skillLesson(w, p, 'farmer').price, 16000);
  assert.equal(labourQuote(w, p).pay, 15000);
});
test('world tuition and duration apply to actual learning while catalogue courses retain their overrides', () => {
  const { w, p } = fixture(),
    school = w.buildings.find((b) => b.kind === 'school')!;
  p.x = school.x;
  p.z = school.z;
  act(w, p.id, {
    type: 'settings',
    patch: {
      schoolFirstPrice: 2500,
      schoolFirstSeconds: 2,
      schoolLaterPrice: 5000,
      schoolLaterSeconds: 4,
    },
  });
  let cash = p.cash;
  act(w, p.id, { type: 'learn', building: school.id, skill: 'farmer' });
  assert.equal(p.cash, cash - 2500);
  assert.equal(p.learning!.end, w.time + 2);
  advance(w, 2);
  assert.ok(p.skills.includes('farmer'));
  cash = p.cash;
  act(w, p.id, { type: 'learn', building: school.id, skill: 'miller' });
  assert.equal(p.cash, cash - 5000);
  assert.equal(p.learning!.end, w.time + 4);
  advance(w, 4);
  w.catalogue = catalogueSchema.parse({
    skills: { 'custom:study': { name: 'Study', price: 321, seconds: 7, prerequisites: [] } },
  });
  cash = p.cash;
  act(w, p.id, { type: 'learn', building: school.id, skill: 'custom:study' });
  assert.equal(p.cash, cash - 321);
  assert.equal(p.learning!.end, w.time + 7);
});
test('licence exemption changes only skill-limit accounting and resident training uses the same rule', () => {
  const { w, p } = fixture(),
    school = w.buildings.find((b) => b.kind === 'school')!,
    mill = w.buildings.find((b) => b.kind === 'mill')!;
  p.x = school.x;
  p.z = school.z;
  p.skills = ['driver'];
  w.settings.maxSkills = 1;
  assert.throws(
    () => act(w, p.id, { type: 'learn', building: school.id, skill: 'miller' }),
    /skill limit/,
  );
  assert.equal(jobTraining(w, p, mill), undefined);
  act(w, p.id, {
    type: 'settings',
    patch: { licencesCountSkills: false, schoolLaterPrice: 777, schoolLaterSeconds: 3 },
  });
  const plan = jobTraining(w, p, mill)!;
  assert.ok(plan);
  assert.match(plan.description, /777, 3s/);
  act(w, p.id, { type: 'learn', building: school.id, skill: 'miller' });
  advance(w, 3);
  assert.ok(p.skills.includes('miller'));
  assert.throws(
    () => act(w, p.id, { type: 'learn', building: school.id, skill: 'farmer' }),
    /skill limit/,
  );
  act(w, p.id, { type: 'learn', building: school.id, skill: 'pilot' });
  advance(w, 3);
  assert.ok(p.skills.includes('pilot'));
  act(w, p.id, { type: 'learn', building: school.id, skill: 'captain' });
  advance(w, 3);
  assert.ok(p.skills.includes('captain'));
});
test('relief means, cooldown, payment and labour duration follow world rules and preserve active quotes', () => {
  const { w, p } = fixture(),
    office = w.buildings.find((b) => b.kind === 'workhouse')!;
  p.x = office.x;
  p.z = office.z;
  p.cash = 6000;
  p.bank = 0;
  assert.equal(labourQuote(w, p).relief, false);
  act(w, p.id, {
    type: 'settings',
    patch: {
      labourReliefPay: 4321,
      labourReliefMeans: 7000,
      labourReliefCooldown: 30,
      labourShiftSeconds: 3,
    },
  });
  assert.deepEqual(labourQuote(w, p), { pay: 4321, relief: true });
  const started = w.time;
  act(w, p.id, { type: 'task', task: 'labour', building: office.id });
  assert.equal(p.task!.end, started + 3);
  act(w, p.id, { type: 'settings', patch: { labourReliefPay: 8888, labourShiftSeconds: 6 } });
  advance(w, 2);
  assert.equal(p.cash, 6000);
  advance(w, 1);
  assert.equal(p.cash, 10321);
  assert.equal(p.task, undefined);
  p.cash = 0;
  assert.equal(labourQuote(w, p).relief, false);
  advance(w, 30);
  assert.equal(labourQuote(w, p).pay, 8888);
  act(w, p.id, { type: 'task', task: 'labour', building: office.id });
  assert.equal(p.task!.end, w.time + 6);
});
test('survival school and relief rules validate atomically, appear in the editor and summary, and export with the world', async () => {
  const { w, p } = fixture();
  const { settingsFields } = await import('../src/client/creator-editor'),
    { rulesSummary } = await import('../src/shared/rulesets'),
    { exportDesign, applyDesign } = await import('../src/server/world-design');
  const html = settingsFields(w.settings);
  assert.match(html, /<legend>Survival and needs<\/legend>/);
  for (const k of Object.keys(defaults)) assert.ok(html.includes(`name="${k}"`), k);
  for (const k of Object.keys(defaults)) delete (w.settings as any)[k];
  act(w, p.id, {
    type: 'settings',
    patch: {
      schoolFirstPrice: 1234,
      schoolFirstSeconds: 17,
      licencesCountSkills: false,
      labourReliefPay: 6789,
      labourShiftSeconds: 7,
    },
  });
  for (const patch of [
    { schoolFirstPrice: -1 },
    { schoolFirstSeconds: 0 },
    { labourShiftSeconds: 0.2 },
    { licencesCountSkills: 1 },
    { labourReliefCooldown: -1 },
  ]) {
    const before = structuredClone(w.settings);
    assert.throws(() =>
      act(w, p.id, { type: 'settings', patch: { schoolLaterPrice: 123, ...patch } }),
    );
    assert.deepEqual(w.settings, before);
  }
  assert.match(rulesSummary(w), /1234/);
  assert.match(rulesSummary(w), /6789/);
  assert.match(rulesSummary(w), /7-second/);
  const dest = createWorld('survival-destination', 'Destination', 'owner');
  applyDesign(dest, exportDesign(w));
  assert.equal(dest.settings.schoolFirstPrice, 1234);
  assert.equal(dest.settings.licencesCountSkills, false);
  assert.equal(dest.settings.labourShiftSeconds, 7);
});

test('resident character facts and live briefings quote configured school and relief rules', async () => {
  const { w, p } = fixture();
  act(w, p.id, {
    type: 'settings',
    patch: {
      schoolFirstPrice: 1234,
      schoolFirstSeconds: 17,
      schoolLaterPrice: 4321,
      schoolLaterSeconds: 19,
      labourShiftSeconds: 7,
      labourReliefMeans: 6000,
      labourReliefPay: 2222,
      labourReliefCooldown: 300,
    },
  });
  const { characterFacts } = await import('../src/server/npc/character-facts'),
    { lifeBriefing } = await import('../src/server/npc/strategy');
  assert.deepEqual(characterFacts(w, p).nextCourse, { costDenarii: 12.34, seconds: 17 });
  const brief = lifeBriefing(w, p);
  assert.equal(brief.economy.training.tuition, 1234);
  assert.equal(brief.economy.training.seconds, 17);
  assert.match(brief.economy.labour, /7-second/);
  assert.match(brief.economy.labour, /6000.*2222.*300 seconds/);
  p.skills = ['driver'];
  assert.deepEqual(characterFacts(w, p).nextCourse, { costDenarii: 43.21, seconds: 19 });
});

test('resident school choices retain their existing one-minute check-in and shorten it for shorter configured lessons', async () => {
  const { w, p } = fixture();
  p.skills = ['driver'];
  const { gameplayChoices } = await import('../src/server/npc/farmer');
  const state = {
    playerId: p.id,
    world: w.id,
    name: p.name,
    personality: 'Practical',
    notebook: '',
    intent: 'Study',
    cursor: 0,
    nextAt: 0,
    plan: [],
    index: 0,
    repeats: 0,
    until: 0,
    waitUntil: 0,
    status: '',
    errors: 0,
  };
  const wait = () =>
    gameplayChoices(w, p, state, 'general')
      .find((c) => c.description.startsWith('Learn miller '))!
      .plan.find((s) => s.kind === 'wait');
  assert.deepEqual(wait(), { kind: 'wait', seconds: 60 });
  act(w, p.id, { type: 'settings', patch: { schoolLaterSeconds: 7 } });
  assert.deepEqual(wait(), { kind: 'wait', seconds: 7 });
});
