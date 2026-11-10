// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { World, Player } from '../shared/types';
import { earthworkGuidance } from '../shared/earthworks-work';
import { terrainHeight } from '../shared/terrain';

/** Private survey marks: one local operator's target, never attached to remote vehicles. */
export class EarthworkGuide {
  readonly group = new T.Group();
  selection?: string;
  private key = '';
  private world = '';
  private solid = new T.LineBasicMaterial({ color: '#f3cf69' });
  private dashed = new T.LineDashedMaterial({ color: '#d5dfcc', dashSize: 1, gapSize: 1 });
  constructor() {
    this.group.visible = false;
  }
  invalidate() {
    this.key = '';
  }
  update(w: World, p: Player) {
    if (this.world !== w.id) {
      this.selection = undefined;
      this.world = w.id;
      this.invalidate();
    }
    const guide = earthworkGuidance(w, p, this.selection),
      pad = guide?.pad;
    this.group.visible = !!pad;
    if (!pad) return;
    const key = JSON.stringify([
      w.id,
      pad.id,
      pad.x,
      pad.z,
      pad.width,
      pad.depth,
      pad.rotation,
      pad.shoulder,
      pad.target,
      pad.progress,
    ]);
    if (key === this.key) return;
    this.key = key;
    this.clearGeometry();
    const c = Math.cos(pad.rotation),
      s = Math.sin(pad.rotation);
    const point = (a: number, b: number, up = 0.18) => {
      const x = pad.x + a * c + b * s,
        z = pad.z - a * s + b * c;
      return new T.Vector3(x, terrainHeight(w, x, z) + up, z);
    };
    // Fixed visual subdivisions keep the guide small even for the largest world-defined pad.
    for (const extra of [0, pad.shoulder]) {
      const x = pad.width / 2 + extra,
        z = pad.depth / 2 + extra;
      const corners = [
        [-x, -z],
        [x, -z],
        [x, z],
        [-x, z],
      ];
      const points: T.Vector3[] = [];
      for (let edge = 0; edge < 4; edge++) {
        const a = corners[edge],
          b = corners[(edge + 1) % 4];
        for (let i = 0; i < 32; i++)
          points.push(point(a[0] + ((b[0] - a[0]) * i) / 32, a[1] + ((b[1] - a[1]) * i) / 32));
      }
      points.push(points[0].clone());
      const line = new T.Line(
        new T.BufferGeometry().setFromPoints(points),
        extra ? this.dashed : this.solid,
      );
      if (extra) line.computeLineDistances();
      this.group.add(line);
    }
    const posts: T.Vector3[] = [];
    for (const x of [-pad.width / 2, pad.width / 2])
      for (const z of [-pad.depth / 2, pad.depth / 2]) {
        posts.push(point(x, z), point(x, z, 1.5));
        posts.push(point(x, z, 1.5), point(x + 0.7, z, 1.5));
      }
    this.group.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(posts), this.solid));
  }
  private clearGeometry() {
    for (const child of [...this.group.children]) {
      (child as T.Line).geometry.dispose();
      this.group.remove(child);
    }
  }
  dispose() {
    this.clearGeometry();
    this.solid.dispose();
    this.dashed.dispose();
  }
}
