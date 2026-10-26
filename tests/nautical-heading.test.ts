// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nauticalHeading, nauticalHeadingLabel } from '../src/client/nautical-heading';

test('nautical headings agree across repeated turns in either direction', () => {
  for (const turns of [-20, -2, 0, 2, 20]) {
    for (const [heading, label] of [
      [Math.PI, '000° N'],
      [Math.PI / 2, '090° E'],
      [0, '180° S'],
      [-Math.PI / 2, '270° W'],
    ] as const) {
      const yaw = heading + turns * Math.PI * 2;
      assert.equal(nauticalHeadingLabel(yaw), label);
      assert.ok(nauticalHeading(yaw) >= 0 && nauticalHeading(yaw) < 360);
    }
  }
  assert.equal(nauticalHeadingLabel(11.412488147979602), '246° SW');
  assert.equal(nauticalHeadingLabel(Math.PI + 0.001), '000° N');
});
