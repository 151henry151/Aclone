// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act } from '../src/shared/simulation';
import { economyRules } from '../src/shared/economy-rules';
import { giftAmount } from '../src/shared/player-aid';
import { ownerLivingDraw } from '../src/server/npc/business-policy';
import { fundProject } from '../src/server/npc/project-funding';
import { stepSchema } from '../src/server/npc/decision';
const defaults = { maximumMoneyGift: 100000000, cashTransferLimit: 10000000 };
function setup() {
  const w = createWorld('transfers', 'Transfers', 'a'),
    p = addPlayer(w, 'a', 'Ada'),
    q = addPlayer(w, 'b', 'Bo');
  const bank = makeBuilding('bank', 'bank', 0, 0),
    business = makeBuilding('shop', 'market', 0, 0);
  business.owner = p.id;
  business.government = false;
  business.investment = 100000;
  w.buildings = [bank, business];
  w.script = '';
  for (const r of [p, q])
    Object.assign(r, { x: 0, y: 0, z: 0, online: true, cash: 100000, bank: 100000 });
  return { w, p, q, bank, business };
}
test('money transfer defaults and missing save fields preserve the original limits', () => {
  const { w } = setup();
  for (const [key, value] of Object.entries(defaults))
    assert.equal((w.settings as any)[key], value);
  for (const key of Object.keys(defaults)) delete (w.settings as any)[key];
  for (const [key, value] of Object.entries(defaults))
    assert.equal((economyRules(w.settings) as any)[key], value);
});
test('configured gift cap governs exact decimal input and atomic cash transfers', () => {
  const { w, p, q } = setup();
  act(w, p.id, { type: 'settings', patch: { maximumMoneyGift: 2575 } });
  assert.equal(giftAmount('25.75', w), 2575);
  for (const text of ['25.76', '1.001', '1e2', '0']) assert.throws(() => giftAmount(text, w));
  const before = JSON.stringify(w);
  assert.throws(() => act(w, p.id, { type: 'giveMoney', player: q.id, amount: 2576 }));
  assert.equal(JSON.stringify(w), before);
  act(w, p.id, { type: 'giveMoney', player: q.id, amount: 2575 });
  assert.equal(p.cash, 97425);
  assert.equal(q.cash, 102575);
  act(w, p.id, { type: 'settings', patch: { maximumMoneyGift: 100000001 } });
  p.cash = 100000001;
  act(w, p.id, { type: 'giveMoney', player: q.id, amount: 100000001 });
  assert.equal(p.cash, 0);
});
test('bank and owner transfers enforce the same configured cap in both directions', () => {
  for (const type of ['bank', 'investment'])
    for (const direction of ['deposit', 'withdraw']) {
      const { w, p, bank, business } = setup();
      act(w, p.id, { type: 'settings', patch: { cashTransferLimit: 321 } });
      const building = (type === 'bank' ? bank : business).id,
        before = JSON.stringify(w);
      assert.throws(() => act(w, p.id, { type, building, direction, amount: 322 }));
      assert.equal(JSON.stringify(w), before);
      act(w, p.id, { type, building, direction, amount: 321 });
      assert.equal(p.cash, 100000 + (direction === 'deposit' ? -321 : 321));
      assert.equal(
        type === 'bank' ? p.bank : business.investment,
        100000 + (direction === 'deposit' ? 321 : -321),
      );
    }
});
test('outside claims survive lower transfer limits and enforce caps on deposits and collection', () => {
  const { w, p, business } = setup();
  business.owner = 'other';
  business.investment = 0;
  act(w, p.id, { type: 'settings', patch: { cashTransferLimit: 500 } });
  act(w, p.id, { type: 'investment', building: business.id, direction: 'deposit', amount: 500 });
  const claim = business.stakes![0].claim;
  business.investment += 10000;
  act(w, p.id, { type: 'settings', patch: { cashTransferLimit: 100 } });
  assert.equal(business.stakes![0].claim, claim);
  for (const direction of ['deposit', 'withdraw']) {
    const before = JSON.stringify(w);
    assert.throws(() =>
      act(w, p.id, { type: 'investment', building: business.id, direction, amount: 101 }),
    );
    assert.equal(JSON.stringify(w), before);
  }
  act(w, p.id, { type: 'investment', building: business.id, direction: 'withdraw', amount: 100 });
  assert.equal(business.stakes![0].paid, 100);
});
test('resident draws and project funding honour low and raised transfer caps', () => {
  const { w, p, business } = setup();
  p.cash = 0;
  p.bank = 50000000;
  act(w, p.id, { type: 'settings', patch: { cashTransferLimit: 123 } });
  assert.equal(ownerLivingDraw(w, p, business), 123);
  business.owner = 'other';
  assert.equal(
    fundProject(w, p, 124, () => [{ kind: 'wait', seconds: 1 }]),
    undefined,
  );
  act(w, p.id, { type: 'settings', patch: { cashTransferLimit: 20000000 } });
  const plan = fundProject(w, p, 15000000, () => [{ kind: 'wait', seconds: 1 }]);
  assert.ok(plan);
  const transfer = plan.find((s) => s.kind === 'act' && s.action.type === 'bank');
  assert.ok(transfer && transfer.kind === 'act' && transfer.action.type === 'bank');
  assert.equal(transfer.action.amount, 15000000);
  assert.ok(stepSchema.safeParse(transfer).success);
});
test('transfer rules validate atomically, appear in editor/summary and travel with designs', async () => {
  const { w, p } = setup();
  const { settingsFields } = await import('../src/client/creator-editor');
  const { rulesSummary } = await import('../src/shared/rulesets');
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  for (const key of Object.keys(defaults)) assert.ok(settingsFields().includes(`name="${key}"`));
  for (const patch of [
    { maximumMoneyGift: 0 },
    { cashTransferLimit: 1.1 },
    { maximumMoneyGift: 1000000001 },
  ]) {
    const before = structuredClone(w.settings);
    assert.throws(() => act(w, p.id, { type: 'settings', patch }));
    assert.deepEqual(w.settings, before);
  }
  act(w, p.id, {
    type: 'settings',
    patch: { maximumMoneyGift: 987654321, cashTransferLimit: 123456789 },
  });
  const summary = rulesSummary(w);
  assert.ok(summary.includes('987654321'));
  assert.ok(summary.includes('123456789'));
  const dest = createWorld('dest', 'Dest', 'a');
  applyDesign(dest, exportDesign(w));
  for (const key of Object.keys(defaults))
    assert.equal((dest.settings as any)[key], (w.settings as any)[key]);
});
