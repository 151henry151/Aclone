// SPDX-License-Identifier: GPL-3.0-or-later
import { vehicles } from '../shared/catalog';
import type { Player, World } from '../shared/types';
import type { SoundKind } from './sound-synthesis';

export type Position = { x: number; y: number; z: number };
export type Listener = Position & { heading: number };
export type LoopSound = {
  id: string;
  kind: Exclude<SoundKind, 'horn' | 'weapon'>;
  gain: number;
  pan: number;
  rate: number;
};
export const MAX_LOOPS = 16;
export const MAX_HORNS = 8;

export function spatialSound(listener: Listener, source: Position, range: number) {
  const dx = source.x - listener.x,
    dz = source.z - listener.z;
  const distance = Math.hypot(dx, source.y - listener.y, dz);
  return {
    gain: Math.max(0, 1 - distance / range) ** 2 / (1 + distance / 12),
    pan:
      distance < 1
        ? 0
        : Math.max(
            -1,
            Math.min(
              1,
              (-dx * Math.cos(listener.heading) + dz * Math.sin(listener.heading)) / distance,
            ),
          ),
  };
}

const machinery: Record<string, LoopSound['kind']> = {
  sawmill: 'saw',
  carpenter: 'saw',
  mill: 'mill',
  quarry: 'hammer',
  mason: 'hammer',
  mine: 'hammer',
  rareMine: 'hammer',
  forge: 'furnace',
  refinery: 'pump',
  brewery: 'pump',
  winery: 'pump',
  concreteWorks: 'mill',
  composter: 'mill',
  workshop: 'hammer',
  factory: 'mill',
  shipyard: 'hammer',
  brickworks: 'furnace',
  bakery: 'furnace',
  kitchen: 'furnace',
  roastery: 'mill',
  teaHouse: 'mill',
};

/** Cull before creating nodes. Positions can be the same interpolated poses used for rendering. */
export function selectLoops(
  w: World,
  me: Player,
  listener: Listener,
  position: (id: string) => Position | undefined = () => undefined,
): LoopSound[] {
  const result: LoopSound[] = [];
  const indoors = me.atHome ? 0.25 : 1;
  for (const p of Object.values(w.players)) {
    if (!p.online || !p.engineRunning || p.atHome) continue;
    const spatial =
      p.id === me.id ? { gain: 1, pan: 0 } : spatialSound(listener, position(p.id) ?? p, 110);
    const v = { ...vehicles[p.vehicle], ...w.vehicleTuning?.[p.vehicle] };
    const rev = Math.min(1, Math.abs(p.speed) / Math.max(1, v.speed));
    const gain = spatial.gain * (0.24 + 0.1 * rev) * indoors;
    if (gain < 0.001) continue;
    result.push({
      id: `engine:${p.id}`,
      kind: 'engine',
      gain,
      pan: spatial.pan,
      rate: 0.85 + rev * 0.95 + (v.mode === 2 || v.mode === 6 ? 0.35 : 0),
    });
  }
  for (const b of w.buildings) {
    const kind = machinery[b.kind];
    if (!kind || !b.operating || b.construction) continue;
    const spatial = spatialSound(listener, { x: b.x, y: listener.y, z: b.z }, 90);
    const gain = spatial.gain * 0.35 * Math.sqrt(Math.min(1, b.operating)) * indoors;
    if (gain < 0.001) continue;
    result.push({ id: `building:${b.id}`, kind, gain, pan: spatial.pan, rate: 1 });
  }
  return result.sort((a, b) => b.gain - a.gain || a.id.localeCompare(b.id)).slice(0, MAX_LOOPS);
}

/** Honks come from accepted server actions. Baseline on arrival; never replay old honks. */
export class HornTracker {
  private world = '';
  private last = new Map<string, number>();
  clear() {
    this.world = '';
    this.last.clear();
  }
  receive(w: World): string[] {
    if (this.world !== w.id) {
      this.clear();
      this.world = w.id;
    }
    const honks: string[] = [];
    for (const p of Object.values(w.players)) {
      const previous = this.last.get(p.id);
      if (
        previous !== undefined &&
        p.lastHorn > previous &&
        w.time - p.lastHorn >= 0 &&
        w.time - p.lastHorn < 1 &&
        p.online &&
        !p.atHome
      )
        honks.push(p.id);
      this.last.set(p.id, p.lastHorn);
    }
    for (const id of this.last.keys()) if (!w.players[id]) this.last.delete(id);
    return honks;
  }
}
