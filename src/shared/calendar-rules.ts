// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
import { cachedRuleValues } from './cached-rule-values';
export const calendarRuleFields = {
  calendarYearDays: { label: 'Days per year', min: 4, max: 3650, step: 1 },
  calendarSpringDay: { label: 'Spring start (zero-based day)', min: 0, max: 3650, step: 1 },
  calendarSpringDays: { label: 'Spring length (days)', min: 1, max: 3650, step: 1 },
  calendarSummerDays: { label: 'Summer length (days)', min: 1, max: 3650, step: 1 },
  calendarAutumnDays: { label: 'Autumn length (days)', min: 1, max: 3650, step: 1 },
  lotteryDrawDays: { label: 'Lottery interval (game days)', min: 1, max: 3650, step: 1 },
  calendarLunarDays: { label: 'Lunar phase period (game days)', min: 1, max: 3650, step: 0.1 },
} as const;
export type CalendarRules = Pick<typeof defaults, keyof typeof calendarRuleFields>;
export const calendarRules = cachedRuleValues(defaults, calendarRuleFields);

export function winterDays(settings: Partial<CalendarRules> = {}) {
  const r = calendarRules(settings);
  return r.calendarYearDays - r.calendarSpringDays - r.calendarSummerDays - r.calendarAutumnDays;
}
export function winterStart(settings: Partial<CalendarRules> = {}) {
  const r = calendarRules(settings);
  return r.calendarSpringDay + r.calendarSpringDays + r.calendarSummerDays + r.calendarAutumnDays;
}
export function calendarRulesError(settings: Partial<CalendarRules>) {
  const r = calendarRules(settings),
    winter = winterDays(r);
  if (winter < 1) return 'Leave at least one winter day in the year';
  if (r.calendarSpringDay > winter) return 'Spring start must fit within the winter length';
}
/** Continuous seasonal phase on the original solar/temperature model. */
export function seasonalDate(date: number, settings: Partial<CalendarRules> = {}) {
  const r = calendarRules(settings);
  if (
    r.calendarYearDays === defaults.calendarYearDays &&
    r.calendarSpringDay === defaults.calendarSpringDay &&
    r.calendarSpringDays === defaults.calendarSpringDays &&
    r.calendarSummerDays === defaults.calendarSummerDays &&
    r.calendarAutumnDays === defaults.calendarAutumnDays
  )
    return date;
  const years = Math.floor((date - r.calendarSpringDay) / r.calendarYearDays);
  let day = date - r.calendarSpringDay - years * r.calendarYearDays;
  let reference = years * defaults.calendarYearDays + defaults.calendarSpringDay;
  const lengths = [r.calendarSpringDays, r.calendarSummerDays, r.calendarAutumnDays, winterDays(r)];
  const original = [
    defaults.calendarSpringDays,
    defaults.calendarSummerDays,
    defaults.calendarAutumnDays,
    winterDays(defaults),
  ];
  for (let i = 0; i < lengths.length; i++) {
    if (day < lengths[i]) return reference + (day / lengths[i]) * original[i];
    day -= lengths[i];
    reference += original[i];
  }
  return reference;
}
