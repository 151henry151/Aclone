// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { barrierSegments, scatterObjects } from '../shared/landscape';
import { terrainHeight } from '../shared/terrain';
import { creatorModel } from './creator-model';
import type { World } from '../shared/types';
export function addLandscape(group: T.Group, w: World) {
  for (const b of barrierSegments(w)) {
    const ay = terrainHeight(w, b.a.x, b.a.z),
      by = terrainHeight(w, b.b.x, b.b.z),
      dx = b.b.x - b.a.x,
      dz = b.b.z - b.a.z,
      length = Math.hypot(dx, dz);
    const material = new T.MeshStandardMaterial({
      color: b.kind === 'wall' ? '#8b8778' : '#796448',
      roughness: 1,
    });
    const beam = (height: number, offset: number) => {
      const mesh = new T.Mesh(
        new T.BoxGeometry(b.width, height, Math.hypot(length, by - ay)),
        material,
      );
      mesh.position.set((b.a.x + b.b.x) / 2, (ay + by) / 2 + offset, (b.a.z + b.b.z) / 2);
      mesh.rotation.y = Math.atan2(dx, dz);
      mesh.rotateX(-Math.atan2(by - ay, length));
      group.add(mesh);
    };
    if (b.kind === 'wall') beam(b.height, b.height / 2);
    else {
      for (const [p, y] of [
        [b.a, ay],
        [b.b, by],
      ] as const) {
        const post = new T.Mesh(new T.BoxGeometry(b.width, b.height, b.width), material);
        post.position.set(p.x, y + b.height / 2, p.z);
        group.add(post);
      }
      beam(0.15, b.height * 0.4);
      beam(0.15, b.height * 0.8);
    }
  }
  for (const o of scatterObjects(w)) {
    const model = w.creator?.models.find((m) => m.id === o.model);
    if (!model) continue;
    const g = creatorModel(model, w);
    g.position.set(o.x, terrainHeight(w, o.x, o.z), o.z);
    g.rotation.y = (o.yaw * Math.PI) / 180;
    g.scale.setScalar(o.scale);
    group.add(g);
  }
}
