// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json' with { type: 'json' };
export const communicationRuleFields = {
  chatMaxLength: { label: 'Chat character limit', min: 1, max: 12000, step: 1 },
  npcGroupReplyCooldown: {
    label: 'Group reply cooldown (real seconds)',
    min: 0,
    max: 86400,
    step: 0.1,
  },
} as const;
export type CommunicationRules = Pick<typeof defaults, keyof typeof communicationRuleFields>;
export function communicationRules(settings: Partial<CommunicationRules> = {}): CommunicationRules {
  return Object.fromEntries(
    Object.keys(communicationRuleFields).map((key) => [
      key,
      settings[key as keyof CommunicationRules] ?? defaults[key as keyof CommunicationRules],
    ]),
  ) as CommunicationRules;
}
