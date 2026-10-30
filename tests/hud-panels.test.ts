// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readHud, defaultHud } from '../src/client/hud-panels';
test('HUD preferences keep each panel independent and recover from corrupt or outdated storage', () => {
  assert.deepEqual(readHud(null), defaultHud);
  assert.deepEqual(readHud('{bad'), defaultHud);
  const saved = readHud(
    JSON.stringify({
      chat: false,
      map: true,
      status: false,
      players: true,
      journal: 'yes',
      unknown: false,
    }),
  );
  assert.equal(saved.chat, false);
  assert.equal(saved.map, true);
  assert.equal(saved.status, false);
  assert.equal(saved.players, true);
  assert.equal(saved.journal, defaultHud.journal);
  assert.deepEqual(readHud(JSON.stringify(saved)), saved);
});
