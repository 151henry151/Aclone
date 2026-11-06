// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
import type { Building, World } from './types';
import { ownerOperating } from './staffing';
export const buildingDoorFields = {
  buildingDoorMode: { label: 'Door policy', choices: ['hours', 'open', 'closed'] },
  buildingDoorOpenHour: { label: 'Opening hour', min: 0, max: 24, step: 0.25 },
  buildingDoorCloseHour: { label: 'Closing hour', min: 0, max: 24, step: 0.25 },
  buildingDoorUnstaffedClosed: { label: 'Close unstaffed businesses' },
  buildingDoorOffsetMinutes: { label: 'Maximum stagger (game minutes)', min: 0, max: 120, step: 1 },
  buildingDoorSeconds: { label: 'Door motion (real seconds)', min: 0.1, max: 60, step: 0.1 },
  buildingDoorAnimateRange: { label: 'Door animation reach (metres)', min: 0, max: 500, step: 1 },
  buildingDoorSoundRange: {
    label: 'Door sound reach (metres; 0 disables)',
    min: 0,
    max: 200,
    step: 1,
  },
  buildingDoorSwingDegrees: { label: 'Barn-door swing (degrees)', min: 1, max: 150, step: 1 },
  buildingInteriorThreshold: {
    label: 'Interior visibility threshold',
    min: 0,
    max: 0.5,
    step: 0.01,
  },
  buildingInteriorDetail: { label: 'Interior detail', choices: ['full', 'reduced', 'none'] },
} as const;
export type BuildingDoorRules = Pick<typeof defaults, keyof typeof buildingDoorFields>;
export function buildingDoorRules(settings: Partial<BuildingDoorRules> = {}): BuildingDoorRules {
  return Object.fromEntries(
    Object.keys(buildingDoorFields).map((key) => [
      key,
      settings[key as keyof BuildingDoorRules] ?? defaults[key as keyof BuildingDoorRules],
    ]),
  ) as BuildingDoorRules;
}
export function buildingDoorHash(id: string) {
  let n = 2166136261;
  for (const c of id) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return (n >>> 0) / 4294967296;
}
export function buildingDoorOffset(w: Pick<World, 'settings'>, id: string) {
  return (
    ((buildingDoorHash(id) * 2 - 1) * buildingDoorRules(w.settings).buildingDoorOffsetMinutes) / 60
  );
}
/** Derived activity only; no door position is saved or sent in a separate message. */
export function buildingDoorActivity(w: World, b: Building) {
  const workers = Object.values(w.players).filter(
    (p) => p.id === b.owner || b.employees.includes(p.id) || p.job === b.id,
  );
  return {
    staffed: ownerOperating(w, b) || b.employees.length > 0 || workers.some((p) => p.job === b.id),
    inside: workers.some(
      (p) => p.atHome && (p.home === b.id || Math.hypot(p.x - b.x, p.z - b.z) < 1),
    ),
  };
}
export function doorOpenness(w: World, b: Building) {
  if (b.construction || b.creatorModel) return 0;
  const r = buildingDoorRules(w.settings);
  if (r.buildingDoorMode !== 'hours') return r.buildingDoorMode === 'open' ? 1 : 0;
  const activity = b.doorActivity ?? buildingDoorActivity(w, b);
  if (activity.inside) return 1;
  const service =
    b.aircraftHangar ||
    b.kind === 'garage' ||
    (b.kind === 'workshop' && (!b.owner || b.government));
  if (r.buildingDoorUnstaffedClosed && !service && !activity.staffed) return 0;
  const mod = (n: number) => ((n % 24) + 24) % 24;
  const hour = mod(w.settings.time / 3600 - buildingDoorOffset(w, b.id));
  const start = mod(r.buildingDoorOpenHour),
    end = mod(r.buildingDoorCloseHour);
  return start === end || (start < end ? hour >= start && hour < end : hour >= start || hour < end)
    ? 1
    : 0;
}
