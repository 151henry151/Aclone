// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { World } from '../shared/types';
import { MOTORBOAT, mooringKey } from '../shared/boats';
import { vehicleDef } from '../shared/vehicle-config';
/** Reuse one small polyline per live tow, attached to the rendered hulls. */
export class TowLines {
  readonly group = new T.Group();
  private lines = new Map<string, T.Line>();
  private material = new T.LineBasicMaterial({ color: '#b7a477' });
  update(w: World, players: Map<string, T.Group>, moored: T.Group) {
    const alive = new Set<string>();
    const jobs = [
      ...Object.values(w.towJobs ?? {}).map((j) => ({ ...j, tender: false })),
      ...Object.values(w.mooredBoats ?? {})
        .filter((t) => t.towedBy !== undefined)
        .map((t) => ({
          owner: t.owner,
          tug: t.owner,
          slot: MOTORBOAT,
          state: 'towing',
          rescue: false,
          tender: true,
        })),
    ];
    for (const j of jobs) {
      if (j.state !== 'towing') continue;
      const tug = players.get(j.tug),
        target = j.tender
          ? moored.children.find(
              (m) => m.userData.moorId === 'moor:' + mooringKey(j.owner, MOTORBOAT),
            )
          : j.rescue
            ? moored.children.find((m) => m.userData.moorId === 'rescue:' + j.owner)
            : players.get(j.owner);
      if (!tug || !target) continue;
      alive.add(j.owner);
      let line = this.lines.get(j.owner);
      if (!line) {
        const geometry = new T.BufferGeometry();
        geometry.setAttribute('position', new T.BufferAttribute(new Float32Array(17 * 3), 3));
        line = new T.Line(geometry, this.material);
        line.frustumCulled = false;
        this.lines.set(j.owner, line);
        this.group.add(line);
      }
      tug.updateWorldMatrix(true, false);
      target.updateWorldMatrix(true, false);
      const start = tug.localToWorld(
          new T.Vector3(
            0,
            1.1,
            -(vehicleDef(w, w.players[j.tug]?.vehicle ?? 32).length ?? 16.8) * 0.4,
          ),
        ),
        end = target.localToWorld(
          new T.Vector3(0, 1.1, (vehicleDef(w, j.slot).length ?? 14) * 0.4),
        );
      const pos = line.geometry.getAttribute('position') as T.BufferAttribute;
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        pos.setXYZ(
          i,
          T.MathUtils.lerp(start.x, end.x, t),
          T.MathUtils.lerp(start.y, end.y, t) - Math.sin(t * Math.PI) * 0.5,
          T.MathUtils.lerp(start.z, end.z, t),
        );
      }
      pos.needsUpdate = true;
    }
    for (const [id, line] of this.lines)
      if (!alive.has(id)) {
        line.geometry.dispose();
        this.group.remove(line);
        this.lines.delete(id);
      }
  }
}
