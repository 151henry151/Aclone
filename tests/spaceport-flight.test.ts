// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spaceportFlight } from '../src/shared/spaceport-flight.ts';
test('cargo launches alternate three/four days and land half a game day later', () => {
  let launch = spaceportFlight('puddlewick', 0).next;
  assert.ok(launch >= 1800 && launch <= 2100);
  for (let i = 0; i < 8; i++) {
    const start = spaceportFlight('puddlewick', launch);
    assert.equal(start.phase, 'ignition');
    assert.equal(start.height, 0);
    assert.equal(spaceportFlight('puddlewick', launch + 30).phase, 'ascending');
    assert.equal(spaceportFlight('puddlewick', launch + 100).visible, false);
    assert.equal(spaceportFlight('puddlewick', launch + 275).phase, 'landing');
    assert.equal(spaceportFlight('puddlewick', launch + 300).height, 0);
    assert.equal(spaceportFlight('puddlewick', launch + 340).phase, 'docked');
    assert.equal(start.next - launch, (i % 2 === 0 ? 3 : 4) * 600);
    launch = start.next;
  }
});
test('flight phases are stateless, bounded and continuous at powered transitions', () => {
  const launch = spaceportFlight('test', 0).next;
  for (const t of [8, 65, 250, 300, 312]) {
    const a = spaceportFlight('test', launch + t - 1e-5),
      b = spaceportFlight('test', launch + t);
    assert.ok(Math.abs(a.height - b.height) < 0.01);
    assert.ok(b.thrust >= 0 && b.thrust <= 1);
  }
  assert.deepEqual(spaceportFlight('test', launch + 273), spaceportFlight('test', launch + 273));
  assert.equal(spaceportFlight('test', NaN).phase, 'docked');
});
