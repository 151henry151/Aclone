// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation.ts';
import { conversationView } from '../src/server/npc/agenda.ts';
import { portfolioBriefing } from '../src/server/npc/portfolio.ts';
import { perceivedWorld } from '../src/server/npc/perception.ts';
import type { ResidentState } from '../src/server/npc/memory.ts';
function setup() {
  const w = createWorld('test', 'Test', 'server');
  const owner = addPlayer(w, 'owner', 'BioHaze');
  const b = w.buildings.find((b) => b.kind === 'mill')!;
  b.owner = owner.id;
  owner.x = b.x;
  owner.z = b.z + 12;
  w.settings.activeWork = false;
  w.settings.ownerOperation = false;
  w.settings.salesTax = 0;
  w.towns.forEach((t) => (t.salesTax = 0));
  b.buy = { wheat: 600 };
  b.sell = { flour: 3000 };
  b.wage = 1000;
  const workers = Array.from({ length: 3 }, (_, i) => addPlayer(w, 'worker' + i, 'Worker ' + i));
  workers.forEach((p) => {
    p.x = owner.x;
    p.z = owner.z;
    p.skills = ['miller'];
  });
  return { w, owner, b, workers };
}
test('portfolio scopes ownership, converts currency once and hides private recorded accounts', () => {
  const { w, owner, b } = setup();
  const mabel = addPlayer(w, 'mabel', 'Mabel Reed');
  b.accounts = { since: 0, sales: 123400 } as any;
  const state = {
    plan: [],
    index: 0,
    world: w.id,
    playerId: mabel.id,
    helpQuestion: 'How profitable are my businesses?',
    questionFrom: owner.id,
  } as unknown as ResidentState;
  const view = perceivedWorld(w, mabel, state, true);
  const report = portfolioBriefing(view, view.players[mabel.id], state, true)!;
  assert.deepEqual(
    report.businesses.map((b) => b.id),
    [b.id],
  );
  assert.equal(report.businesses[0].ownerName, 'BioHaze');
  assert.equal(report.businesses[0].estimate!.inputsPerBatchDenarii, 30);
  assert.equal(report.businesses[0].recordedOperatingCashFlowDenarii, null);
  assert.match(report.responseRule, /unknown, not zero/);
  assert.deepEqual(
    conversationView({ portfolio: report }, state, owner.id, false).portfolio,
    report,
    'ownership facts reach the chat provider',
  );
});
