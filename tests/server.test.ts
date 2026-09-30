// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/server/store.ts';
import { Universe } from '../src/server/universe.ts';
import { WorldScript } from '../src/server/lua.ts';
import { createWorld, addPlayer } from '../src/shared/simulation.ts';
test('SQLite saves state and ledger atomically and restores from a live backup', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-test-'));
  const s = new Store(join(dir, 'world.sqlite'));
  try {
    const w = createWorld('test', 'Test', 'owner');
    addPlayer(w, 'owner', 'Ada');
    s.saveWorld(w);
    s.saveWorld(w);
    assert.equal(s.db.prepare('SELECT COUNT(*) n FROM ledger').get()!.n, 1);
    await s.backup(join(dir, 'backup.sqlite'));
    const b = new Store(join(dir, 'backup.sqlite'));
    assert.deepEqual(b.loadWorlds()[0].world, w);
    b.close();
  } finally {
    s.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test('identity persists without storing the bearer secret and duplicate names cannot steal accounts', () => {
  const s = new Store(':memory:');
  const u = new Universe(s);
  const { account, token } = u.register('Ada');
  assert.equal(u.authenticate(token)?.id, account.id);
  assert.equal(u.authenticate('wrong'), undefined);
  assert.throws(() => u.register('ada'));
  assert.ok(!JSON.stringify(s.db.prepare('SELECT * FROM accounts').all()).includes(token));
  s.close();
});
test('galaxy range, credits and inventory are server-owned', () => {
  const s = new Store(':memory:');
  const u = new Universe(s);
  const { account: a } = u.register('Pilot');
  assert.throws(() => u.travel(a, 'farthing'), /range/);
  u.travel(a, 'brindle');
  assert.equal(a.credits, 46);
  u.arrive(a, a.transit!.arrives);
  assert.throws(() => u.trade(a, 'electronics', -1, true));
  assert.throws(() => u.buyShip(a, 'alien'));
  s.close();
});
test('Lua runs events with persistent variables but no OS or arbitrary JS access', () => {
  const w = createWorld('t', 'T', 'owner');
  const script = new WorldScript(
    w,
    'assert(os == nil and io == nil and require == nil and debug == nil)\non("PlayerLogin", function(e) setvar("visits", getvar("visits") + 1); announce(e.name) end)',
  );
  script.emit('PlayerLogin', { name: 'Ada' });
  assert.equal(w.scriptVariables.visits, 1);
  assert.equal(w.messages.at(-1)?.text, 'Ada');
  script.close();
  assert.throws(() => new WorldScript(w, 'while true do end'), /budget/);
});

test('world snapshot and account change roll back together on a failed save', () => {
  const s = new Store(':memory:');
  const u = new Universe(s);
  const { account: a } = u.register('Exchange');
  const w = createWorld('exchange', 'Exchange', a.id);
  addPlayer(w, a.id, a.name);
  s.saveWorld(w);
  a.credits += 10;
  w.players[a.id].cash -= 100000;
  assert.throws(() =>
    s.saveWorld(w, Date.now() / 1000, () => {
      u.save(a);
      throw Error('disk failure');
    }),
  );
  const stored = JSON.parse(
    String(s.db.prepare('SELECT state FROM accounts WHERE id=?').get(a.id)!.state),
  );
  assert.equal(stored.credits, 50);
  assert.equal(s.loadWorlds()[0].world.players[a.id].cash, 180000);
  s.close();
});

test('schema 1 migration preserves existing pilot IDs, keys and account state', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-migration-'));
  const path = join(dir, 'world.sqlite');
  let store = new Store(path);
  try {
    const old = new Universe(store).register('Existing Pilot');
    old.account.credits = 321;
    new Universe(store).save(old.account);
    store.db.exec(
      "DROP INDEX account_name_key; ALTER TABLE accounts DROP COLUMN name_key; UPDATE meta SET value='1' WHERE key='schema';",
    );
    store.close();
    store = new Store(path);
    assert.equal(new Universe(store).authenticate(old.token)?.id, old.account.id);
    assert.equal(new Universe(store).authenticate(old.token)?.credits, 321);
    assert.equal(store.db.prepare("SELECT value FROM meta WHERE key='schema'").get()!.value, '2');
    assert.throws(() => new Universe(store).register('existing pilot'));
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
