// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicPath } from '../src/shared/public-path.ts';

test('root base leaves absolute paths unchanged', () => {
  assert.equal(publicPath('/', '/api/health'), '/api/health');
  assert.equal(publicPath('/', '/ws'), '/ws');
  assert.equal(publicPath('/', '/world-assets/abc.png'), '/world-assets/abc.png');
});

test('subpath base prefixes API, websocket, and asset paths once', () => {
  assert.equal(publicPath('/aclone/', '/api/galaxy'), '/aclone/api/galaxy');
  assert.equal(publicPath('/aclone', '/ws'), '/aclone/ws');
  assert.equal(publicPath('/aclone/', '/world-assets/ab.png'), '/aclone/world-assets/ab.png');
});
