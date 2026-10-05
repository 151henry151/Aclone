// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ScriptPool, ScriptEvents } from '../src/server/scripts.ts';
import { createWorld, addPlayer } from '../src/shared/simulation.ts';

test('Lua scripts can ask whether a player is inside a town and where they live', async () => {
  const pool = new ScriptPool();
  try {
    const w = createWorld('lua-towns', 'Towns', 'owner'),
      p = addPlayer(w, 'visitor', 'Visitor');
    p.town = 'puddlewick';
    w.script =
      'on("ObjectInteract", function(e) if in_town(e.id, "Puddlewick") then setvar("inside", 1) end; if not in_town(e.id, "Nowhere") then setvar("unknown", 1) end; if home_town(e.id) == "Puddlewick" then setvar("home", 1) end end)';
    const events = new ScriptEvents(pool.run.bind(pool));
    const r = await events.run(w, 'ObjectInteract', { id: p.id }, () => true);
    assert.deepEqual([r?.variables.inside, r?.variables.unknown, r?.variables.home], [1, 1, 1]);
    p.x = 5000;
    const away = await events.run(w, 'ObjectInteract', { id: p.id }, () => true);
    assert.equal(away?.variables.inside ?? 0, 0);
  } finally {
    pool.close();
  }
});
