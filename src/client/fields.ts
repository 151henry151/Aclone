// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seasonalMaterial } from './materials';
import { cropStatus } from '../shared/farming';
import { terrainHeight, distance } from '../shared/simulation';
import type { World, Player } from '../shared/types';
/** Small nearby plots, instanced by growth stage; never rebuild the whole village for a harvest. */
export class FarmFields {
  readonly group = new T.Group();
  private revision = '';
  update(w: World, p: Player) {
    const farms = w.buildings
      .filter((b) => b.kind === 'farm' && !b.construction && distance(b, p) < 110)
      .slice(0, 16);
    const revision = farms
      .map(
        (b) =>
          b.id +
          ':' +
          (b.plots ?? [])
            .map((plot, i) => plot.crop + ':' + Math.floor(cropStatus(w, b, i).progress * 4))
            .join(),
      )
      .join('|');
    if (revision === this.revision) return;
    this.revision = revision;
    this.group.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.geometry.dispose();
        (o.material as T.Material).dispose();
      }
    });
    this.group.clear();
    for (const b of farms) {
      const farm = new T.Group();
      farm.position.set(b.x, terrainHeight(w, b.x, b.z) + 0.04, b.z);
      farm.rotation.y = b.rotation;
      this.group.add(farm);
      for (let i = 0; i < 4; i++) {
        const x = (i % 2) * 8 + 10,
          z = 9 + Math.floor(i / 2) * 8,
          plot = b.plots?.[i],
          status = cropStatus(w, b, i);
        const soil = new T.Mesh(
          new T.BoxGeometry(7, 0.08, 6),
          new T.MeshStandardMaterial({ color: '#594637', roughness: 1 }),
        );
        soil.position.set(x, 0, z);
        soil.receiveShadow = true;
        seasonalMaterial(soil.material);
        farm.add(soil);
        if (!plot?.crop) continue;
        const height =
          0.18 + status.progress * (plot.crop === 'grapes' || plot.crop === 'hops' ? 1.6 : 0.8);
        const stems = new T.InstancedMesh(
          cropGeometry(plot.crop, height),
          new T.MeshStandardMaterial({
            color: status.state === 'ripe' && plot.crop === 'wheat' ? '#c8b464' : '#68813d',
            roughness: 1,
          }),
          80,
        );
        seasonalMaterial(stems.material);
        const matrix = new T.Matrix4();
        for (let n = 0; n < 80; n++) {
          matrix.makeRotationY(n * 2.399);
          matrix.setPosition(x + (n % 10) * 0.62 - 2.8, 0, z + Math.floor(n / 10) * 0.66 - 2.3);
          stems.setMatrixAt(n, matrix);
        }
        stems.castShadow = true;
        farm.add(stems);
      }
    }
  }
  reset() {
    this.revision = '';
  }
}

function cropGeometry(crop: string, height: number) {
  const parts: T.BufferGeometry[] = [];
  const stem = new T.CylinderGeometry(0.018, 0.026, height, 6);
  stem.translate(0, height / 2, 0);
  parts.push(stem);
  for (let i = 0; i < 6; i++) {
    const leaf = new T.SphereGeometry(1, 7, 4);
    leaf.scale(crop === 'wheat' ? 0.035 : 0.12, 0.022, crop === 'wheat' ? 0.22 : 0.16);
    leaf.rotateX(0.35);
    leaf.translate(0, 0, 0.12);
    leaf.rotateY(i * 2.4);
    leaf.translate(0, height * (0.25 + i * 0.1), 0);
    parts.push(leaf);
  }
  if (crop === 'wheat') {
    const ear = new T.CapsuleGeometry(0.035, 0.16, 3, 6);
    ear.translate(0, height, 0);
    parts.push(ear);
  }
  const merged = mergeGeometries(parts.map((g) => g.toNonIndexed()))!;
  for (const g of parts) g.dispose();
  return merged;
}
