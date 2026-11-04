// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const npcAccountRuleFields = {
  npcExchangeCashReserve: {
    label: 'Cash retained for local currency conversion (hundredths)',
    min: 0,
    max: 100000000,
    step: 1,
  },
  npcExchangeCreditLoad: {
    label: 'Suggested currency conversion load (credits)',
    min: 0,
    max: 1000000,
    step: 1,
  },
  npcAccountTradeCreditReserve: {
    label: 'Credits retained for account trading',
    min: 0,
    max: 1000000,
    step: 1,
  },
  npcAccountTradeBuyLoad: {
    label: 'Account trade purchase load (items)',
    min: 0,
    max: 10000,
    step: 1,
  },
  npcAccountTradeSellLoad: {
    label: 'Account trade sale load (items)',
    min: 0,
    max: 10000,
    step: 1,
  },
} as const;
export type NpcAccountRules = Pick<typeof defaults, keyof typeof npcAccountRuleFields>;
export function npcAccountRules(settings: Partial<NpcAccountRules> = {}): NpcAccountRules {
  return Object.fromEntries(
    Object.keys(npcAccountRuleFields).map((key) => [
      key,
      settings[key as keyof NpcAccountRules] ?? defaults[key as keyof NpcAccountRules],
    ]),
  ) as NpcAccountRules;
}
