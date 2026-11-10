// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/server/store';
import { Universe, tokenHash } from '../src/server/universe';
import { Accounts } from '../src/server/accounts';

function retain(store: Store, old: string, target: string) {
  store.db
    .prepare(
      `INSERT INTO account_device_keys (token_hash,account,primary_hash)
    SELECT ?,id,token_hash FROM accounts WHERE id=?`,
    )
    .run(tokenHash(old), target);
}
test('a retired device key resolves the survivor and persists without storing plaintext', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-device-key-')),
    path = join(dir, 'world.sqlite');
  let store = new Store(path);
  try {
    let universe = new Universe(store);
    const main = universe.register('Main pilot'),
      mobile = universe.register('Mobile pilot');
    store.transaction(() => {
      retain(store, mobile.token, main.account.id);
      store.db.prepare('DELETE FROM accounts WHERE id=?').run(mobile.account.id);
    });
    assert.equal(universe.authenticate(mobile.token)?.id, main.account.id);
    assert.equal(universe.authenticate(main.token)?.id, main.account.id);
    assert.equal(universe.authenticate('invalid-key'), undefined);
    const serialized = JSON.stringify(store.db.prepare('SELECT * FROM account_device_keys').all());
    assert.ok(!serialized.includes(mobile.token));
    assert.ok(!serialized.includes(main.token));
    store.close();
    store = new Store(path);
    universe = new Universe(store);
    assert.equal(universe.authenticate(mobile.token)?.name, 'Main pilot');
    store.db.prepare('DELETE FROM accounts WHERE id=?').run(main.account.id);
    assert.equal(universe.authenticate(mobile.token), undefined);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test('retained keys obey password rotation and NPC exclusions', async () => {
  const store = new Store(':memory:'),
    universe = new Universe(store),
    accounts = new Accounts(store, universe);
  try {
    const main = universe.register('Main pilot'),
      mobile = universe.register('Mobile pilot');
    retain(store, mobile.token, main.account.id);
    store.db.prepare('DELETE FROM accounts WHERE id=?').run(mobile.account.id);
    main.account.npc = true;
    universe.save(main.account);
    assert.equal(universe.authenticate(mobile.token), undefined);
    main.account.npc = false;
    universe.save(main.account);
    assert.equal(universe.authenticate(mobile.token)?.id, main.account.id);
    await accounts.configure(main.account.id, { password: 'a strong test password' });
    const fresh = await accounts.login('Main pilot', 'a strong test password');
    assert.equal(universe.authenticate(mobile.token), undefined);
    assert.equal(universe.authenticate(main.token), undefined);
    assert.equal(universe.authenticate(fresh.token)?.id, main.account.id);
  } finally {
    store.close();
  }
});
