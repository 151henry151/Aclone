// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorld,
  addPlayer,
  makeBuilding,
  act,
  advance,
  terrainHeight,
} from '../src/shared/simulation';
import { worldResources, gatheringStatus, cancelGather } from '../src/shared/resources';
import { careerChoices } from '../src/server/npc/projects';
import { economyChoices } from '../src/server/npc/economy-choices';
import { constructionChoices } from '../src/server/npc/construction-projects';
import { inventHypotheses } from '../src/server/npc/hypotheses';
import { Store } from '../src/server/store';
const defaults = {
  gatheringLogsImplement: 'chainsaw',
  gatheringStoneImplement: 'pickaxe',
  gatheringGravelImplement: 'shovel',
  gatheringDirtImplement: 'shovel',
};
const materials = ['logs', 'stone', 'gravel', 'dirt'];
function setup() {
  const w = createWorld('implements', 'Implements', 'owner'),
    p = addPlayer(w, 'owner', 'Owner');
  w.buildings = [];
  w.towns = [];
  w.zones = [];
  w.resources = {};
  w.settings.hungerRate = w.settings.thirstRate = 0;
  const n = worldResources(w).find((n) => n.item === 'dirt')!;
  Object.assign(p, {
    x: n.x,
    z: n.z,
    y: terrainHeight(w, n.x, n.z),
    cash: 1000000,
    vehicle: 0,
    fuel: 64,
    inventory: {},
  });
  return { w, p, n };
}
test('default and missing implement rules preserve all four reusable requirements', () => {
  for (const missing of [false, true]) {
    const { w, p } = setup();
    Object.entries(defaults).forEach(([key, tool], i) => {
      if (missing) delete (w.settings as any)[key];
      else assert.equal((w.settings as any)[key], tool);
      const n = worldResources(w).find((n) => n.item === materials[i])!;
      Object.assign(p, { x: n.x, z: n.z, y: terrainHeight(w, n.x, n.z), inventory: { tools: 1 } });
      assert.match(gatheringStatus(w, p, n).reason!, new RegExp(tool));
      p.inventory = { [tool]: 1 };
      act(w, p.id, { type: 'gather', node: n.id });
      advance(w, 20);
      assert.equal(p.inventory[tool], 1);
      assert.equal(p.inventory[n.item], 3);
    });
  }
});
test('each material accepts its configured tool or none while retaining ordinary restrictions', () => {
  const { w, p } = setup();
  Object.keys(defaults).forEach((key, i) => {
    const n = worldResources(w).find((n) => n.item === materials[i])!;
    Object.assign(p, { x: n.x, z: n.z, y: terrainHeight(w, n.x, n.z), inventory: { shovel: 1 } });
    act(w, p.id, { type: 'settings', patch: { [key]: 'pickaxe' } });
    assert.match(gatheringStatus(w, p, n).reason!, /pickaxe/);
    p.inventory = { pickaxe: 1 };
    assert.equal(gatheringStatus(w, p, n).reason, undefined);
    act(w, p.id, { type: 'settings', patch: { [key]: 'none' } });
    p.inventory = {};
    assert.equal(gatheringStatus(w, p, n).reason, undefined);
    act(w, p.id, { type: 'gather', node: n.id });
    const task = { ...p.task };
    act(w, p.id, { type: 'settings', patch: { [key]: 'chainsaw' } });
    assert.deepEqual(p.task, task);
    advance(w, 20);
    assert.equal(p.inventory[n.item], 3);
    assert.equal(p.inventory.chainsaw, undefined);
    act(w, p.id, { type: 'settings', patch: { [key]: 'none' } });
    p.inventory = { stone: 10000 };
    assert.match(gatheringStatus(w, p, n).reason!, /cargo/);
    p.inventory = {};
    w.resources![n.id] = { amount: 0, updated: w.time };
    assert.match(gatheringStatus(w, p, n).reason!, /replenish/);
  });
});
test('all resident planners use selected tools and allow gathering without disabled requirements', () => {
  const { w, p, n } = setup(),
    state = { plan: [], index: 0 } as any;
  for (const ground of worldResources(w)) w.resources![ground.id] = { amount: 0, updated: w.time };
  w.resources![n.id].amount = 30;
  const buyer = makeBuilding('buyer', 'market', n.x + 20, n.z),
    shop = makeBuilding('tools', 'market', n.x + 60, n.z),
    site = makeBuilding('site', 'home', n.x + 40, n.z);
  Object.assign(buyer, {
    owner: 'buyer',
    buy: { dirt: 1000 },
    sell: {},
    stock: {},
    investment: 100000,
  });
  Object.assign(shop, {
    owner: 'seller',
    buy: {},
    sell: { pickaxe: 100, shovel: 100, chainsaw: 100 },
    stock: { pickaxe: 10, shovel: 10, chainsaw: 10 },
  });
  Object.assign(site, { owner: p.id, construction: { dirt: 3 }, stock: {} });
  w.buildings = [buyer, shop, site];
  const general = () => {
    const out: any[] = [];
    economyChoices(
      w,
      p,
      w.buildings,
      (description, plan) => out.push({ description, plan }),
      (_b, steps) => steps,
    );
    return out;
  };
  const plans = () => [
    ...careerChoices(w, p, state),
    ...general(),
    ...constructionChoices(w, p),
    ...inventHypotheses(w, p, state),
  ];
  const buys = (choices: any[], item: string) =>
    choices.some((c) =>
      c.plan.some(
        (s: any) =>
          s.kind === 'act' &&
          s.action.type === 'trade' &&
          s.action.direction === 'buy' &&
          s.action.item === item,
      ),
    );
  act(w, p.id, {
    type: 'settings',
    patch: {
      gatheringLogsImplement: 'none',
      gatheringStoneImplement: 'none',
      gatheringGravelImplement: 'none',
      gatheringDirtImplement: 'pickaxe',
    },
  });
  assert.ok(buys(careerChoices(w, p, state), 'pickaxe'));
  assert.ok(buys(constructionChoices(w, p), 'pickaxe'));
  assert.ok(buys(general(), 'pickaxe'));
  assert.ok(!buys(general(), 'shovel'));
  assert.ok(!buys(general(), 'chainsaw'));
  const hasGather = (choices: any[]) =>
    choices.some((c) =>
      c.plan.some(
        (s: any) => s.kind === 'act' && s.action.type === 'gather' && s.action.node === n.id,
      ),
    );
  p.inventory.pickaxe = 1;
  for (const choices of [
    careerChoices(w, p, state),
    general(),
    constructionChoices(w, p),
    inventHypotheses(w, p, state),
  ])
    assert.ok(hasGather(choices));
  act(w, p.id, { type: 'settings', patch: { gatheringDirtImplement: 'none' } });
  p.inventory = {};
  for (const choices of [
    careerChoices(w, p, state),
    general(),
    constructionChoices(w, p),
    inventHypotheses(w, p, state),
  ])
    assert.ok(hasGather(choices));
  for (const item of ['shovel', 'pickaxe', 'chainsaw']) assert.ok(!buys(plans(), item));
  for (const c of plans()) assert.ok(!c.description.includes('undefined'));
  act(w, p.id, { type: 'gather', node: n.id });
  cancelGather(w, p);
  assert.equal(w.resources![n.id].amount, 30);
});
test('implement selectors validate and persist through summaries observations designs and saves', async () => {
  const { w, p } = setup();
  for (const key of Object.keys(defaults))
    for (const value of ['tools', 'unknown', '', false, 1, null]) {
      const before = JSON.stringify(w);
      assert.throws(() => act(w, p.id, { type: 'settings', patch: { [key]: value } }));
      assert.equal(JSON.stringify(w), before);
    }
  const patch = {
    gatheringLogsImplement: 'none',
    gatheringStoneImplement: 'chainsaw',
    gatheringGravelImplement: 'pickaxe',
    gatheringDirtImplement: 'none',
  };
  act(w, p.id, { type: 'settings', patch });
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
      obs = observe(w, p, { plan: [], index: 0 } as any, new NpcMemory(store), 'resident');
    for (const [k, v] of Object.entries(patch)) {
      assert.ok(settingsFields().includes(`name="${k}"`));
      assert.ok(rulesSummary(w).includes(v));
      assert.equal((dest.settings as any)[k], v);
      assert.equal((loaded.settings as any)[k], v);
      assert.equal((obs.worldRules as any)[k], v);
    }
  } finally {
    store.close();
  }
});
