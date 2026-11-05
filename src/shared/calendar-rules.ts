// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const calendarRuleFields = {
  lotteryDrawDays: { label: 'Lottery interval (game days)', min: 1, max: 3650, step: 1 },
  calendarLunarDays: { label: 'Lunar phase period (game days)', min: 1, max: 3650, step: 0.1 },
} as const;
export type CalendarRules = Pick<typeof defaults, keyof typeof calendarRuleFields>;
export function calendarRules(settings: Partial<CalendarRules> = {}): CalendarRules {
  return Object.fromEntries(
    Object.keys(calendarRuleFields).map((key) => [
      key,
      settings[key as keyof CalendarRules] ?? defaults[key as keyof CalendarRules],
    ]),
  ) as CalendarRules;
}
