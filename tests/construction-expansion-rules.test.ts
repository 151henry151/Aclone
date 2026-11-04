// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation';
import { buildingDesignQuote, buildingSize } from '../src/shared/building-designs';
import { buildings } from '../src/shared/catalog';
import { constructionRefund } from '../src/shared/construction';
import { Store } from '../src/server/store';
const defaults = {
  expandedConstructionCostMultiplier: 1.55,
  largeConstructionCostMultiplier: 2.15,
};
function setup() {
  const w = createWorld('expansion-rules', 'Expansion', 'owner'),
    p = addPlayer(w, 'owner', 'Owner');
  w.buildings = [];
  w.zones = [];
  w.tier = 10;
  Object.assign(p, { x: 80, z: 17, cash: 10000000 });
  w.towns[0].tax = 0.1;
  return { w, p };
}
test('expansion prices and materials retain defaults and follow custom multipliers with ceiling rounding', () => {
  const { w } = setup();
  const standard = buildingDesignQuote('home', buildings.home, 'red-timber', 'standard');
  for (const missing of [false, true]) {
    for (const [k, v] of Object.entries(defaults)) {
      if (missing) delete (w.settings as any)[k];
      else assert.equal((w.settings as any)[k], v, k);
    }
    for (const [size, mult] of [
      ['expanded', 1.55],
      ['large', 2.15],
    ] as const) {
      const q = buildingDesignQuote(
        'home',
        buildings.home,
        'red-timber',
        size,
        undefined,
        w.settings,
      );
      assert.equal(q.price, Math.ceil(standard.price * mult));
      for (const [item, n] of Object.entries(standard.materials))
        assert.equal(q.materials[item], Math.ceil(n * mult));
    }
  }
  Object.assign(w.settings, {
    expandedConstructionCostMultiplier: 1.234,
    largeConstructionCostMultiplier: 3.456,
  });
  for (const [size, mult, capacity] of [
    ['expanded', 1.234, 1.5],
    ['large', 3.456, 2],
  ] as const) {
    const q = buildingDesignQuote(
      'home',
      buildings.home,
      'red-timber',
      size,
      undefined,
      w.settings,
    );
    assert.equal(q.price, Math.ceil(standard.price * mult));
    for (const [item, n] of Object.entries(standard.materials))
      assert.equal(q.materials[item], Math.ceil(n * mult));
    assert.equal(q.capacity, Math.ceil(standard.capacity * capacity));
    assert.equal(q.size.footprint, buildingSize('home', size)!.footprint);
  }
  assert.deepEqual(
    buildingDesignQuote('home', buildings.home, 'red-timber', 'standard', undefined, w.settings),
    standard,
  );
  Object.assign(w.settings, {
    expandedConstructionCostMultiplier: 1,
    largeConstructionCostMultiplier: 1,
  });
  const q = buildingDesignQuote(
    'home',
    buildings.home,
    'red-timber',
    'large',
    undefined,
    w.settings,
  );
  assert.equal(q.price, standard.price);
  assert.deepEqual(q.materials, standard.materials);
  assert.equal(q.capacity, standard.capacity * 2);
  assert.throws(
    () => buildingDesignQuote('farm', buildings.farm, 'red-timber', 'large', undefined, w.settings),
    /size available/,
  );
});
test('server charges configured expansion bill and tax and preserves original sites and refunds across rule edits', () => {
  for (const size of ['expanded', 'large'] as const) {
    const { w, p } = setup();
    Object.assign(w.settings, {
      expandedConstructionCostMultiplier: 3,
      largeConstructionCostMultiplier: 4,
    });
    const expected = buildings.home.price * (size === 'expanded' ? 3 : 4),
      cash = p.cash;
    act(w, p.id, { type: 'construct', kind: 'home', style: 'red-timber', size });
    const b = w.buildings[0];
    assert.equal(b.constructionCost, expected);
    assert.equal(p.cash, cash - expected - Math.round(expected * 0.1));
    const standard = buildingDesignQuote('home', buildings.home, 'red-timber');
    for (const [item, n] of Object.entries(standard.materials))
      assert.equal(b.construction![item], n * (size === 'expanded' ? 3 : 4));
    const before = structuredClone(b);
    act(w, p.id, {
      type: 'settings',
      patch: { expandedConstructionCostMultiplier: 1, largeConstructionCostMultiplier: 1 },
    });
    assert.deepEqual(b, before);
    b.price = 99999999;
    assert.equal(constructionRefund(w, b), Math.floor(expected * 0.75));
    const paid = p.cash;
    act(w, p.id, { type: 'cancelConstruction', building: b.id });
    assert.equal(p.cash, paid + Math.floor(expected * 0.75));
  }
});
test('expansion settings validate and persist in editor summary observation designs and saved worlds', async () => {
  const { w, p } = setup();
  const edit = (patch: Record<string, unknown>) => act(w, p.id, { type: 'settings', patch });
  for (const key of Object.keys(defaults))
    for (const value of [0, 0.99, 10.01, NaN, Infinity]) {
      const before = JSON.stringify(w);
      assert.throws(() => edit({ [key]: value }));
      assert.equal(JSON.stringify(w), before);
    }
  const patch = { expandedConstructionCostMultiplier: 1.25, largeConstructionCostMultiplier: 2.75 };
  edit(patch);
  const { settingsFields } = await import('../src/client/creator-editor'),
    { rulesSummary } = await import('../src/shared/rulesets'),
    { exportDesign, applyDesign } = await import('../src/server/world-design'),
    { observe } = await import('../src/server/npc/observation'),
    { NpcMemory } = await import('../src/server/npc/memory');
  const dest = createWorld('dest', 'Dest', 'owner');
  applyDesign(dest, exportDesign(w));
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world,
      observation = observe(w, p, { plan: [], index: 0 } as any, new NpcMemory(store), 'resident');
    for (const [k, v] of Object.entries(patch)) {
      assert.ok(settingsFields().includes(`name="${k}"`));
      assert.ok(rulesSummary(w).includes(String(v)));
      assert.equal((dest.settings as any)[k], v);
      assert.equal((loaded.settings as any)[k], v);
      assert.equal((observation.worldRules as any)[k], v);
    }
  } finally {
    store.close();
  }
});
