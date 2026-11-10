// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import * as labels from '../src/client/labels';
import { createWorld, addPlayer, act } from '../src/shared/simulation';
const noop = new Proxy({}, { get: () => () => undefined, set: () => true });
const canvas = () =>
  ({ width: 0, height: 0, getContext: () => noop }) as unknown as HTMLCanvasElement;
test('pilot tags use a compact single-line canvas and smaller model height', () => {
  const c = canvas(),
    tag = labels.pilotLabel('Mabel · AI', c);
  assert.ok(tag.scale.y <= 1.25, 'replace the oversized two-line pilot badge');
  assert.equal(c.height, 80);
  assert.equal(tag.material.depthTest, true);
  assert.equal(tag.material.depthWrite, false);
});
test('pilot tags fade by player proximity, cap screen height and restore after hiding', async () => {
  const { nameTagRules } = await import('../src/shared/name-tag-rules');
  const rules = nameTagRules();
  const parent = new T.Group(),
    tag = labels.pilotLabel('Ada', canvas());
  parent.add(tag);
  parent.scale.setScalar(3);
  const camera = new T.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const update = (distance: number, overrides = {}) =>
    (labels as any).updatePilotLabel(
      tag,
      { x: distance, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      camera,
      nameTagRules({ ...rules, ...overrides }),
      900,
    );
  update(10);
  assert.equal(tag.visible, true);
  assert.equal(tag.material.opacity, 0.8);
  const worldScale = tag.getWorldScale(new T.Vector3());
  assert.ok((worldScale.y / (20 * Math.tan(Math.PI / 6))) * 900 <= 24.00001);
  update(30);
  assert.equal(tag.material.opacity, 0.4);
  update(40);
  assert.equal(tag.visible, false);
  update(1, { pilotNameTags: false });
  assert.equal(tag.visible, false);
  update(1, { pilotNameTagOpacity: 0 });
  assert.equal(tag.visible, false);
  update(10);
  assert.equal(tag.visible, true);
  assert.equal(tag.material.opacity, 0.8);
  update(10, { pilotNameTagRange: 10, pilotNameTagFadeStart: 10 });
  assert.equal(tag.visible, false);
});
test('name-tag rules validate atomically and persist through all world-building surfaces', async () => {
  const { nameTagRules } = await import('../src/shared/name-tag-rules');
  const { settingsFields } = await import('../src/client/creator-editor');
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  const { rulesSummary } = await import('../src/shared/rulesets');
  const { Store } = await import('../src/server/store');
  const w = createWorld('tags', 'Tags', 'owner');
  addPlayer(w, 'owner', 'Owner');
  for (const key of Object.keys(nameTagRules())) delete (w.settings as any)[key];
  assert.equal(nameTagRules(w.settings).pilotNameTagRange, 40);
  const values = {
    ...nameTagRules(),
    worldNameTags: true,
    worldNameTagRange: 80,
    worldNameTagFadeStart: 25,
    worldNameTagMaxPixels: 16,
    worldNameTagOpacity: 0.6,
    focusNameTags: false,
    nameTagFocusRadius: 0.4,
    nameTagMaxVisible: 3,
    nameTagOverlapPadding: 6,
    pilotNameTags: false,
    pilotNameTagRange: 60,
    pilotNameTagFadeStart: 15,
    pilotNameTagScale: 0.4,
    pilotNameTagOpacity: 0.5,
    pilotNameTagMaxPixels: 18,
  };
  act(w, 'owner', { type: 'settings', patch: values });
  for (const [key, value] of Object.entries(values)) assert.equal((w.settings as any)[key], value);
  for (const patch of [
    { worldNameTagFadeStart: 81 },
    { nameTagMaxVisible: 1.5 },
    { nameTagFocusRadius: 0 },
    { worldNameTags: 'yes' },
    { pilotNameTagRange: 0 },
    { pilotNameTagFadeStart: 61 },
    { pilotNameTagScale: NaN },
    { pilotNameTagOpacity: 2 },
    { pilotNameTagMaxPixels: Infinity },
    { pilotNameTags: 'yes' },
  ]) {
    const before = structuredClone(w.settings);
    assert.throws(() => act(w, 'owner', { type: 'settings', patch } as any));
    assert.deepEqual(w.settings, before);
  }
  const fields = settingsFields(w.settings);
  for (const key of Object.keys(values)) assert.match(fields, new RegExp('name="' + key + '"'));
  assert.match(rulesSummary(w), /Pilot name tags/);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    assert.deepEqual(nameTagRules(store.loadWorlds()[0].world.settings), values);
    const dest = createWorld('dest', 'Destination', 'other');
    applyDesign(dest, exportDesign(w));
    assert.deepEqual(nameTagRules(dest.settings), values);
    const invalid = exportDesign(w);
    (invalid.settings as any).pilotNameTagFadeStart = 61;
    const before = structuredClone(dest);
    assert.throws(() => applyDesign(dest, invalid));
    assert.deepEqual(dest, before);
  } finally {
    store.close();
  }
});
