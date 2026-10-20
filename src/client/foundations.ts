// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { World, Building } from '../shared/types';
import { buildingPlan } from '../shared/building-shapes';
import { foundationProfile } from '../shared/construction-site';
import { terrainHeight } from '../shared/terrain';
/** Low-detail plinth and entrance treads, shared by the designer and live model. */
export function addFoundation(root: T.Group, b: Building, w: World) {
  if (b.foundationY === undefined) return;
  const plan = buildingPlan(b),
    profile = foundationProfile(w, b),
    height = Math.max(0.1, b.foundationY - profile.low + 0.15);
  const material = new T.MeshStandardMaterial({ color: '#79766a', roughness: 1 });
  const box = (x: number, y: number, z: number, width: number, h: number, depth: number) => {
    const mesh = new T.Mesh(new T.BoxGeometry(width, h, depth), material);
    mesh.position.set(x, y, z);
    root.add(mesh);
  };
  for (const v of plan.volumes) box(v.x, -height / 2, v.z, v.width, height, v.depth);
  const front = ['school', 'hotel'].includes(b.kind)
    ? (plan.volumes[1] ?? plan.volumes[0])
    : plan.volumes[0];
  const x = front.x,
    z = front.z + front.depth / 2 + 0.1,
    c = Math.cos(b.rotation),
    s = Math.sin(b.rotation);
  const ground = terrainHeight(w, b.x + x * c + z * s, b.z - x * s + z * c),
    rise = b.foundationY - ground;
  const count = Math.min(10, Math.max(0, Math.ceil(rise / 0.2)));
  for (let i = 0; i < count; i++) {
    const h = (rise * (count - i)) / count;
    box(x, -rise + h / 2, z + 0.18 + i * 0.35, 1.6, Math.max(0.02, h), 0.36);
  }
}
