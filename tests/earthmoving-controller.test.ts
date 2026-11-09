// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Controller } from '../src/client/controller';

test('implement controls honor remapping, press edges, menus and disconnected or hidden tabs', () => {
  const keys = ['navigator', 'document', 'localStorage'] as const,
    originals = keys.map((key) => Object.getOwnPropertyDescriptor(globalThis, key));
  const pad = {
      connected: true,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
    },
    doc = {
      hidden: false,
      activeElement: undefined,
      querySelector: () => ({ querySelectorAll: () => [] }),
    };
  let connected = true,
    count = 0;
  try {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { getGamepads: () => (connected ? [pad] : []) },
    });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: () => '{"implement":3}' },
    });
    const c = new Controller(
      () => {},
      () => {},
      () => {},
      () => {},
      () => {},
      () => count++,
    );
    pad.buttons[2].pressed = true;
    c.poll(false);
    assert.equal(count, 0);
    pad.buttons[2].pressed = false;
    pad.buttons[3].pressed = true;
    c.poll(false);
    assert.equal(count, 1, 'the saved implement button must operate the implement');
    c.poll(false);
    assert.equal(count, 1, 'holding cannot chatter the implement');
    pad.buttons[3].pressed = false;
    c.poll(false);
    pad.buttons[3].pressed = true;
    c.poll(true);
    assert.equal(count, 1);
    pad.buttons[3].pressed = false;
    c.poll(false);
    doc.hidden = true;
    pad.buttons[3].pressed = true;
    c.poll(false);
    assert.equal(count, 1);
    doc.hidden = false;
    connected = false;
    c.poll(false);
    assert.equal(count, 1);
    connected = true;
    pad.buttons[3].pressed = false;
    c.poll(false);
    pad.buttons[3].pressed = true;
    c.poll(false);
    assert.equal(count, 2);
  } finally {
    keys.forEach((key, i) => {
      if (originals[i]) Object.defineProperty(globalThis, key, originals[i]!);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
});
