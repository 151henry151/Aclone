// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saleTag, saleTagText } from '../src/client/sale-tag.ts';
import { createWorld, money } from '../src/shared/simulation.ts';

const drawn: string[] = [];
const context: object = new Proxy(
  {},
  {
    get: (_, key) =>
      key === 'fillText'
        ? (text: string) => drawn.push(text)
        : key === 'measureText'
          ? (text: string) => ({ width: text.length * 10 })
          : () => context,
    set: () => true,
  },
);
const canvas = () =>
  ({ width: 0, height: 0, getContext: () => context }) as unknown as HTMLCanvasElement;

test('only properties their owner has listed carry a sale tag with the asking price', () => {
  const w = createWorld('sale', 'Sale', 'owner');
  const b = w.buildings.find((b) => !b.government)!;
  b.owner = undefined;
  b.forSale = false;
  assert.equal(saleTagText(w, b), undefined, 'vacant estates are not "listed"');
  b.owner = 'someone';
  assert.equal(saleTagText(w, b), undefined);
  b.forSale = true;
  b.price = 1_220_000;
  assert.equal(saleTagText(w, b), `For sale · ${money(1_220_000, w.settings.denariiPerSheckle)}`);
});

test('the sale tag draws its text on a sprite that stays on top of other scenery', () => {
  drawn.length = 0;
  const tag = saleTag('For sale · 12s 20d', canvas());
  assert.ok(drawn.includes('12s 20d'), 'the asking price is legible on the tag');
  assert.ok(drawn.includes('FOR SALE'));
  assert.equal(tag.material.depthTest, false);
  assert.ok(tag.renderOrder > 2);
  assert.equal(tag.userData.saleText, 'For sale · 12s 20d');
});
