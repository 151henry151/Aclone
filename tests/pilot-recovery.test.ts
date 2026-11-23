// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePilotKey } from '../src/client/pilot-recovery.ts';
const key = 'a'.repeat(43);
test('restore accepts a key or the exported recovery document, including password-input newline removal', () => {
  const document = `Aclone pilot: Test pilot\nKeep this key private. Paste it into Restore pilot.\n\n${key}\n`;
  for (const text of [
    key,
    `  ${key}\n`,
    document,
    document.replace(/\n/g, ''),
    document.replace(/\n/g, '\r\n'),
  ])
    assert.equal(parsePilotKey(text), key);
  for (const text of ['', 'Test pilot', key + ' ' + key, document + key])
    assert.throws(() => parsePilotKey(text), /Paste/);
});

test('restore leaves legacy credential validation to the server', () => {
  assert.equal(parsePilotKey('b'.repeat(64)), 'b'.repeat(64));
  assert.throws(() => parsePilotKey('b'.repeat(101)), /Paste/);
});
