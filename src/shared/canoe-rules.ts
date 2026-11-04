// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const canoeRuleFields = {
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
