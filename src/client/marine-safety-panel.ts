// SPDX-License-Identifier: GPL-3.0-or-later
import { oceanWeather } from '../shared/ocean';
import { stormClass, stormForecast } from '../shared/storm-capsizing';
import { stormRules } from '../shared/storm-rules';
import type { World, Player } from '../shared/types';
export function marineSafetyPanel(w: World, p: Player) {
  const r = stormRules(w.settings),
    sea = oceanWeather(w),
    forecast = stormForecast(w),
    exposure = p.stormExposure;
  const remaining =
    exposure?.safeUntil === undefined
      ? undefined
      : Math.max(0, Math.ceil(exposure.safeUntil - w.time));
  return `<section data-marine-safety><h3>Sea and shelter</h3><p>${sea.storm ? 'Storm at sea' : 'No storm currently'} · wave amplitude ${sea.amplitude.toFixed(1)} m. ${forecast.storm ? `Storm in the ${r.capsizeForecastSeconds}-second forecast. Check shelter before departure.` : 'No storm in the warning forecast.'}</p><p>${!r.capsizeEnabled ? 'Storm capsizing is disabled in this world.' : stormClass(w, p.vehicle) === 'seaworthy' ? 'This hull is exempt from storm capsizing.' : remaining !== undefined ? (remaining > 0 ? `Turn for shelter now: ${remaining} seconds of guaranteed escape time remain; risk then rises.` : 'Capsize risk is active. Head for shelter immediately.') : 'Small craft shelter beside shore or inland; coastal craft avoid deep offshore water in large storms.'}</p></section>`;
}
