import { highwayTractor } from './highway-definitions';
import { automotiveBuilding } from './automotive-config';
import { canoeVehicle } from './canoe-rules';
import { meatRecipes } from './meat-recipes';
// SPDX-License-Identifier: GPL-3.0-or-later
import itemData from '../../data/items.json';
import vehicleData from '../../data/vehicles.json';
import rowboatData from '../../data/rowboats.json';
import freightVesselData from '../../data/freight-vessels.json';
import buildingData from '../../data/buildings.json';
import recipeData from '../../data/recipes.json';
import weaponData from '../../data/weapons.json';
import settingsData from '../../data/settings.json';
import galaxyData from '../../data/galaxy.json';
import type { ItemDef, VehicleDef, BuildingDef, Recipe, WeaponDef, Settings } from './types';
export const items: Record<string, ItemDef> = {
  ...itemData,
  canoe: { name: 'Canoe', weight: settingsData.canoeWeight, price: settingsData.canoePrice },
  fuel: { ...itemData.fuel, fuel: settingsData.fuelUnitsPerItem },
};
export const vehicles: VehicleDef[] = [
  ...vehicleData,
  canoeVehicle(),
  ...(freightVesselData as VehicleDef[]),
  ...(rowboatData as VehicleDef[]),
  highwayTractor(),
];
export const buildings: Record<string, BuildingDef> = {
  automotiveFactory: automotiveBuilding(),
  ...Object.fromEntries(
    Object.entries(buildingData).map(([kind, def]) => [
      kind,
      ['market', 'starport'].includes(kind)
        ? {
            ...def,
            buy: { ...def.buy, canoe: Math.floor(items.canoe.price / 2) },
            sell: { ...def.sell, canoe: items.canoe.price * 2 },
          }
        : def,
    ]),
  ),
};
export const recipes: Record<string, Recipe> = {
  ...recipeData,
  ...meatRecipes(),
  pumpHouse: {
    ...recipeData.waterworks,
    inputs: { fuel: settingsData.pumpFuelPerBatch },
    outputs: { water: settingsData.pumpWaterPerBatch },
  },
};
export const weapons: Record<string, WeaponDef> = weaponData;
export const defaults: Settings = settingsData;
export const galaxy = galaxyData;
export const skills = [
  ...new Set([
    ...Object.values(recipes).map((r) => r.skill),
    'innkeeper',
    'forester',
    'excavator',
    'mechanic',
    'driver',
    'pilot',
    'captain',
  ]),
];
export const checkpoints = [
  { x: -75, z: -20 },
  { x: -105, z: 30 },
  { x: -75, z: 80 },
  { x: -45, z: 30 },
];
