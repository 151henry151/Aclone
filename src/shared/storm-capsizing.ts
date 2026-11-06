import { calendarRuleFields } from './calendar-rules';
import { climateRuleFields } from './climate-rules';
// SPDX-License-Identifier: GPL-3.0-or-later
import { stormRules } from './storm-rules';
import { ROWBOAT, rowboatRules } from './rowboat-rules';
import { CANOE } from './canoe-rules';
import { boatSlot, MOTORBOAT } from './boats';
import { vehicleDef } from './vehicle-config';
import { inlandWaterAt } from './inland-water';
import { oceanWeather } from './ocean';
import { waterDepth } from './fishing-water';
import { boatLoadFactors } from './fishing-expedition';
import { vehicleCondition } from './vehicle-services';
import { coastClearance } from './coast-clearance';
import { say } from './messages';
import type { World, Player } from './types';
export function stormClass(w: World, slot: number) {
  return (
    vehicleDef(w, slot).stormClass ??
    ([29, CANOE, ROWBOAT].includes(slot)
      ? 'small'
      : [3, MOTORBOAT].includes(slot)
        ? 'coastal'
        : 'seaworthy')
  );
}
export function capsizeRisk(w: World, p: Player, sea = oceanWeather(w)) {
  const r = stormRules(w.settings),
    kind = stormClass(w, p.vehicle);
  const safe = { rate: 0, clearance: 0, returnDistance: 0, amplitude: sea.amplitude, kind };
  if (
    !r.capsizeEnabled ||
    !boatSlot(p.vehicle, w) ||
    p.hitch ||
    kind === 'seaworthy' ||
    !sea.storm ||
    sea.amplitude <= 0 ||
    inlandWaterAt(w, p.x, p.z)
  )
    return safe;
  const depth = waterDepth(w, p);
  if (depth <= 0) return safe;
  if (kind === 'coastal' && (depth <= r.capsizeOceanDepth || sea.amplitude < r.capsizeLargeWave))
    return safe;
  const coast = coastClearance(w, p),
    limit = kind === 'small' ? r.capsizeShoreShelter : r.capsizeOceanShore;
  if (coast.clearance <= limit) return { ...safe, ...coast };
  const base = kind === 'small' ? r.capsizeSmallRate : r.capsizeCoastalRate;
  const multiplier =
    (Math.min(r.capsizeDistanceMultiplier, 1 + coast.clearance / r.capsizeDistanceScale) *
      sea.amplitude) /
    r.capsizeWaveReference;
  return { ...coast, kind, amplitude: sea.amplitude, rate: Math.min(1, base * multiplier) };
}
export function escapeAllowance(w: World, p: Player, risk: ReturnType<typeof capsizeRisk>) {
  const r = stormRules(w.settings),
    v = vehicleDef(w, p.vehicle);
  const speed =
    (p.vehicle === MOTORBOAT && p.fuel <= 0
      ? rowboatRules(w.settings).motorboatRowingSpeed
      : v.speed) *
    boatLoadFactors(w, p).speed *
    (0.7 + vehicleCondition(p) * 0.003);
  // Reaching the conservative near-shore band is always safe for both classes;
  // a shallower sounding may provide shelter sooner for coastal boats.
  const distance = Number.isFinite(risk.returnDistance)
    ? Math.max(0, risk.returnDistance - r.capsizeShoreShelter)
    : 0;
  return Math.max(
    r.capsizeGraceSeconds,
    (distance / Math.max(0.01, speed)) * r.capsizeEscapeMultiplier + r.capsizeTurnSeconds,
  );
}
export function stormRoll(world: string, owner: string, slot: number, boundary: number) {
  let n = 2166136261;
  for (const c of `${world}:${owner}:${slot}:${boundary}`)
    n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  n = Math.imul(n ^ (n >>> 16), 0x85ebca6b);
  n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
const forecastCaches = new WeakMap<
  World['terrain'],
  { key: string; values: Map<number, ReturnType<typeof oceanWeather>> }
>();
export function stormForecast(w: World) {
  const rules = stormRules(w.settings);
  if (w.creator?.weather && w.creator.weather !== 'natural') return oceanWeather(w);
  const key = JSON.stringify([
    w.id,
    w.creator?.weather,
    w.settings.oceanWaves,
    ...Object.keys({ ...calendarRuleFields, ...climateRuleFields }).map(
      (k) => w.settings[k as keyof World['settings']],
    ),
  ]);
  let cache = forecastCaches.get(w.terrain);
  if (cache?.key !== key) {
    cache = { key, values: new Map() };
    forecastCaches.set(w.terrain, cache);
  }
  let worst = { storm: false, amplitude: 0 };
  for (
    let at = Math.floor(w.time / rules.capsizeCadence) * rules.capsizeCadence;
    at <= w.time + rules.capsizeForecastSeconds;
    at += rules.capsizeCadence
  ) {
    let sea = cache.values.get(at);
    if (!sea) {
      sea = oceanWeather({ ...w, time: at });
      cache.values.set(at, sea);
    }
    if (sea.storm && sea.amplitude > worst.amplitude) worst = sea;
  }
  for (const at of cache.values.keys())
    if (at < w.time - rules.capsizeCadence) cache.values.delete(at);
  return worst;
}
export function advanceCapsizing(
  w: World,
  start: number,
  end: number,
  kill: (p: Player, forceLoss: boolean, cause: string, at: number) => void,
) {
  const r = stormRules(w.settings);
  const candidates = Object.values(w.players).filter(
    (p) =>
      !p.hitch && boatSlot(p.vehicle, w) && !p.atHome && stormClass(w, p.vehicle) !== 'seaworthy',
  );
  if (!r.capsizeEnabled || !candidates.length) {
    for (const p of Object.values(w.players)) delete p.stormExposure;
    return;
  }
  for (
    let at = (Math.floor(start / r.capsizeCadence) + 1) * r.capsizeCadence;
    at <= end;
    at += r.capsizeCadence
  ) {
    const world = { ...w, time: at },
      sea = oceanWeather(world);
    const upcoming = stormForecast(world);
    for (const p of Object.values(w.players)) {
      if (p.hitch || !boatSlot(p.vehicle, w) || p.atHome) {
        delete p.stormExposure;
        continue;
      }
      const risk = capsizeRisk(world, p, sea),
        forecast = risk.rate ? risk : upcoming?.storm ? capsizeRisk(world, p, upcoming) : undefined;
      if (!risk.rate) {
        if (forecast?.rate && (!p.stormExposure || p.stormExposure.slot !== p.vehicle)) {
          p.stormExposure = { slot: p.vehicle, warningAt: at };
          say(
            w,
            'Storm warning',
            `${vehicleDef(w, p.vehicle).name}: storm forecast within ${r.capsizeForecastSeconds} seconds at ${p.x.toFixed(0)}, ${p.z.toFixed(0)}. Head for shelter now. Forecast wave amplitude ${forecast.amplitude.toFixed(1)} m.`,
            'system',
            p.id,
          );
        } else if (!forecast?.rate) delete p.stormExposure;
        continue;
      }
      let exposure = p.stormExposure;
      if (!exposure || exposure.slot !== p.vehicle || exposure.since === undefined) {
        const allowance = escapeAllowance(world, p, risk);
        exposure = p.stormExposure = {
          slot: p.vehicle,
          warningAt: at,
          since: at,
          safeUntil: at + allowance,
        };
        say(
          w,
          'Storm warning',
          `${vehicleDef(w, p.vehicle).name}: dangerous storm water at ${p.x.toFixed(0)}, ${p.z.toFixed(0)}; wave amplitude ${risk.amplitude.toFixed(1)} m. Turn for shelter now. At least ${Math.ceil(allowance)} seconds before capsize risk begins, then risk rises over ${r.capsizeRampSeconds} seconds.`,
          'system',
          p.id,
        );
      }
      if (at <= exposure.safeUntil!) continue;
      const ramp =
        r.capsizeRampSeconds === 0
          ? 1
          : Math.min(1, (at - exposure.safeUntil!) / r.capsizeRampSeconds);
      const probability = 1 - (1 - risk.rate) ** ((r.capsizeCadence / 60) * ramp);
      if (stormRoll(w.id, p.id, p.vehicle, at) >= probability) continue;
      const cause = `${vehicleDef(w, p.vehicle).name} capsized at ${p.x.toFixed(0)}, ${p.z.toFixed(0)} in a storm (wave amplitude ${risk.amplitude.toFixed(1)} m)`;
      say(w, 'Storm loss', cause + '.');
      const occupants = Object.values(w.players).filter((q) => q.hitch === p.id);
      // Passengers die while still attached, before the captain's normal death
      // handler can put surviving deckhands into emergency lifeboats.
      for (const q of occupants) kill(q, false, cause, at);
      kill(p, risk.kind === 'coastal', cause, at);
      delete p.stormExposure;
    }
  }
}
