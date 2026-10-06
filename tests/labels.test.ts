// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { label, pilotLabel } from '../src/client/labels.ts';

const noop = new Proxy({}, { get: () => () => undefined, set: () => true });
const canvas = () =>
  ({ width: 0, height: 0, getContext: () => noop }) as unknown as HTMLCanvasElement;

test('signs draw after transparent scenery such as the sea, so it cannot paint over them', () => {
  const sign = label('HORN BALL · RUST / MOSS', undefined, 1, canvas());
  assert.equal(sign.material.depthTest, false);
  // Rocket smoke (renderOrder 2) is the latest-ordered transparent scenery.
  assert.ok(sign.renderOrder > 2);
  const tag = pilotLabel('Hank', canvas());
  assert.ok(tag.renderOrder > 2);
  assert.equal(tag.material.depthTest, true);
});
