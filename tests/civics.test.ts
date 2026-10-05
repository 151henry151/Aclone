// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/shared/simulation.ts';
import {
  buildingCategory,
  categories,
  nearestTown,
  normalizeTowns,
  townAt,
  townCharter,
} from '../src/shared/civics.ts';

test('a new world has one bordered Puddlewick with an empty treasury and default charter', () => {
  const w = createWorld('civics', 'Civics', 'owner');
  assert.equal(w.towns.length, 1);
  const [town] = w.towns;
  const plinth = w.buildings.find((b) => b.kind === 'town')!;
  assert.equal(town.id, 'puddlewick');
  assert.equal(town.plinth, plinth.id);
  assert.deepEqual([town.x, town.z], [plinth.x, plinth.z]);
  assert.equal(town.radius, 300);
  assert.equal(town.treasury, 0);
  assert.equal(town.tax, 0.02);
  assert.equal(town.salesTax, 0.02);
  assert.equal(town.wageTax, 0);
  assert.deepEqual(town.zoning, { north: [...categories], south: [...categories] });
  assert.equal(town.governance, 'election');
  const charter = townCharter(w);
  assert.equal(charter.founding, true);
  assert.equal(charter.outside, 'allow');
  assert.ok(charter.governance.includes('direct'));
  assert.ok(charter.controls.includes('constructionTax'));
});

test('saved single-town worlds gain borders without losing mayor, residents or tax', () => {
  const w = createWorld('old', 'Old', 'owner');
  w.towns = [
    { name: 'Puddlewick', tax: 0.07, mayor: 'm', residents: ['m', 'r'], wars: [] },
  ] as unknown as typeof w.towns;
  normalizeTowns(w);
  const [town] = w.towns;
  assert.equal(town.mayor, 'm');
  assert.deepEqual(town.residents, ['m', 'r']);
  assert.equal(town.tax, 0.07);
  assert.equal(town.salesTax, 0.07, 'the old tax also applied to sales');
  assert.equal(town.radius, 300);
  const before = structuredClone(w.towns);
  normalizeTowns(w);
  assert.deepEqual(w.towns, before, 'migration is idempotent');
});

test('compact worlds keep their town border inside the map', () => {
  const w = createWorld('arena', 'Arena', 'owner', 'combat');
  assert.ok(w.towns[0].radius <= 250);
});

test('towns are found by border and by nearest centre', () => {
  const w = createWorld('find', 'Find', 'owner');
  w.towns.push({ ...structuredClone(w.towns[0]), id: 'east', name: 'East', x: 1000, radius: 150 });
  assert.equal(townAt(w, 10, 10)?.id, 'puddlewick');
  assert.equal(townAt(w, 1100, 0)?.id, 'east');
  assert.equal(townAt(w, 600, 0), undefined);
  assert.equal(nearestTown(w, 400, 0)?.id, 'puddlewick');
  assert.equal(nearestTown(w, 800, 0)?.id, 'east');
});

test('buildings fall into zoning categories, including custom templates by base type', () => {
  const w = createWorld('cats', 'Cats', 'owner');
  assert.equal(buildingCategory(w, 'home'), 'residential');
  assert.equal(buildingCategory(w, 'hotel'), 'residential');
  assert.equal(buildingCategory(w, 'market'), 'commercial');
  assert.equal(buildingCategory(w, 'farm'), 'agricultural');
  assert.equal(buildingCategory(w, 'sawmill'), 'industrial');
  assert.equal(buildingCategory(w, 'rareMine'), 'advanced');
  assert.equal(buildingCategory(w, 'school'), 'civic');
  w.catalogue = {
    templates: { villa: { base: 'home' } },
  } as unknown as typeof w.catalogue;
  assert.equal(buildingCategory(w, 'villa'), 'residential');
});
