// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const solidSceneryModes = ['off', 'trunks', 'trunks-and-boulders'] as const;
export const vehicleCollisionModes = ['off', 'stop-only', 'glancing'] as const;
export const obstacleRuleFields = {
  offlineVehicleObstacleSeconds: {
    label: 'Offline vehicle obstacle timeout (seconds)',
    min: 0,
    max: 86400,
    step: 1,
  },
  vehicleGlancingDegrees: { label: 'Maximum glancing angle (degrees)', min: 0, max: 45, step: 1 },
  vehicleGlancingSpeed: { label: 'Glancing speed multiplier', min: 0, max: 1, step: 0.01 },
} as const;
export const obstacleRuleKeys = [
  'solidScenery',
  'vehicleCollision',
  'pedestrianBlocking',
  'clearRouteParking',
  ...Object.keys(obstacleRuleFields),
] as const;
export type ObstacleRules = Pick<
  typeof defaults,
  | 'solidScenery'
  | 'vehicleCollision'
  | 'pedestrianBlocking'
  | 'clearRouteParking'
  | keyof typeof obstacleRuleFields
>;
export function obstacleRules(settings: Partial<ObstacleRules> = {}) {
  return {
    solidScenery: settings.solidScenery ?? defaults.solidScenery,
    vehicleCollision: settings.vehicleCollision ?? defaults.vehicleCollision,
    pedestrianBlocking: settings.pedestrianBlocking ?? defaults.pedestrianBlocking,
    clearRouteParking: settings.clearRouteParking ?? defaults.clearRouteParking,
    offlineVehicleObstacleSeconds:
      settings.offlineVehicleObstacleSeconds ?? defaults.offlineVehicleObstacleSeconds,
    vehicleGlancingDegrees: settings.vehicleGlancingDegrees ?? defaults.vehicleGlancingDegrees,
    vehicleGlancingSpeed: settings.vehicleGlancingSpeed ?? defaults.vehicleGlancingSpeed,
  };
}
