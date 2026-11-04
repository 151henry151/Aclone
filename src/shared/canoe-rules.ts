// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const CANOE = 34;
export const canoeRuleFields = {
  canoeSpeed: { label: 'Paddling speed (metres/second)', min: 0.2, max: 5, step: 0.1 },
  canoeCapacity: { label: 'Canoe hold weight', min: 1, max: 100, step: 1 },
  canoeMinDepth: { label: 'Minimum canoe depth (metres)', min: 0.01, max: 1, step: 0.01 },
  canoeStepOutDepth: { label: 'Maximum step-out depth (metres)', min: 0.05, max: 2, step: 0.05 },
  canoeBankRange: { label: 'Bank access range (metres)', min: 1, max: 10, step: 0.5 },
  canoeBankRise: { label: 'Maximum bank rise (metres)', min: 0.1, max: 3, step: 0.1 },
  canoeShoreSpeed: {
    label: 'Gentle shore contact speed (metres/second)',
    min: 0.2,
    max: 5,
    step: 0.1,
  },
  canoePrice: { label: 'Canoe price (hundredths)', min: 0, max: 1000000, step: 1 },
  canoeWeight: { label: 'Carried hull weight', min: 1, max: 100, step: 1 },
  canoeWood: { label: 'Wood to craft a canoe', min: 1, max: 1000, step: 1 },
  canoeCarrySpeed: { label: 'Carrying walking speed multiplier', min: 0.1, max: 1, step: 0.05 },
  canoeHomeLimit: { label: 'Canoes per home', min: 0, max: 100, step: 1 },
  canoeRange: { label: 'Canoe handling distance (metres)', min: 1, max: 10, step: 0.5 },
  canoeStoppedSpeed: { label: 'Maximum handling speed (metres/second)', min: 0, max: 1, step: 0.1 },
  canoePublicPickup: { label: 'Allow others to take set-down canoes' },
  canoeLoseOnLandDeath: { label: 'Lose set-down canoes on death' },
} as const;
export type CanoeRules = Pick<typeof defaults, keyof typeof canoeRuleFields>;
export function canoeRules(settings: Partial<CanoeRules> = {}): CanoeRules {
  return Object.fromEntries(
    Object.keys(canoeRuleFields).map((key) => [
      key,
      settings[key as keyof CanoeRules] ?? defaults[key as keyof CanoeRules],
    ]),
  ) as CanoeRules;
}

export function canoeVehicle(settings: Partial<CanoeRules> = {}): import('./types').VehicleDef {
  const r = canoeRules(settings);
  return {
    name: 'Canoe',
    mode: 3,
    speed: r.canoeSpeed,
    acceleration: 0.65,
    turn: 1.2,
    fuel: 0,
    capacity: r.canoeCapacity,
    armour: 100,
    price: r.canoePrice,
    color: '#a84e32',
    hitch: 0,
    collisionRadius: 0.46,
    length: 3.6,
    beam: 0.92,
  };
}
