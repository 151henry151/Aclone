// SPDX-License-Identifier: GPL-3.0-or-later
import { z } from 'zod';
import defaults from '../../data/automotive.json';
import type { BuildingDef, World } from './types';
const money = z.number().int().min(0).max(100_000_000);
const quantities = z
  .record(z.string().min(1).max(64), z.number().int().min(1).max(1_000_000))
  .refine((v) => Object.keys(v).length <= 32);
const exportsSchema = z
  .object({
    enabled: z.boolean(),
    interval: z.number().int().min(3600).max(604800),
    units: z.number().int().min(1).max(16),
    priceFraction: z.number().finite().min(0).max(1),
  })
  .strict();
const factorySchema = z
  .object({
    tier: z.number().int().min(0).max(10),
    price: money,
    capacity: z.number().int().min(1).max(1_000_000),
    materials: quantities,
    buy: z.record(z.string().min(1).max(64), money).refine((v) => Object.keys(v).length <= 32),
    idealEmployees: z.number().int().min(1).max(16),
    wage: money,
    skill: z.string().min(1).max(64),
    readyCapacity: z.number().int().min(1).max(64),
  })
  .strict();
const productSchema = z
  .object({
    name: z.string().trim().min(1).max(64),
    inputs: quantities.refine((v) => Object.keys(v).length > 0 && Object.keys(v).length <= 8),
    seconds: z.number().int().min(10).max(86400),
    price: money,
  })
  .strict();
const drivingSchema = z
  .object({
    dirtSpeed: z.number().finite().min(0.5).max(60),
    offRoadSpeed: z.number().finite().min(0.1).max(30),
    reverseSpeed: z.number().finite().min(0.1).max(15),
    braking: z.number().finite().min(0.1).max(20),
    coasting: z.number().finite().min(0).max(10),
    rollingDrag: z.number().finite().min(0).max(1),
    loadedAcceleration: z.number().finite().min(0.05).max(1),
    minimumTurnRadius: z.number().finite().min(3).max(40),
    lateralAcceleration: z.number().finite().min(0.2).max(10),
    hitchRange: z.number().finite().min(0.1).max(3),
    hitchAlignment: z.number().finite().min(1).max(45),
    maximumArticulation: z.number().finite().min(15).max(85),
    maximumTerrainGrade: z.number().finite().min(0).max(2),
    suspensionTravel: z.number().finite().min(0).max(3),
  })
  .strict();
const refrigerationSchema = z
  .object({
    enabled: z.boolean(),
    fuelCapacity: z.number().finite().min(0.1).max(1000),
    fuelPerHour: z.number().finite().min(0).max(100),
    ageingMultiplier: z.number().finite().min(0).max(1),
  })
  .strict();
const couplingSchema = z
  .object({
    fifthWheelZ: z.number().finite().min(-5).max(0),
    kingpinInset: z.number().finite().min(0.3).max(2.5),
    axleRearInset: z.number().finite().min(0.5).max(3),
  })
  .strict();
const deliverySchema = z
  .object({
    range: z.number().finite().min(1).max(100),
    maxOwnedSemitrailers: z.number().int().min(1).max(100),
  })
  .strict();
const semitrailerSchema = z
  .object({
    length: z.number().finite().min(6).max(25),
    width: z.number().finite().min(1.5).max(4),
    height: z.number().finite().min(2).max(6),
    capacity: z.number().int().min(1).max(100_000),
  })
  .strict();
const semitrailersSchema = z
  .object({ box: semitrailerSchema, refrigerated: semitrailerSchema, stake: semitrailerSchema })
  .strict();
export const automotiveProducts = ['tractor', 'box', 'refrigerated', 'stake'] as const;
export type AutomotiveProduct = (typeof automotiveProducts)[number];
export const automotiveSchema = z
  .object({
    enabled: z.boolean(),
    factory: factorySchema,
    exports: exportsSchema.default(defaults.exports),
    delivery: deliverySchema.default(defaults.delivery),
    refrigeration: refrigerationSchema.default(defaults.refrigeration),
    coupling: couplingSchema.default(defaults.coupling),
    driving: drivingSchema.default(defaults.driving),
    semitrailers: semitrailersSchema.default(defaults.semitrailers),
    products: z
      .object({
        tractor: productSchema,
        box: productSchema,
        refrigerated: productSchema,
        stake: productSchema,
      })
      .strict(),
  })
  .strict();
export type AutomotiveConfig = z.infer<typeof automotiveSchema>;
export const automotivePatchSchema = z
  .object({
    enabled: z.boolean().optional(),
    factory: factorySchema.partial().optional(),
    exports: exportsSchema.partial().optional(),
    delivery: deliverySchema.partial().optional(),
    refrigeration: refrigerationSchema.partial().optional(),
    coupling: couplingSchema.partial().optional(),
    driving: drivingSchema.partial().optional(),
    semitrailers: z
      .object({
        box: semitrailerSchema.partial().optional(),
        refrigerated: semitrailerSchema.partial().optional(),
        stake: semitrailerSchema.partial().optional(),
      })
      .strict()
      .optional(),
    products: z
      .object({
        tractor: productSchema.partial().optional(),
        box: productSchema.partial().optional(),
        refrigerated: productSchema.partial().optional(),
        stake: productSchema.partial().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export function automotiveConfig(w?: Pick<World, 'automotive'>): AutomotiveConfig {
  return w?.automotive ?? defaults;
}
export function patchAutomotive(w: Pick<World, 'automotive'>, input: unknown) {
  const patch = automotivePatchSchema.parse(input),
    current = automotiveConfig(w);
  return automotiveSchema.parse({
    ...current,
    ...patch,
    factory: { ...current.factory, ...patch.factory },
    exports: { ...current.exports, ...patch.exports },
    delivery: { ...current.delivery, ...patch.delivery },
    refrigeration: { ...current.refrigeration, ...patch.refrigeration },
    coupling: { ...current.coupling, ...patch.coupling },
    driving: { ...current.driving, ...patch.driving },
    semitrailers: Object.fromEntries(
      (['box', 'refrigerated', 'stake'] as const).map((id) => [
        id,
        { ...current.semitrailers[id], ...patch.semitrailers?.[id] },
      ]),
    ),
    products: Object.fromEntries(
      automotiveProducts.map((id) => [id, { ...current.products[id], ...patch.products?.[id] }]),
    ),
  });
}
export function automotiveBuilding(w?: Pick<World, 'automotive'>): BuildingDef {
  const f = automotiveConfig(w).factory;
  return {
    name: 'Automotive factory',
    price: f.price,
    capacity: f.capacity,
    materials: f.materials,
    buy: f.buy,
    sell: {},
    stock: {},
    wage: f.wage,
    idealEmployees: f.idealEmployees,
    tier: f.tier,
    color: '#697e83',
  };
}

export function validateAutomotiveReferences(
  config: AutomotiveConfig,
  items: Record<string, unknown>,
  skills: string[],
) {
  if (!skills.includes(config.factory.skill)) throw Error('Unknown manufacturing profession');
  for (const stock of [
    config.factory.materials,
    config.factory.buy,
    ...Object.values(config.products).map((r) => r.inputs),
  ])
    if (!Object.keys(stock).every((id) => Object.hasOwn(items, id)))
      throw Error('Unknown manufacturing item');
}
