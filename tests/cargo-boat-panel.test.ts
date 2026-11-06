import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freightSetup } from './cargo-boat-hold.test';
import { freightPanel } from '../src/client/freight-panel';
test('freight panel exposes empty hold, timed inventory transfers and dockside shops', () => {
  const { w, p, d } = freightSetup();
  p.inventory = { stone: 10 };
  d.building!.sell.stone = 600;
  d.building!.owner = 'merchant';
  const html = freightPanel(w, p);
  assert.match(html, /Hold empty/);
  assert.match(html, /data-action="boatHold"/);
  assert.match(html, /Load inventory/);
  assert.match(html, /Buy into hold/);
  assert.match(
    html,
    /<option value="stone" data-price="600">/,
    'Bind the submitted quote to the displayed item price',
  );
  assert.match(html, /10 weight per second/);
});
