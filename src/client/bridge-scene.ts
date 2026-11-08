// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { World } from '../shared/types';
import type { Bridge } from '../shared/bridge-types';
import type { RoadWork } from '../shared/road-work';
import { createBridgeModelSteps } from './bridge-model';
function dispose(root: T.Object3D) {
  const materials = new Set<T.Material>();
  root.traverse((o) => {
    if (o instanceof T.Mesh) {
      o.geometry.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
    }
  });
  for (const m of materials) m.dispose();
  root.removeFromParent();
}
/** Bridge contributions never trigger a complete terrain or town rebuild. */
export class BridgeScene {
  readonly group = new T.Group();
  private world = '';
  private entries = new Map<
    string,
    { source: Bridge; complete: boolean; key: string; model?: T.Group; job?: RoadWork<T.Group> }
  >();
  clear() {
    for (const entry of this.entries.values()) {
      entry.job?.return(undefined as never);
      if (entry.model) dispose(entry.model);
    }
    this.entries.clear();
    this.world = '';
  }
  update(w: World) {
    if (this.world !== w.id) {
      this.clear();
      this.world = w.id;
    }
    const alive = new Set<string>();
    for (const b of w.bridges ?? []) {
      alive.add(b.id);
      const prior = this.entries.get(b.id),
        complete = b.completedAt !== undefined;
      if (prior?.source === b && prior.complete === complete) continue;
      const key = JSON.stringify([
        b.a,
        b.b,
        b.approachA,
        b.approachB,
        b.width,
        b.deckY,
        b.thickness,
        b.foundationLength,
        b.foundations,
        b.ramps,
        complete,
      ]);
      if (prior?.key === key) {
        prior.source = b;
        continue;
      }
      prior?.job?.return(undefined as never);
      if (prior?.model) dispose(prior.model);
      this.entries.set(b.id, { source: b, complete, key, job: createBridgeModelSteps(w, b) });
    }
    for (const [id, e] of this.entries)
      if (!alive.has(id)) {
        e.job?.return(undefined as never);
        if (e.model) dispose(e.model);
        this.entries.delete(id);
      }
    const deadline = performance.now() + 4;
    do {
      const pair = [...this.entries].find(([, e]) => e.job);
      if (!pair) break;
      const [id, entry] = pair,
        result = entry.job!.next();
      if (result.done) {
        entry.model = result.value;
        entry.job = undefined;
        this.group.add(result.value);
      }
      this.entries.delete(id);
      this.entries.set(id, entry);
    } while (performance.now() < deadline);
  }
}
