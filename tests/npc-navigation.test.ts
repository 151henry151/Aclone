// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, move, distance, terrainHeight } from '../src/shared/simulation.ts';
import { Navigator } from '../src/server/npc/navigation.ts';

test('NPC drives through ordinary physics to dispersed public services without teleporting', () => {
  const w = createWorld('nav', 'Navigation', 'server'),
    p = addPlayer(w, 'npc', 'Mabel');
  p.online = true;
  for (const kind of ['workhouse', 'market', 'school', 'garage', 'home']) {
    const b = w.buildings.find((b) => b.kind === kind)!;
    const nav = new Navigator(w, p, b, 12);
    let arrived = false;
    for (let i = 0; i < 6000; i++) {
      const before = { x: p.x, z: p.z };
      const result = nav.step(w, p, 0.05);
      assert.equal(result.error, undefined, `${kind}: ${result.error}`);
      move(w, p, result.input, 0.05);
      w.time += 0.05;
      assert.ok(distance(before, p) < 0.8, 'no position jump');
      assert.ok(terrainHeight(w, p.x, p.z) >= w.settings.seaLevel);
      if (result.arrived) {
        arrived = true;
        break;
      }
    }
    assert.ok(arrived, `reach ${kind} from ${p.x},${p.z}`);
    assert.ok(distance(p, b) < 18);
  }
});
test('NPC refuses a submerged destination', () => {
  const w = createWorld('wet', 'Water', 'server'),
    p = addPlayer(w, 'npc', 'Mabel');
  assert.throws(() => new Navigator(w, p, { x: 10, z: 220 }, 3), /route/);
});
