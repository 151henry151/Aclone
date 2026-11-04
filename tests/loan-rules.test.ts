// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act } from '../src/shared/simulation';
import { loanQuote, creditProfile } from '../src/shared/loans';
import { Store } from '../src/server/store';
const defaults = {
  loanPersonalBaseApr: 10,
  loanPersonalAprSpread: 18,
  loanMortgageBaseApr: 6,
  loanMortgageAprSpread: 8,
  loanRateScoreSpan: 350,
  loanPersonalMinimumScore: 540,
  loanMortgageMinimumScore: 500,
  loanTerms: '6,12,24,36,60',
  loanMaximumActive: 3,
  loanMortgageLtv: 0.75,
};
function setup() {
  const w = createWorld('loans', 'Loans', 'owner'),
    p = addPlayer(w, 'owner', 'Owner');
  const bank = makeBuilding('bank', 'bank', 0, 0),
    home = makeBuilding('home', 'home', 30, 0);
  home.owner = p.id;
  bank.investment = 2000000;
  w.buildings = [bank, home];
  Object.assign(p, { x: 0, z: 0, cash: 1000000, bank: 200000 });
  const edit = (patch: Record<string, unknown>) => act(w, p.id, { type: 'settings', patch });
  const borrow = (months = 12) => {
    const q = loanQuote(w, p, bank, 10000, months);
    assert.ok(q.approved, q.reasons.join(' '));
    act(w, p.id, {
      type: 'loan',
      building: bank.id,
      operation: 'borrow',
      amount: 10000,
      months,
      apr: q.apr,
      payment: q.payment,
      accepted: true,
    });
    return p.loans!.at(-1)!;
  };
  return { w, p, bank, home, edit, borrow };
}
test('loan defaults preserve exact quotes and legacy missing-field fallback', () => {
  const { w, p, bank, home } = setup();
  for (const [k, v] of Object.entries(defaults)) assert.equal((w.settings as any)[k], v);
  const personal = loanQuote(w, p, bank, 10000, 12),
    mortgage = loanQuote(w, p, bank, 10000, 12, home.id);
  const score = creditProfile(w, p).score;
  assert.equal(personal.apr, Math.round((0.1 + ((850 - score) / 350) * 0.18) * 10000) / 10000);
  assert.equal(mortgage.apr, Math.round((0.06 + ((850 - score) / 350) * 0.08) * 10000) / 10000);
  for (const k of Object.keys(defaults)) delete (w.settings as any)[k];
  assert.deepEqual(loanQuote(w, p, bank, 10000, 12), personal);
  assert.deepEqual(loanQuote(w, p, bank, 10000, 12, home.id), mortgage);
});
test('custom rates, offered terms, eligibility and LTV govern actual quotes', () => {
  const { w, p, bank, home, edit } = setup();
  edit({
    loanPersonalBaseApr: 0,
    loanPersonalAprSpread: 0,
    loanMortgageBaseApr: 2,
    loanMortgageAprSpread: 4,
    loanRateScoreSpan: 700,
    loanTerms: '3,9',
    loanMortgageLtv: 0.25,
  });
  const q = loanQuote(w, p, bank, 9000, 3);
  assert.ok(q.approved, q.reasons.join(' '));
  assert.equal(q.apr, 0);
  assert.equal(q.payment, 3000);
  assert.match(loanQuote(w, p, bank, 9000, 12).reasons.join(' '), /3, 9/);
  const secured = loanQuote(w, p, bank, 1000, 9, home.id);
  assert.equal(
    secured.apr,
    Math.round((0.02 + ((850 - secured.score) / 700) * 0.04) * 10000) / 10000,
  );
  const base = setup(),
    defaultLimit = loanQuote(base.w, base.p, base.bank, 1000, 12, base.home.id).limit;
  assert.equal(secured.limit, Math.floor(defaultLimit / 3));
  assert.ok(!loanQuote(w, p, bank, secured.limit + 1, 9, home.id).approved);
  edit({ loanPersonalMinimumScore: 850, loanMortgageMinimumScore: 850 });
  assert.match(loanQuote(w, p, bank, 9000, 3).reasons.join(' '), /Improve repayment/);
  assert.match(loanQuote(w, p, bank, 1000, 9, home.id).reasons.join(' '), /Improve repayment/);
});
test('count rules close new lending without changing signed loans or blocking repayment', () => {
  const { w, p, bank, edit, borrow } = setup();
  edit({ loanMaximumActive: 1 });
  const loan = borrow(),
    signed = structuredClone(loan);
  assert.match(loanQuote(w, p, bank, 10000, 12).reasons.join(' '), /At most 1 active/);
  edit({ loanMaximumActive: 0, loanTerms: '3', loanPersonalBaseApr: 0, loanPersonalAprSpread: 0 });
  assert.deepEqual(loan, signed);
  assert.match(loanQuote(w, p, bank, 10000, 3).reasons.join(' '), /At most 0 active/);
  act(w, p.id, {
    type: 'loan',
    building: bank.id,
    operation: 'repay',
    loan: loan.id,
    amount: 10000,
  });
  assert.equal(loan.status, 'paid');
});
test('changed rate rejects a stale offer atomically and new offers use changed terms', () => {
  const { w, p, bank, edit } = setup();
  const q = loanQuote(w, p, bank, 10000, 12);
  edit({ loanPersonalBaseApr: 1 });
  const before = JSON.stringify(w);
  assert.throws(
    () =>
      act(w, p.id, {
        type: 'loan',
        building: bank.id,
        operation: 'borrow',
        amount: 10000,
        months: 12,
        apr: q.apr,
        payment: q.payment,
        accepted: true,
      }),
    /terms changed/,
  );
  assert.equal(JSON.stringify(w), before);
  assert.notEqual(loanQuote(w, p, bank, 10000, 12).apr, q.apr);
});
test('loan settings reject malformed terms and bounds without partial changes', () => {
  const { w, edit } = setup();
  for (const patch of [
    { loanMaximumActive: 1.5 },
    { loanMaximumActive: 101 },
    { loanMortgageLtv: 1.01 },
    { loanPersonalBaseApr: -1 },
    { loanMortgageAprSpread: 101 },
    { loanRateScoreSpan: 0 },
    { loanPersonalMinimumScore: 299 },
    ...['', '0', '121', '6,6', '12,6', '3.5', '3,abc', '3,'].map((loanTerms) => ({ loanTerms })),
  ]) {
    const before = JSON.stringify(w);
    assert.throws(() => edit(patch));
    assert.equal(JSON.stringify(w), before);
  }
  edit({ loanTerms: '1,120', loanMaximumActive: 0, loanMortgageLtv: 0 });
});
test('loan rules appear in creation, summary, portable designs and saved loan state', async () => {
  const { w, p, bank, home, edit } = setup();
  const q = loanQuote(w, p, bank, 10000, 12, home.id);
  assert.ok(q.approved, q.reasons.join(' '));
  act(w, p.id, {
    type: 'loan',
    building: bank.id,
    operation: 'borrow',
    amount: 10000,
    months: 12,
    collateral: home.id,
    apr: q.apr,
    payment: q.payment,
    accepted: true,
  });
  const l = structuredClone(p.loans![0]),
    lien = structuredClone(home.lien);
  const { settingsFields } = await import('../src/client/creator-editor');
  const { rulesSummary } = await import('../src/shared/rulesets');
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  for (const key of Object.keys(defaults)) assert.ok(settingsFields().includes(`name="${key}"`));
  edit({ loanTerms: '3,9', loanMortgageLtv: 0.42, loanMaximumActive: 7 });
  for (const text of ['3,9', '42%', '7 active']) assert.ok(rulesSummary(w).includes(text), text);
  const dest = createWorld('dest', 'Dest', 'owner');
  applyDesign(dest, exportDesign(w));
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world;
    for (const key of Object.keys(defaults)) {
      assert.equal((dest.settings as any)[key], (w.settings as any)[key]);
      assert.equal((loaded.settings as any)[key], (w.settings as any)[key]);
    }
    assert.deepEqual(loaded.players[p.id].loans![0], JSON.parse(JSON.stringify(l)));
    assert.deepEqual(loaded.buildings.find((b) => b.id === home.id)!.lien, lien);
  } finally {
    store.close();
  }
});
test('resident finance plans use offered terms when the usual year is unavailable', async () => {
  const { businessEstimate, enterpriseChoices } = await import('../src/server/npc/enterprise');
  const { productionBudget } = await import('../src/server/npc/business-policy');
  const w = createWorld('loan-plan', 'Town', 'owner'),
    p = addPlayer(w, 'owner', 'Owner');
  w.settings.hungerRate = w.settings.thirstRate = 0;
  p.cash = 0;
  p.bank = 200000;
  const mill = w.buildings.find((b) => b.kind === 'mill')!;
  mill.owner = p.id;
  mill.stock = { wheat: 20 };
  mill.wage = 2200;
  assert.ok(businessEstimate(w, mill)!.margin > 0);
  mill.investment = productionBudget(w, mill)!.reserve - 5000;
  w.buildings.find((b) => b.kind === 'bank')!.investment = 250000;
  const find = () => enterpriseChoices(w, p).find((c) => c.description.startsWith('Finance my'));
  assert.ok(find(), 'fixture can finance the profitable mill');
  act(w, p.id, { type: 'settings', patch: { loanTerms: '9,18' } });
  const choice = find();
  assert.ok(choice, 'a supported term must replace 12 months');
  assert.match(choice.description, /for 9 months/);
  assert.ok(
    choice.plan.some(
      (s) =>
        s.kind === 'operation' &&
        s.operation === 'loan' &&
        s.parameters.some((p) => p.name === 'months' && p.value === 9),
    ),
  );
});
