// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance } from '../src/shared/simulation.ts';
import { labourQuote, labourReward, RELIEF_PAY } from '../src/shared/public-labour.ts';
import { prepareLabourRules } from '../src/server/labour-rules.ts';
import { economicMenu } from '../src/server/npc/enterprise.ts';
import type { FarmerChoice } from '../src/server/npc/farmer.ts';

const shift = (w: ReturnType<typeof createWorld>, id: string) => {
  const office = w.buildings.find((b) => b.kind === 'workhouse')!;
  const p = w.players[id];
  p.x = office.x;
  p.z = office.z;
  act(w, id, { type: 'task', building: office.id, task: 'labour' });
  advance(w, 15);
};

test('a new world pays 12d for the first eight shifts, then less, until a break or other work', () => {
  const w = createWorld('labour', 'Labour', 'owner'),
    p = addPlayer(w, 'p', 'P');
  p.cash = 10000;
  assert.equal(w.settings.labourShiftPay, 1200);
  for (let i = 0; i < 8; i++) {
    assert.equal(labourReward(w, p), 1200, `shift ${i + 1} is full pay`);
    shift(w, p.id);
  }
  assert.equal(labourReward(w, p), 800);
  shift(w, p.id);
  assert.equal(labourReward(w, p), 600);
  shift(w, p.id);
  assert.equal(labourReward(w, p), 400);
  shift(w, p.id);
  assert.equal(labourReward(w, p), 300);
  w.time += 600;
  assert.equal(labourReward(w, p), 1200, 'ten minutes restores full pay');
  shift(w, p.id);
  shift(w, p.id);
  p.skills.push('miller');
  const mill = w.buildings.find((b) => b.kind === 'mill' && b.owner !== p.id)!;
  p.x = mill.x;
  p.z = mill.z;
  act(w, p.id, { type: 'job', building: mill.id });
  assert.equal(labourReward(w, p), 1200, 'taking a job restores full pay');
});

test('ordinary labour stops at the daily cap and meal relief does not count toward it', () => {
  const w = createWorld('cap', 'Cap', 'owner'),
    p = addPlayer(w, 'p', 'P');
  p.cash = 10000;
  p.labourDay = 0;
  p.labourEarned = 19500;
  assert.equal(labourReward(w, p), 500);
  shift(w, p.id);
  assert.equal(labourQuote(w, p).reason, 'daily labour cap reached');
  assert.equal(labourReward(w, p), 0);
  assert.throws(() => shift(w, p.id), /daily labour cap/);
  p.cash = 0;
  p.bank = 0;
  assert.equal(labourReward(w, p), RELIEF_PAY);
  shift(w, p.id);
  assert.equal(p.cash, RELIEF_PAY);
  assert.equal(labourReward(w, p), 0, 'relief does not raise the ordinary cap');
});

test('an ordinary shift does not start the relief cooldown', () => {
  const w = createWorld('cooldown', 'Cooldown', 'owner'),
    p = addPlayer(w, 'p', 'P');
  p.cash = 10000;
  shift(w, p.id);
  p.cash = 0;
  p.bank = 0;
  assert.equal(labourReward(w, p), RELIEF_PAY);
});

test('Puddlewick adopts 12d once and other worlds keep their own rate', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  w.settings.labourShiftPay = 100;
  assert.equal(prepareLabourRules(w), true);
  assert.equal(w.settings.labourShiftPay, 1200);
  assert.equal(w.settings.labourDailyCap, 20000);
  w.settings.labourShiftPay = 500;
  assert.equal(prepareLabourRules(w), false);
  assert.equal(w.settings.labourShiftPay, 500);
  const other = createWorld('other', 'Other', 'owner');
  other.settings.labourShiftPay = 400;
  assert.equal(prepareLabourRules(other), false);
  assert.equal(other.settings.labourShiftPay, 400);
  delete other.settings.labourShiftPay;
  assert.equal(prepareLabourRules(other), true);
  assert.equal(other.settings.labourShiftPay, 100);
});

test('a resident who can afford a meal ranks work above another Odd Jobs shift', () => {
  const w = createWorld('menu', 'Menu', 'owner'),
    p = addPlayer(w, 'p', 'P');
  const office = w.buildings.find((b) => b.kind === 'workhouse')!;
  const choices = (cash: number): FarmerChoice[] => {
    p.cash = cash;
    p.bank = 0;
    return [
      {
        id: 'gather',
        description: 'Gather gravel with my shovel and sell it.',
        plan: [{ kind: 'travel', destination: office.id }],
      },
      {
        id: 'labour',
        description: `Earn ${labourReward(w, p)} cash with a 15-second public labour shift at ${office.name}.`,
        plan: [
          { kind: 'travel', destination: office.id },
          { kind: 'act', action: { type: 'task', building: office.id, task: 'labour' } },
        ],
      },
    ];
  };
  const broke = economicMenu(w, p, choices(0), 'generalist', true);
  assert.ok(broke.findIndex((c) => c.id === 'labour') < broke.findIndex((c) => c.id === 'gather'));
  const fed = economicMenu(w, p, choices(20000), 'generalist', true);
  assert.ok(fed.findIndex((c) => c.id === 'gather') < fed.findIndex((c) => c.id === 'labour'));
});
