// SPDX-License-Identifier: GPL-3.0-or-later
import truck from '../../data/highway-truck.json';
import type { World } from './types';
import { automotiveConfig } from './automotive-config';
/** Append only: existing persisted fleet slots retain their identity. */
export const HIGHWAY_TRACTOR = 37;
export const semiProducts = {
  semiBox: 'box',
  semiRefrigerated: 'refrigerated',
  semiStake: 'stake',
} as const;
export type SemiKind = keyof typeof semiProducts;
export const isSemitrailer = (kind: string): kind is SemiKind => Object.hasOwn(semiProducts, kind);
export function highwayTractor(w?: Pick<World, 'automotive'>) {
  const product = automotiveConfig(w).products.tractor;
  return { ...truck, name: product.name, price: product.price };
}
const colors = { box: '#d6dadd', refrigerated: '#e7eee4', stake: '#a76437' };
const descriptions = {
  box: 'Full-size enclosed dry freight body. No loose liquids, livestock or seafood.',
  refrigerated: 'Insulated perishable freight body. Separate purchased Fuel powers refrigeration.',
  stake: 'Full-size timber platform with bolsters, stakes and load restraints.',
};
export function semitrailerDefinition(kind: SemiKind, w?: Pick<World, 'automotive'>) {
  const r = automotiveConfig(w),
    product = semiProducts[kind];
  return {
    ...r.semitrailers[product],
    name: r.products[product].name,
    price: r.products[product].price,
    axles: 3,
    color: colors[product],
    description: descriptions[product],
  };
}
export const defaultSemitrailers = {
  semiBox: semitrailerDefinition('semiBox'),
  semiRefrigerated: semitrailerDefinition('semiRefrigerated'),
  semiStake: semitrailerDefinition('semiStake'),
};
