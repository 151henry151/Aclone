// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import * as labels from '../src/client/labels';
import { nameTagRules } from '../src/shared/name-tag-rules';
const noop = new Proxy({}, { get: () => () => undefined, set: () => true });
const canvas = () =>
  ({ width: 0, height: 0, getContext: () => noop }) as unknown as HTMLCanvasElement;
function setup() {
  const camera = new T.PerspectiveCamera(60, 1.6, 0.1, 1000);
  camera.position.set(0, 2, 10);
  camera.lookAt(0, 2, 0);
  camera.updateMatrixWorld();
  const item = (id: string, x: number, z: number, kind = 'vehicle') => {
    const tag = labels.pilotLabel(id, canvas());
    tag.position.set(x, 3, z);
    return { id, tag, kind, subject: new T.Vector3(x, 1, z) };
  };
  return { camera, item };
}
const update = (...args: any[]) => (labels as any).updateContextLabels(...args);
test('focused nearby names appear, distant and behind-camera names disappear, with a small pixel cap', () => {
  const { camera, item } = setup();
  const a = item('near', 0, 0),
    far = item('far', 0, -100),
    behind = item('behind', 0, 20),
    side = item('side', 20, 0);
  update([a, far, behind, side], { x: 0, y: 0, z: 5 }, camera, nameTagRules(), 1440, 900, false);
  assert.equal(a.tag.visible, true);
  for (const t of [far, behind, side]) assert.equal(t.tag.visible, false);
  assert.equal(a.tag.material.depthTest, true);
  const depth = 10;
  assert.ok((a.tag.scale.y / (2 * depth * Math.tan(Math.PI / 6))) * 900 <= 18.001);
});
test('overlapping labels yield to the subject closest to view centre and restore after turning', () => {
  const { camera, item } = setup();
  const a = item('centre', 0, 0),
    b = item('offset', 0.15, 0);
  update([b, a], { x: 0, y: 0, z: 5 }, camera, nameTagRules(), 1440, 900, false);
  assert.equal(a.tag.visible, true);
  assert.equal(b.tag.visible, false);
  camera.lookAt(0.15, 1, 0);
  camera.updateMatrixWorld();
  update([b], { x: 0, y: 0, z: 5 }, camera, nameTagRules(), 1440, 900, false);
  assert.equal(b.tag.visible, true);
  update([b], { x: 0, y: 0, z: 5 }, camera, nameTagRules(), 1440, 900, true);
  assert.equal(b.tag.visible, false);
});
test('custom label switches/range/opacity/count are respected and occluded subjects are hidden', () => {
  const { camera, item } = setup();
  const a = item('a', 0, 0);
  update(
    [a],
    { x: 0, y: 0, z: 5 },
    camera,
    nameTagRules({ worldNameTags: false } as any),
    1440,
    900,
    false,
  );
  assert.equal(a.tag.visible, false);
  update(
    [a],
    { x: 0, y: 0, z: 5 },
    camera,
    nameTagRules({ worldNameTagRange: 2 } as any),
    1440,
    900,
    false,
  );
  assert.equal(a.tag.visible, false);
  update([a], { x: 0, y: 0, z: 5 }, camera, nameTagRules(), 1440, 900, false, () => true);
  assert.equal(a.tag.visible, false);
  update(
    [a],
    { x: 0, y: 0, z: 5 },
    camera,
    nameTagRules({ worldNameTagOpacity: 0.3 } as any),
    1440,
    900,
    false,
  );
  assert.equal(a.tag.material.opacity, 0.3);
});

test('the configured count bounds visibility and occlusion checks', () => {
  const { camera, item } = setup();
  const candidates = [item('a', 0, 0), item('b', 3, 0), item('c', -3, 0)];
  let calls = 0;
  const visible = update(
    candidates,
    { x: 0, y: 0, z: 5 },
    camera,
    nameTagRules({ nameTagMaxVisible: 1 } as any),
    1440,
    900,
    false,
    () => {
      calls++;
      return false;
    },
  );
  assert.deepEqual(visible, ['a']);
  assert.equal(calls, 1);
});
test('structural boxes hide a rear subject but not a building own label', () => {
  const { camera, item } = setup(),
    a = item('rear', 0, 0),
    building = new T.Group();
  building.position.set(0, 0, 5);
  building.userData.cameraVolumes = [new T.Box3(new T.Vector3(-2, 0, -1), new T.Vector3(2, 5, 1))];
  const occlusion = new labels.LabelOcclusion();
  assert.equal(occlusion.blocked(a as labels.ContextLabel, camera, [building]), true);
  assert.equal(
    occlusion.blocked({ ...a, owner: building } as labels.ContextLabel, camera, [building]),
    false,
  );
  building.visible = false;
  assert.equal(occlusion.blocked(a as labels.ContextLabel, camera, [building]), false);
});
