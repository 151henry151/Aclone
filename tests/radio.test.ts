// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation';
import { Store } from '../src/server/store';
function setup() {
  const w = createWorld('radio', 'Radio', 'a');
  w.settings.mapSize = 40000;
  w.settings.seaLevel = -10;
  w.buildings = [];
  w.roads = [];
  w.towns = [];
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array(1089).fill(0),
  };
  const a = addPlayer(w, 'a', 'Alice'),
    b = addPlayer(w, 'b', 'Bob'),
    c = addPlayer(w, 'c', 'Cora');
  for (const [i, p] of [a, b, c].entries())
    Object.assign(p, { online: true, vehicle: 0, x: i * 100, z: 0, y: 0 });
  return { w, a, b, c };
}
test('radio settings persist per vehicle while invalid and muted actions do not change them', () => {
  const { w, a } = setup();
  act(w, a.id, { type: 'radio', operation: 'channel', value: 9 });
  act(w, a.id, { type: 'radio', operation: 'handle', value: 'Marsh tractor' });
  act(w, a.id, { type: 'radio', operation: 'squelch', value: 0.3 });
  const before = JSON.stringify(a);
  assert.throws(() => act(w, a.id, { type: 'radio', operation: 'channel', value: 41 }), /channel/i);
  assert.equal(JSON.stringify(a), before);
  a.muted = true;
  assert.throws(() => act(w, a.id, { type: 'radio', operation: 'key', text: 'hello' }), /muted/i);
  a.muted = false;
  w.settings.chatLocked = true;
  assert.throws(() => act(w, a.id, { type: 'radio', operation: 'key', text: 'hello' }), /muted/i);
});
test('radio traffic is isolated by channel, lasts for its speaking time and never enters public chat', async () => {
  const radio = await import('../src/shared/radio');
  const { w, a, b, c } = setup();
  act(w, c.id, { type: 'radio', operation: 'channel', value: 9 });
  const messages = w.messages.length;
  act(w, a.id, { type: 'radio', operation: 'key', text: 'hello there' });
  assert.equal(radio.radioView(w, b).keyed.length, 1);
  radio.tickRadio(w, 0.2);
  assert.throws(() => act(w, b.id, { type: 'radio', operation: 'key', text: 'busy' }), /busy/i);
  assert.equal(radio.radioView(w, b).traffic.length, 0);
  radio.tickRadio(w, 2);
  assert.equal(radio.radioView(w, b).traffic.at(-1)?.text, 'hello there');
  assert.equal(radio.radioView(w, c).traffic.length, 0);
  assert.equal(w.messages.length, messages);
  assert.equal(radio.radioView(w, b).keyed.length, 0);
});
test('simultaneous transmitters double only where both reach the listener', async () => {
  const radio = await import('../src/shared/radio');
  const { w, a, b, c } = setup();
  act(w, a.id, { type: 'radio', operation: 'key', text: 'first voice' });
  act(w, b.id, { type: 'radio', operation: 'key', text: 'second voice' });
  radio.tickRadio(w, 3);
  assert.ok(radio.radioView(w, c).traffic.every((e) => e.collision && /doubling/i.test(e.text)));
  assert.equal(radio.radioView(w, c).traffic.length, 2);
});
test('distance, hills, aircraft, water, terrain blocking and squelch determine reception', async () => {
  const { radioSignal } = await import('../src/shared/radio');
  const { w, a, b } = setup();
  assert.ok(radioSignal(w, a, b) > 0.9);
  b.x = 4000;
  assert.equal(radioSignal(w, a, b), 0);
  a.vehicle = 2;
  a.y = 500;
  assert.ok(radioSignal(w, a, b) > 0.3, 'aircraft extends reach');
  a.vehicle = 0;
  a.y = 300;
  w.landscape!.heightmap = Array.from({ length: 1089 }, (_, i) => (i % 33 === 16 ? 300 : 0));
  assert.ok(radioSignal(w, a, b) > 0.2, 'a real hilltop extends reach');
  w.landscape!.heightmap = Array(1089).fill(0);
  a.y = 0;
  a.vehicle = b.vehicle = 3;
  w.settings.seaLevel = 1;
  a.y = b.y = 1;
  assert.ok(radioSignal(w, a, b) > 0, 'over-water reach');
  w.settings.seaLevel = -10;
  a.vehicle = b.vehicle = 0;
  a.y = b.y = 0;
  b.x = 2000;
  const open = radioSignal(w, a, b);
  w.landscape!.heightmap = Array.from({ length: 1089 }, (_, i) => (i % 33 === 17 ? 300 : 0));
  assert.ok(radioSignal(w, a, b) < open / 10, 'ridge blocks line of sight');
});
test('radio selections survive a save while transmissions and received logs do not', async () => {
  const radio = await import('../src/shared/radio');
  const { w, a, b } = setup();
  act(w, a.id, { type: 'radio', operation: 'channel', value: 9 });
  act(w, a.id, { type: 'radio', operation: 'handle', value: 'Marsh tractor' });
  act(w, b.id, { type: 'radio', operation: 'channel', value: 9 });
  act(w, a.id, { type: 'radio', operation: 'key', text: 'help please' });
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world;
    assert.equal(radio.radioView(loaded, loaded.players.a).config.channel, 9);
    assert.equal(radio.radioView(loaded, loaded.players.a).config.handle, 'Marsh tractor');
    assert.equal(radio.radioView(loaded, loaded.players.b).keyed.length, 0);
    assert.equal(radio.radioView(loaded, loaded.players.b).traffic.length, 0);
  } finally {
    store.close();
  }
});
test('squelch hides weak reception, degradation drops words before static, and a distant station can reuse a channel', async () => {
  const radio = await import('../src/shared/radio');
  const { w, a, b, c } = setup();
  b.x = 2400;
  act(w, b.id, { type: 'radio', operation: 'squelch', value: 0.5 });
  act(w, a.id, {
    type: 'radio',
    operation: 'key',
    text: 'one two three four five six seven eight nine ten',
  });
  radio.tickRadio(w, 0.2);
  assert.equal(radio.radioView(w, b).keyed.length, 0);
  c.x = 10000;
  assert.doesNotThrow(() =>
    act(w, c.id, { type: 'radio', operation: 'key', text: 'distant station' }),
  );
  radio.tickRadio(w, 5);
  assert.equal(radio.radioView(w, b).traffic.length, 0);
  const words = 'one two three four five six seven eight nine ten';
  const degraded = radio.radioLegibility(words, 0.4, w, 'fixed');
  assert.match(degraded, /…/);
  assert.match(degraded, /one|two|three|four|five|six|seven|eight|nine|ten/);
  assert.equal(radio.radioLegibility(words, 0.1, w, 'fixed'), '[static]');
  assert.equal(radio.radioLegibility(words, 1, w, 'fixed'), words);
});
test('selected channel and handle belong to a vehicle; leaving it cancels transmission and clears traffic', async () => {
  const radio = await import('../src/shared/radio');
  const { w, a, b } = setup();
  act(w, a.id, { type: 'radio', operation: 'channel', value: 9 });
  act(w, a.id, { type: 'radio', operation: 'handle', value: 'tractor' });
  a.vehicle = 3;
  assert.equal(radio.radioView(w, a).config.channel, 19);
  act(w, a.id, { type: 'radio', operation: 'handle', value: 'boat' });
  a.vehicle = 0;
  assert.equal(radio.radioView(w, a).config.handle, 'tractor');
  assert.equal(radio.radioView(w, a).config.channel, 9);
  act(w, b.id, { type: 'radio', operation: 'channel', value: 9 });
  act(w, a.id, { type: 'radio', operation: 'key', text: 'tractor reporting' });
  radio.tickRadio(w, 2);
  assert.equal(radio.radioView(w, b).traffic.length, 1);
  b.vehicle = 5;
  assert.equal(radio.radioView(w, b).traffic.length, 0);
  assert.throws(
    () => act(w, b.id, { type: 'radio', operation: 'key', text: 'on foot' }),
    /vehicle radio/,
  );
  a.vehicle = 5;
  radio.tickRadio(w, 0.1);
  assert.equal(radio.radioView(w, b).keyed.length, 0);
});
test('world radio rules change duration, channel limits and availability; early release transmits only the spoken prefix', async () => {
  const radio = await import('../src/shared/radio');
  const { w, a, b } = setup();
  act(w, a.id, {
    type: 'settings',
    patch: { radioCharsPerSecond: 5, radioChannelCount: 10, radioMaxLength: 20 },
  });
  assert.equal(radio.radioView(w, a).config.channel, 10);
  assert.throws(
    () => act(w, a.id, { type: 'radio', operation: 'key', text: 'this exceeds twenty characters' }),
    /Invalid text/,
  );
  act(w, a.id, { type: 'radio', operation: 'key', text: 'hello there' });
  assert.equal(radio.radioView(w, b).keyed[0].remaining, 11 / 5);
  radio.tickRadio(w, 1);
  act(w, a.id, { type: 'radio', operation: 'release' });
  assert.equal(radio.radioView(w, b).traffic.at(-1)?.text, 'hello');
  assert.equal(radio.radioView(w, b).keyed.length, 0);
  act(w, a.id, { type: 'settings', patch: { radioEnabled: false } });
  assert.throws(
    () => act(w, a.id, { type: 'radio', operation: 'key', text: 'disabled' }),
    /vehicle radio/,
  );
  act(w, a.id, { type: 'settings', patch: { radioEnabled: true } });
  b.npc = true;
  assert.throws(
    () => act(w, b.id, { type: 'radio', operation: 'key', text: 'resident' }),
    /vehicle radio/,
  );
  act(w, a.id, { type: 'settings', patch: { radioResidents: true } });
  assert.doesNotThrow(() => act(w, b.id, { type: 'radio', operation: 'key', text: 'resident' }));
});
test('emergency-channel stranded-vessel calls produce a nearby manual rescue cue without public chat', async () => {
  const radio = await import('../src/shared/radio');
  const { w, a, b, c } = setup();
  a.vehicle = b.vehicle = 33;
  a.fuel = 0;
  c.vehicle = 0;
  for (const p of [a, b, c]) act(w, p.id, { type: 'radio', operation: 'channel', value: 9 });
  act(w, a.id, { type: 'radio', operation: 'key', text: 'need fuel please' });
  radio.tickRadio(w, 3);
  assert.deepEqual(radio.radioView(w, b).traffic[0].rescue, { x: a.x, z: a.z });
  assert.equal(radio.radioView(w, c).traffic[0].rescue, undefined);
  assert.equal(b.inventory.fuel, undefined, 'no automatic cargo transfer');
});
test('radio action transactions can restore transient traffic after a failed action replaces the World', async () => {
  const radio = await import('../src/shared/radio');
  const { w, a, b } = setup();
  act(w, a.id, { type: 'radio', operation: 'key', text: 'keep this transmission' });
  const checkpoint = radio.radioCheckpoint(w),
    before = structuredClone(w);
  radio.tickRadio(w, 0.2);
  assert.throws(() => act(w, b.id, { type: 'radio', operation: 'key', text: 'busy' }), /busy/);
  radio.restoreRadio(before, checkpoint);
  assert.equal(radio.radioView(before, b).keyed.length, 1);
});
test('radio rules are grouped in the world editor, validated, summarised and portable', async () => {
  const { settingsFields } = await import('../src/client/creator-editor');
  const { radioRuleFields } = await import('../src/shared/radio-rules');
  const { rulesSummary } = await import('../src/shared/rulesets');
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  const { w, a } = setup();
  assert.match(settingsFields(w.settings), /<legend>CB radios<\/legend>/);
  for (const key of Object.keys(radioRuleFields))
    assert.ok(settingsFields(w.settings).includes(`name="${key}"`), key);
  act(w, a.id, {
    type: 'settings',
    patch: { radioRange: 4500, radioCharsPerSecond: 10, radioEnabled: false },
  });
  assert.match(rulesSummary(w), /CB radios off.*4500/);
  assert.throws(
    () => act(w, a.id, { type: 'settings', patch: { radioTerrainSamples: 100 } }),
    /Invalid number/,
  );
  const dest = createWorld('destination', 'Destination', 'a');
  applyDesign(dest, exportDesign(w));
  assert.equal(dest.settings.radioRange, 4500);
  assert.equal(dest.settings.radioCharsPerSecond, 10);
  assert.equal(dest.settings.radioEnabled, false);
});
test('a listener entering range mid-transmission hears only the part spoken after arrival', async () => {
  const radio = await import('../src/shared/radio');
  const { w, a, b } = setup();
  w.settings.radioCharsPerSecond = 5;
  b.x = 10000;
  act(w, a.id, { type: 'radio', operation: 'key', text: 'first last' });
  radio.tickRadio(w, 1.2);
  b.x = 100;
  radio.tickRadio(w, 0.8);
  assert.equal(radio.radioView(w, b).traffic[0].text, 'last');
});
