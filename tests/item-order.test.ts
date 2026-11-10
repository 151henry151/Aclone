// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itemEntries } from '../src/client/item-order';
test('available goods come first, names sort alphabetically and IDs break ties without mutation', () => {
  const defs = {
    z: { name: 'Apple' },
    a: { name: 'Zebra' },
    b: { name: 'apple' },
    n: { name: 'Box 10' },
    m: { name: 'Box 2' },
  };
  const values = { a: 9, z: 1, n: 7, b: 3, m: 8, unknown: 1 };
  const stock = { a: 2, b: 1, z: 0, n: -1 };
  const before = JSON.stringify({ defs, values, stock });
  assert.deepEqual(
    itemEntries(values, defs, stock).map(([id]) => id),
    ['b', 'a', 'z', 'm', 'n', 'unknown'],
  );
  assert.deepEqual(
    itemEntries(values, defs, {}).map(([id]) => id),
    ['b', 'z', 'm', 'n', 'unknown', 'a'],
  );
  assert.deepEqual(itemEntries({}, defs, stock), []);
  assert.deepEqual(
    itemEntries(values, defs, stock, { z: 4 })
      .slice(0, 3)
      .map(([id]) => id),
    ['b', 'z', 'a'],
  );
  assert.equal(JSON.stringify({ defs, values, stock }), before);
});
