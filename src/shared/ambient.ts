// SPDX-License-Identifier: GPL-3.0-or-later
import { z } from 'zod';
import type { World } from './types.ts';
import { calendar, worldWeather } from './environment.ts';
export const ambientSchema = z.object({
  id: z.string().regex(/^[\w-]{1,64}$/),
  name: z.string().trim().min(1).max(64),
  x: z.number().min(-240).max(240).default(0),
  z: z.number().min(-240).max(240).default(0),
  object: z.string().max(64).default(''),
  radius: z.number().min(2).max(250).default(40),
  volume: z.number().min(0).max(1).default(0.35),
  loop: z.boolean().default(true),
  source: z.enum(['woodland', 'shore', 'storm', 'asset']).default('woodland'),
  asset: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  startHour: z.number().min(0).max(24).default(0),
  endHour: z.number().min(0).max(24).default(24),
  weather: z.enum(['any', 'clear', 'rain', 'snow', 'storm']).default('any'),
});
export type AmbientZone = z.infer<typeof ambientSchema>;
/** Same decorative clock as lighting. Wrapping evening-to-morning intervals are supported. */
export function ambientZones(w: World, listener: { x: number; z: number }) {
  const hour = (((w.settings.time % 86400) + 86400) % 86400) / 3600,
    weather = worldWeather(w, calendar(w).absoluteDay);
  return (w.creator?.ambience ?? [])
    .flatMap((zone) => {
      if (
        zone.startHour !== zone.endHour &&
        !(zone.startHour < zone.endHour
          ? hour >= zone.startHour && hour < zone.endHour
          : hour >= zone.startHour || hour < zone.endHour)
      )
        return [];
      if (
        zone.weather !== 'any' &&
        !(zone.weather === 'storm' ? weather.storm : weather.precipitation === zone.weather)
      )
        return [];
      const object =
        zone.object && w.creator?.objects.find((o) => o.id === zone.object && o.visible);
      if (zone.object && !object) return [];
      const x = object ? object.x : zone.x,
        z = object ? object.z : zone.z,
        distance = Math.hypot(x - listener.x, z - listener.z),
        gain = zone.volume * Math.max(0, 1 - distance / zone.radius) ** 2;
      return gain > 0.001 ? [{ ...zone, x, z, gain }] : [];
    })
    .sort((a, b) => b.gain - a.gain || a.id.localeCompare(b.id))
    .slice(0, 4);
}
