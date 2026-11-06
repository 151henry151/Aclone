// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { Building, World } from '../shared/types';
import { QUAY, quayPoint, quayDeckHeight } from '../shared/quay';
import { terrainHeight } from '../shared/terrain';
import { finishSurface } from './building-finishes';
export function quayDetails(root: T.Group) {
  const deck = new T.Group();
  deck.name = 'Freight quay open wharf';
  root.add(deck);
  function box(w: number, h: number, d: number, color: string, x: number, y: number, z: number) {
    const m = new T.Mesh(
      new T.BoxGeometry(w, h, d),
      new T.MeshStandardMaterial({ color, roughness: 0.85 }),
    );
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    deck.add(m);
    return m;
  }
  const z = -QUAY.gangwayEnd - QUAY.deckDepth / 2;
  const wharf = box(QUAY.frontage, 0.35, QUAY.deckDepth, '#b8b7a6', 0, -0.15, z);
  finishSurface(wharf, 'limestone', '#9ba495');
  const gangway = box(
    QUAY.gangwayWidth,
    0.22,
    QUAY.gangwayEnd + QUAY.landing,
    '#a58a61',
    0,
    -0.1,
    (-QUAY.gangwayEnd + QUAY.landing) / 2,
  );
  finishSurface(gangway, 'boards', '#aa8c60');
  for (let x = -QUAY.frontage / 2 + 1; x <= QUAY.frontage / 2 - 1; x += 3)
    for (const dz of [-QUAY.deckDepth / 2 + 0.4, QUAY.deckDepth / 2 - 0.4]) {
      const pile = box(0.38, 8, 0.38, '#585d51', x, -4, z + dz);
      pile.name = 'quay-pile';
      if (dz < 0) {
        box(0.65, 0.12, 0.5, '#3c4948', x, 0.08, z + dz);
        box(0.15, 0.6, 0.15, '#3c4948', x, 0.4, z + dz);
        box(0.65, 0.1, 0.15, '#3c4948', x, 0.7, z + dz);
        box(0.35, 1, 0.22, '#4d4233', x, -0.45, z - QUAY.deckDepth / 2 - 0.1);
      }
    }
  for (const side of [-1, 1])
    for (let k = 2; k < QUAY.gangwayEnd; k += 3) {
      box(0.1, 1, 0.1, '#645b45', (side * QUAY.gangwayWidth) / 2, 0.5, -k);
    }
  for (const side of [-1, 1])
    box(
      0.08,
      0.08,
      QUAY.gangwayEnd - 2,
      '#645b45',
      (side * QUAY.gangwayWidth) / 2,
      1,
      -QUAY.gangwayEnd / 2,
    );
  return deck;
}
export function fitQuayToWater(root: T.Object3D, b: Building, w: World) {
  const deck = root.getObjectByName('Freight quay open wharf');
  if (!deck) return;
  const base = b.foundationY ?? terrainHeight(w, b.x, b.z);
  deck.position.y = quayDeckHeight(w, b) - base;
  for (const pile of deck.children.filter((o) => o.name === 'quay-pile')) {
    const p = quayPoint(b, pile.position.x, pile.position.z),
      bed = terrainHeight(w, p.x, p.z) - base - deck.position.y;
    pile.scale.y = Math.max(0.5, -bed / 8);
    pile.position.y = bed / 2;
  }
}
