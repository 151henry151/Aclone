// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance } from '../src/shared/simulation.ts';
import { drainCreatorScripts } from '../src/shared/creator.ts';
import { ScriptPool, applyPlayerVariables } from '../src/server/scripts.ts';
import { Store } from '../src/server/store.ts';

test('player script progress is bounded, persistent, queryable and cannot cross lives', async () => {
  const w = createWorld('quests', 'Quests', 'owner'),
    p = addPlayer(w, 'pilot', 'Pilot');
  p.inventory.wheat = 7;
  p.skills = ['miller'];
  const pool = new ScriptPool();
  try {
    const source = `on("TradeComplete", function(e)
      if has_skill(e.id, "miller") and inventory_count(e.id, "wheat") == 7 then
        setplayer(e.id, "deliveries", getplayer(e.id, "deliveries") + e.quantity)
      end
    end)`;
    const result = await pool.run(w, source, 'TradeComplete', { id: p.id, quantity: 2 });
    applyPlayerVariables(w, result);
    assert.equal(p.scriptState?.deliveries, 2);
    const store = new Store(':memory:');
    try {
      store.saveWorld(w);
      assert.equal(store.loadWorlds()[0].world.players[p.id].scriptState?.deliveries, 2);
    } finally {
      store.close();
    }
    const pending = await pool.run(w, source, 'TradeComplete', { id: p.id, quantity: 3 });
    p.deaths++;
    p.scriptState = {};
    applyPlayerVariables(w, pending);
    assert.deepEqual(p.scriptState, {}, 'old-life result cannot overwrite death reset');
    await assert.rejects(
      pool.run(
        w,
        'on("TradeComplete", function(e) for i=1,65 do setplayer(e.id, "key"..i, i) end end)',
        'TradeComplete',
        { id: p.id },
      ),
      /limit/i,
    );
    await assert.rejects(
      pool.run(w, 'setplayer("other", "secret", 1)', 'TradeComplete', { id: p.id }),
      /event player/i,
    );
    await assert.rejects(
      pool.run(w, 'setplayer("pilot", "__proto__", 1)', 'TradeComplete', { id: p.id }),
      /variable/i,
    );
  } finally {
    await pool.close();
  }
});

test('successful trades and qualifications emit verified results; failed trades do not', () => {
  const w = createWorld('events', 'Events', 'owner'),
    p = addPlayer(w, 'pilot', 'Pilot');
  p.online = true;
  w.script = 'TradeComplete SkillLearned PlayerDeath';
  const market = w.buildings.find((b) => b.kind === 'market')!;
  p.x = market.x;
  p.z = market.z;
  p.cash = 100000;
  market.stock.water = 3;
  act(w, p.id, {
    type: 'trade',
    building: market.id,
    item: 'water',
    direction: 'buy',
    quantity: 2,
  });
  const [event] = drainCreatorScripts(w);
  assert.equal(event.event, 'TradeComplete');
  assert.equal(event.data.quantity, 2);
  assert.equal(event.data.amount, market.sell.water * 2);
  assert.throws(() =>
    act(w, p.id, {
      type: 'trade',
      building: market.id,
      item: 'missing',
      direction: 'buy',
      quantity: 2,
    }),
  );
  assert.deepEqual(drainCreatorScripts(w), []);
  p.learning = { skill: 'miller', end: w.time + 1 };
  advance(w, 1);
  assert.equal(
    drainCreatorScripts(w).find((e) => e.event === 'SkillLearned')?.data.skill,
    'miller',
  );
  p.scriptState = { stage: 4 };
  p.age = w.settings.maxAge;
  advance(w, 1);
  assert.deepEqual(p.scriptState, {});
  assert.equal(
    drainCreatorScripts(w).find((e) => e.event === 'PlayerDeath')?.data.cause,
    'old age',
  );
  w.settings.resetScriptOnDeath = false;
  p.scriptState = { stage: 4 };
  p.age = w.settings.maxAge;
  advance(w, 1);
  assert.equal(p.scriptState.stage, 4);
});
