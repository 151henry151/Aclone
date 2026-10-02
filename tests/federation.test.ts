// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/server/store.ts';
import { Universe } from '../src/server/universe.ts';
import { Federation } from '../src/server/federation.ts';
import { createWorld, addPlayer } from '../src/shared/simulation.ts';
function galaxies() {
  let now = 1000;
  const hosts = ['hearth', 'orchard', 'harbour'].map((name) => {
    const store = new Store(':memory:'),
      universe = new Universe(store),
      config = { name, url: `https://${name}.example/aclone`, peers: [] };
    return { store, universe, galaxy: new Federation(store, universe, config, () => now) };
  });
  for (const h of hosts)
    h.galaxy = new Federation(
      h.store,
      h.universe,
      {
        ...h.galaxy.config,
        peers: hosts
          .filter((p) => p !== h)
          .map((p) => ({
            name: p.galaxy.config.name,
            url: p.galaxy.config.url,
            key: p.galaxy.publicKey,
          })),
      },
      () => now,
    );
  return {
    hosts,
    advance: (seconds: number) => {
      now += seconds;
    },
    close: () => hosts.forEach((h) => h.store.close()),
  };
}
const ticket = (trip: { url: string }) =>
  new URLSearchParams(new URL(trip.url).hash.slice(1)).get('arrival')!;
test('galaxy visits retain identity and independent progress; returning home requires native authentication', () => {
  const f = galaxies();
  try {
    const [a, b, c] = f.hosts,
      home = a.universe.register('Travelling Ada');
    home.account.credits = 99999;
    a.universe.save(home.account);
    const outward = a.galaxy.issue(home.account, b.galaxy.config.url);
    assert.ok(outward.url.startsWith('https://orchard.example/aclone/#arrival='));
    assert.ok(!outward.url.includes(home.token));
    const pass = ticket(outward);
    assert.equal(b.galaxy.preview(pass).name, 'Travelling Ada');
    const visitor = b.galaxy.arrive(pass);
    assert.notEqual(visitor.account.id, home.account.id);
    assert.equal(visitor.account.credits, 50);
    assert.equal(visitor.account.traveler?.subject, home.account.id);
    visitor.account.credits = 73;
    b.universe.save(visitor.account);
    const w = createWorld('holiday', 'Holiday', visitor.account.id),
      p = addPlayer(w, visitor.account.id, visitor.account.name);
    p.inventory.wheat = 19;
    b.store.saveWorld(w);
    assert.throws(() => b.galaxy.arrive(pass), /already been used/);
    const next = c.galaxy.arrive(ticket(b.galaxy.issue(visitor.account, c.galaxy.config.url)));
    assert.equal(next.account.traveler?.home, a.galaxy.config.url);
    const back = ticket(c.galaxy.issue(next.account, b.galaxy.config.url)),
      again = b.galaxy.arrive(back);
    assert.equal(again.account.id, visitor.account.id);
    assert.equal(again.account.credits, 73);
    assert.equal(b.store.loadWorlds()[0].world.players[again.account.id].inventory.wheat, 19);
    assert.equal(b.universe.authenticate(visitor.token), undefined);
    const homeward = ticket(b.galaxy.issue(again.account, a.galaxy.config.url));
    assert.throws(() => a.galaxy.arrive(homeward), /home pilot/);
    assert.throws(
      () => a.galaxy.arrive(homeward, a.universe.register('Wrong pilot')),
      /home pilot/,
    );
    const returned = a.galaxy.arrive(homeward, home);
    assert.equal(returned.token, home.token);
    assert.equal(returned.account.credits, 99999);
    assert.equal(returned.account.traveler, undefined);
  } finally {
    f.close();
  }
});
test('signed tickets reject tampering, wrong destination, expired and untrusted passports', () => {
  const f = galaxies();
  try {
    const [a, b, c] = f.hosts,
      home = a.universe.register('Pilot');
    const t = ticket(a.galaxy.issue(home.account, b.galaxy.config.url));
    assert.throws(() => c.galaxy.arrive(t), /addressed/);
    const [data, sig] = t.split('.');
    const changed = JSON.parse(Buffer.from(data, 'base64url').toString());
    changed.aud = c.galaxy.config.url;
    assert.throws(
      () => c.galaxy.arrive(Buffer.from(JSON.stringify(changed)).toString('base64url') + '.' + sig),
      /signature/,
    );
    b.galaxy.config.peers = [];
    assert.throws(() => b.galaxy.arrive(t), /trust/);
    f.advance(121);
    assert.throws(() => a.galaxy.preview(t), /expired/);
  } finally {
    f.close();
  }
});
test('keys persist and failed arrival transactions neither consume tickets nor create partial visitors', () => {
  const f = galaxies();
  try {
    const [a, b] = f.hosts,
      home = a.universe.register('Durable pilot'),
      t = ticket(a.galaxy.issue(home.account, b.galaxy.config.url));
    assert.equal(
      new Federation(a.store, a.universe, a.galaxy.config).publicKey,
      a.galaxy.publicKey,
    );
    b.store.db.exec(
      "CREATE TRIGGER fail_arrival BEFORE INSERT ON galaxy_arrivals BEGIN SELECT RAISE(ABORT,'disk error'); END",
    );
    assert.throws(() => b.galaxy.arrive(t), /disk error/);
    assert.equal(b.store.db.prepare('SELECT COUNT(*) n FROM galaxy_visitors').get()!.n, 0);
    assert.equal(b.store.db.prepare('SELECT COUNT(*) n FROM accounts').get()!.n, 0);
    b.store.db.exec('DROP TRIGGER fail_arrival');
    assert.ok(b.galaxy.arrive(t).token);
    assert.throws(
      () =>
        new Federation(a.store, a.universe, {
          name: 'bad',
          url: 'http://remote.example',
          peers: [],
        }),
      /HTTPS/,
    );
  } finally {
    f.close();
  }
});
