// SPDX-License-Identifier: GPL-3.0-or-later
import { smoothstep } from './noise';
import type { World } from './types';
import type { worldWeather } from './environment';

/** Metres above sea datum. The island's compressed alpine biome stays frozen
 * at its summit even during a warm lowland summer; this is a game climate,
 * not a claim that every real 1,400-metre mountain has permanent snow. */
export const ALPINE_SNOW_START = 1180;
export const ALPINE_SNOW_FULL = 1390;
export function permanentSnowCover(w: Pick<World, 'northernIsland' | 'settings'>, height: number) {
  return w.northernIsland
    ? smoothstep(ALPINE_SNOW_START, ALPINE_SNOW_FULL, height - w.settings.seaLevel)
    : 0;
}
export function alpineWeather(
  w: Pick<World, 'northernIsland' | 'settings'>,
  weather: ReturnType<typeof worldWeather>,
  height: number,
) {
  if (!w.northernIsland) return weather;
  const elevation = Math.max(0, height - w.settings.seaLevel);
  if (elevation <= 450) return weather;
  const cooled = weather.temperature - (elevation - 450) * 0.0065;
  const alpine = smoothstep(900, 1250, elevation);
  const temperature = cooled + (Math.min(cooled, -4) - cooled) * alpine;
  const snowfall = weather.precipitation === 'rain' && temperature <= 1;
  return {
    ...weather,
    temperature,
    precipitation: snowfall ? 'snow' : weather.precipitation,
    snowfallPerDay: snowfall ? 0.018 + weather.intensity * 0.06 : weather.snowfallPerDay,
  };
}
