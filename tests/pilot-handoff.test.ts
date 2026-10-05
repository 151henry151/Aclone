// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adoptCarriedPilot } from '../src/client/pilot-handoff.ts';

test('a pilot key carried in the URL hash is stored and removed from the address', () => {
  const saved: Record<string, string> = {};
  const storage = { setItem: (k: string, v: string) => void (saved[k] = v) };
  assert.equal(adoptCarriedPilot('#pilot=secret&world=puddlewick&tab=map', storage), '#tab=map');
  assert.deepEqual(saved, { 'aclone.pilot': 'secret', 'aclone.world': 'puddlewick' });
  assert.equal(adoptCarriedPilot('#pilot=other', storage), '');
  assert.equal(saved['aclone.pilot'], 'other');
  assert.equal(adoptCarriedPilot('#tab=map', storage), '#tab=map');
});
