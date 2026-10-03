// SPDX-License-Identifier: GPL-3.0-or-later
import itemData from '../../data/items.json';
import vehicleData from '../../data/vehicles.json';
import buildingData from '../../data/buildings.json';
import recipeData from '../../data/recipes.json';
import weaponData from '../../data/weapons.json';
import settingsData from '../../data/settings.json';
import galaxyData from '../../data/galaxy.json';
import type { ItemDef, VehicleDef, BuildingDef, Recipe, WeaponDef, Settings } from './types';
export const items: Record<string, ItemDef> = itemData;
export const vehicles: VehicleDef[] = vehicleData;
export const buildings: Record<string, BuildingDef> = buildingData;
export const recipes: Record<string, Recipe> = recipeData;
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
    'boatmaster',
  ]),
];
export const checkpoints = [
  { x: -75, z: -20 },
  { x: -105, z: 30 },
  { x: -75, z: 80 },
  { x: -45, z: 30 },
];
