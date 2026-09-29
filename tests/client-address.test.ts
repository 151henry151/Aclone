// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientAddress } from '../src/server/client-address.ts';

test('direct connections use the socket address', () => {
  assert.equal(clientAddress('203.0.113.8', '198.51.100.1'), '203.0.113.8');
  assert.equal(clientAddress(undefined, undefined), 'unknown');
});

test('loopback proxies use a single X-Real-IP', () => {
  assert.equal(clientAddress('127.0.0.1', '203.0.113.9'), '203.0.113.9');
  assert.equal(clientAddress('::ffff:127.0.0.1', '203.0.113.9'), '203.0.113.9');
  assert.equal(clientAddress('::1', ' 2001:db8::1 '), '2001:db8::1');
  assert.equal(clientAddress('127.0.0.1', '203.0.113.9, 198.51.100.1'), '127.0.0.1');
  assert.equal(clientAddress('127.0.0.1', undefined), '127.0.0.1');
});
