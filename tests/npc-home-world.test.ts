// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer } from '../src/shared/simulation.ts';
import { Store } from '../src/server/store.ts';
import { Universe } from '../src/server/universe.ts';
import { Residents } from '../src/server/npc/residents.ts';
import { npcConfigSchema, npcEnvironment } from '../src/server/npc/config.ts';
import { operation } from '../src/server/npc/player-operations.ts';

test('the guide stays home by default; other residents remain free to travel', () => {
  assert.equal(
    npcEnvironment({ NPC_ENABLED: 'true', OPENAI_API_KEY: 'test' })!.config.homeWorldOnly,
    true,
  );
  assert.equal(npcConfigSchema.parse({ id: 'toby' }).homeWorldOnly, false);
  assert.equal(
    npcEnvironment({ NPC_ENABLED: 'true', OPENAI_API_KEY: 'test', NPC_HOME_WORLD_ONLY: 'false' })!
      .config.homeWorldOnly,
    false,
  );
});

test('home-world policy restores a traveller without transferring assets and rejects stale departures', async () => {
  const store = new Store(':memory:');
  const u = new Universe(store);
  const home = createWorld('puddlewick', 'Home', 'server');
  const away = createWorld('other', 'Other', 'server');
  const worlds = new Map([
    [home.id, home],
    [away.id, away],
  ]);
  const config = npcConfigSchema.parse({ provider: 'jev', activeAlone: true });
  const brain = {
    async decide() {
      throw Error('No network');
    },
  };
  let controller = new Residents(store, u, worlds, [{ config, brain }]);
  try {
    const state = controller.memory.load('mabel')!;
    const id = state.playerId;
    controller.close();
    const p = home.players[id];
    p.cash = 4_710_096;
    p.inventory = { wood: 5 };
    const q = addPlayer(away, id, p.name);
    q.cash = 58342;
    q.inventory = { flour: 4 };
    q.online = true;
    state.world = away.id;
    state.inSpace = true;
    state.plan = [operation('land', { world: away.id })];
    state.routine = 'hustle';
    state.evaluation = {
      time: 900,
      cash: q.cash,
      bank: 0,
      health: q.health,
      inventory: q.inventory,
      job: null,
    };
    controller.memory.save('mabel', state);
    controller = new Residents(store, u, worlds, [
      { config: { ...config, homeWorldOnly: true }, brain },
    ]);
    const restored = controller.memory.load('mabel')!;
    assert.equal(restored.world, home.id);
    assert.equal(restored.inSpace, false);
    assert.deepEqual(restored.plan, []);
    assert.equal(restored.evaluation, undefined);
    assert.equal(restored.routine, undefined);
    assert.equal(p.cash, 4_710_096);
    assert.deepEqual(p.inventory, { wood: 5 });
    assert.equal(q.cash, 58342);
    assert.deepEqual(q.inventory, { flour: 4 });
    assert.equal(q.online, false);
    const resident = (controller as any).residents[0];
    assert.ok(
      !(controller as any).choices(resident, home, p).some((c: any) => c.id.startsWith('space_')),
    );
    const port = home.buildings.find((b) => b.kind === 'starport')!;
    p.x = port.x;
    p.z = port.z;
    p.online = true;
    resident.state.plan = [operation('takeoff')];
    (controller as any).performSpace(resident, home, operation('takeoff'));
    assert.equal(resident.state.inSpace, false);
    assert.equal(p.online, true);
    assert.match(resident.state.lastOutcome.message, /home world/);
    assert.equal(controller.memory.load('mabel')!.world, home.id);
  } finally {
    controller.close();
    store.close();
  }
});
