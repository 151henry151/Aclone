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

import { trailerPanel } from '../src/client/trailer-panel';
test('hold and trailer cargo selectors sort stocked goods by name and leave empty shop entries last', () => {
  const { w, p, d } = freightSetup();
  p.inventory = { water: 2, bread: 2, fuel: 2 };
  p.boatHold = { water: 2, bread: 2 };
  const b = d.building!;
  Object.assign(b, {
    owner: 'merchant',
    sell: { water: 200, fuel: 200, bread: 200 },
    stock: { water: 3, bread: 3 },
  });
  const options = (html: string, label: string) => {
    const select = html.slice(html.indexOf(label + '<select'));
    return [
      ...select.slice(0, select.indexOf('</select>')).matchAll(/<option value="([^"]+)"/g),
    ].map((m) => m[1]);
  };
  assert.deepEqual(options(freightPanel(w, p), 'Buy into hold'), ['bread', 'water', 'fuel']);
  w.trailers = {
    t: {
      id: 't',
      owner: p.id,
      kind: 'box',
      x: p.x,
      z: p.z,
      heading: 0,
      attached: p.id,
      cargo: { water: 2, bread: 2 },
    },
  };
  const html = trailerPanel(w, p, b);
  assert.deepEqual(options(html, 'Buy into trailer'), ['bread', 'fuel']);
  assert.ok(
    !options(html, 'Buy into trailer').includes('water'),
    'box trailer still rejects liquid Water',
  );
  assert.ok(html.indexOf('Bread: 2') < html.indexOf('Water: 2'));
});
