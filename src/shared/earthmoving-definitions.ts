// SPDX-License-Identifier: GPL-3.0-or-later
import definitions from '../../data/earthmoving-vehicles.json';
import { automotiveConfig } from './automotive-config';
import type { World, VehicleDef } from './types';
/** Append-only fleet slots: never reuse a saved vehicle identity. */
export const BULLDOZER = 38;
export const BACKHOE = 39;
export const earthmovingProducts = { bulldozer: BULLDOZER, backhoe: BACKHOE } as const;
export function isEarthmover(slot: number) {
  return slot === BULLDOZER || slot === BACKHOE;
}
export function earthmovingVehicle(slot: number, w?: Pick<World, 'automotive'>): VehicleDef {
  const product = automotiveConfig(w).products[slot === BULLDOZER ? 'bulldozer' : 'backhoe'];
  return { ...definitions[slot === BULLDOZER ? 0 : 1], name: product.name, price: product.price };
}
