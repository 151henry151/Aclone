// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const parkingFields = {
  garageStorageEnabled: { label: 'Allow new garage storage' },
  garageStorageRange: {
    label: 'Garage storage handling reach (metres)',
    min: 1,
    max: 100,
    step: 1,
  },
  garageStorageLimit: {
    label: 'Stored vehicles and trailers per player per garage (0 = unlimited)',
    min: 0,
    max: 10000,
    step: 1,
  },
  parkingBoardHeight: { label: 'Boarding height tolerance (metres)', min: 0.1, max: 20, step: 0.1 },
  vehiclesPersist: { label: 'Vehicles persist in the world' },
  parkingNpcs: { label: 'Residents must return to parked vehicles' },
  garageStoresSpareTractors: { label: 'Store spare tractors in garages' },
  parkingSignOff: { label: 'Park vehicles on sign-off' },
  parkingGraceDays: { label: 'Public-road parking grace (game days)', min: 0, max: 365, step: 1 },
  parkingTowFee: { label: 'Towing fee (hundredths of a denarius)', min: 0, max: 10000000, step: 1 },
  parkingReturnRange: {
    label: 'Boarding and refuelling reach (metres)',
    min: 1,
    max: 20,
    step: 0.1,
  },
  parkingDoorOffset: {
    label: 'Driver-side standing offset (metres)',
    min: 0.5,
    max: 10,
    step: 0.1,
  },
  parkingSearchRange: { label: 'Safe kerb search reach (metres)', min: 5, max: 100, step: 1 },
  parkingMountSeconds: {
    label: 'Mount and dismount duration (seconds)',
    min: 0,
    max: 10,
    step: 0.1,
  },
  arrivalWallClearance: {
    label: 'Arrival pedestrian wall clearance (metres)',
    min: 0.1,
    max: 2,
    step: 0.05,
  },
  arrivalWalkIn: { label: 'Allow building entry while walking' },
  arrivalAnimation: { label: 'Arrival animations', choices: ['full', 'quick', 'off'] },
  arrivalQuickSeconds: { label: 'Quick arrival duration (seconds)', min: 0.1, max: 10, step: 0.1 },
  arrivalMinSeconds: { label: 'Shortest full arrival (seconds)', min: 0.1, max: 30, step: 0.1 },
  arrivalMaxSeconds: { label: 'Longest full arrival (seconds)', min: 0.1, max: 60, step: 0.1 },
  arrivalRange: { label: 'Building approach reach (metres)', min: 1, max: 50, step: 1 },
  arrivalDoorDegrees: { label: 'Pedestrian door swing (degrees)', min: 1, max: 150, step: 1 },
} as const;
export type ParkingRules = Pick<typeof defaults, keyof typeof parkingFields>;
export function parkingRules(settings: Partial<ParkingRules> = {}): ParkingRules {
  return Object.fromEntries(
    Object.keys(parkingFields).map((key) => [
      key,
      settings[key as keyof ParkingRules] ?? defaults[key as keyof ParkingRules],
    ]),
  ) as ParkingRules;
}
