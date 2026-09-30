// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/server/store.ts';
import { Universe } from '../src/server/universe.ts';
import { Accounts } from '../src/server/accounts.ts';

test('password login and verified, single-use email recovery preserve pilot and revoke old keys', async () => {
  const store = new Store(':memory:');
  const universe = new Universe(store);
  const mail: { to: string; link: string }[] = [];
  const accounts = new Accounts(
    store,
    universe,
    async (to, link) => {
      mail.push({ to, link });
    },
    'https://game.example/aclone/',
  );
  try {
    const pilot = universe.register('Ada');
    await accounts.configure(pilot.account.id, {
      password: 'long password for Ada',
      email: 'Ada@example.com',
    });
    assert.equal(accounts.status(pilot.account.id).verified, false);
    await accounts.requestReset('ada@example.com');
    assert.equal(mail.length, 1, 'unverified email cannot recover identity');
    const verify = new URL(mail[0].link).hash.split('=')[1];
    accounts.verify(verify);
    assert.throws(() => accounts.verify(verify));
    await assert.rejects(accounts.login('Ada', 'incorrect password'), /Invalid/);
    const login = await accounts.login('ada', 'long password for Ada');
    assert.equal(login.account.id, pilot.account.id);
    assert.equal(universe.authenticate(pilot.token), undefined);
    await assert.rejects(
      accounts.configure(pilot.account.id, { password: 'different long password' }),
      /current password/,
    );
    await accounts.requestReset('ADA@example.com');
    assert.equal(mail.length, 2);
    const reset = new URL(mail[1].link).hash.split('=')[1];
    await accounts.reset(reset, 'new long password for Ada');
    assert.equal(universe.authenticate(login.token), undefined);
    await assert.rejects(accounts.reset(reset, 'another long password'), /expired|invalid/i);
    assert.equal(
      (await accounts.login('Ada', 'new long password for Ada')).account.id,
      pilot.account.id,
    );
    const db = JSON.stringify(store.db.prepare('SELECT * FROM credentials').all());
    assert.ok(!db.includes('long password'));
    assert.ok(!JSON.stringify(store.db.prepare('SELECT * FROM recovery').all()).includes(reset));
  } finally {
    store.close();
  }
});

test('expired links and absent email configuration fail safely', async () => {
  const store = new Store(':memory:');
  const universe = new Universe(store);
  const links: string[] = [];
  const accounts = new Accounts(
    store,
    universe,
    async (_to, link) => {
      links.push(link);
    },
    'https://game.example',
  );
  try {
    const { account } = universe.register('Bo');
    await accounts.configure(account.id, {
      password: 'a very long password',
      email: 'bo@example.com',
    });
    store.db.prepare('UPDATE recovery SET expires=0').run();
    assert.throws(() => accounts.verify(new URL(links[0]).hash.split('=')[1]), /expired|invalid/i);
    const unavailable = new Accounts(store, universe);
    await assert.rejects(unavailable.requestReset('bo@example.com'), /not configured/);
    await assert.rejects(unavailable.configure(account.id, { password: 'short' }), /12/);
  } finally {
    store.close();
  }
});

test('a duplicate recovery email never replaces another pilot’s credentials', async () => {
  const store = new Store(':memory:');
  const universe = new Universe(store);
  const links: string[] = [];
  const accounts = new Accounts(
    store,
    universe,
    async (_to, link) => {
      links.push(link);
    },
    'https://game.example',
  );
  try {
    const a = universe.register('First'),
      b = universe.register('Second');
    await accounts.configure(a.account.id, {
      password: 'first very long password',
      email: 'same@example.com',
    });
    accounts.verify(new URL(links[0]).hash.split('=')[1]);
    await assert.rejects(
      accounts.configure(b.account.id, {
        password: 'second very long password',
        email: 'same@example.com',
      }),
      /Unable/,
    );
    assert.equal(
      (await accounts.login('First', 'first very long password')).account.id,
      a.account.id,
    );
    assert.equal(accounts.status(b.account.id).password, false);
  } finally {
    store.close();
  }
});

test('an unverified address cannot be reserved to block its legitimate owner', async () => {
  const store = new Store(':memory:');
  const universe = new Universe(store);
  const links: string[] = [];
  const accounts = new Accounts(
    store,
    universe,
    async (_to, link) => {
      links.push(link);
    },
    'https://game.example',
  );
  try {
    const first = universe.register('Unverified'),
      second = universe.register('Legitimate');
    await accounts.configure(first.account.id, {
      password: 'a long first password',
      email: 'owner@example.com',
    });
    await accounts.configure(second.account.id, {
      password: 'a long second password',
      email: 'owner@example.com',
    });
    accounts.verify(new URL(links[1]).hash.split('=')[1]);
    assert.equal(accounts.status(second.account.id).verified, true);
    assert.throws(() => accounts.verify(new URL(links[0]).hash.split('=')[1]));
    assert.equal(accounts.status(first.account.id).verified, false);
  } finally {
    store.close();
  }
});

test('delivery failure keeps a usable password and verification can be retried', async () => {
  const store = new Store(':memory:');
  const universe = new Universe(store);
  let fail = true;
  const links: string[] = [];
  const accounts = new Accounts(
    store,
    universe,
    async (_to, link) => {
      if (fail) throw Error('SMTP down');
      links.push(link);
    },
    'https://game.example',
  );
  try {
    const pilot = universe.register('Delivery');
    const status = await accounts.configure(pilot.account.id, {
      password: 'long delivery password',
      email: 'delivery@example.com',
    });
    assert.equal(status.password, true);
    assert.equal(status.deliveryError, true);
    assert.equal(
      (await accounts.login('Delivery', 'long delivery password')).account.id,
      pilot.account.id,
    );
    fail = false;
    await accounts.resend(pilot.account.id);
    accounts.verify(new URL(links[0]).hash.split('=')[1]);
    assert.equal(accounts.status(pilot.account.id).verified, true);
  } finally {
    store.close();
  }
});
