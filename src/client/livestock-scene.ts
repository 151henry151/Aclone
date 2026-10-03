// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { animalMaterial, animalModel, type AnimalPart } from './animal-model';
import { herdSpec, type AnimalKind } from '../shared/livestock';
import { blocksBuilding } from '../shared/building-shapes';
import { townRoads, roadDistance } from '../shared/town';
import { terrainHeight } from '../shared/simulation';
import type { World, Player } from '../shared/types';
const species: AnimalKind[] = ['cows', 'sheep', 'pigs', 'chickens'];
export const MAX_VISIBLE_LIVESTOCK = 48,
  MAX_PER_HERD = 8;
export interface AnimalSite {
  kind: AnimalKind;
  x: number;
  y: number;
  z: number;
  heading: number;
  seed: number;
}
/** Stable off-road, dry, level standing areas outside solid buildings. Visuals never move game stock. */
export function livestockSites(w: World, p: Pick<Player, 'x' | 'z'>): AnimalSite[] {
  const sites: AnimalSite[] = [],
    roads = townRoads(w);
  for (const b of w.buildings
    .filter((b) => herdSpec(b) && !b.construction && Math.hypot(b.x - p.x, b.z - p.z) < 100)
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, 12)) {
    const spec = herdSpec(b)!,
      n = Math.min(MAX_PER_HERD, Math.max(0, Math.floor(b.stock[spec.animal] ?? 0)));
    let seed = 0;
    for (const c of b.id) seed = (Math.imul(seed, 31) + c.charCodeAt(0)) >>> 0;
    let placed = 0;
    for (
      let attempt = 0;
      attempt < 96 && placed < n && sites.length < MAX_VISIBLE_LIVESTOCK;
      attempt++
    ) {
      const angle = ((attempt % 16) * Math.PI) / 8 + b.rotation + 0.1,
        radius = 8 + Math.floor(attempt / 16) * 3;
      const x = b.x + Math.sin(angle) * radius,
        z = b.z + Math.cos(angle) * radius,
        y = terrainHeight(w, x, z);
      if (
        Math.abs(x) > 247 ||
        Math.abs(z) > 247 ||
        y < w.settings.seaLevel + 0.3 ||
        roadDistance(roads, x, z) < 2.8
      )
        continue;
      if (w.buildings.some((other) => blocksBuilding(other, x, z, 0, 2.3))) continue;
      if (sites.some((s) => Math.hypot(x - s.x, z - s.z) < 3)) continue;
      if (
        [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dz]) => Math.abs(terrainHeight(w, x + dx, z + dz) - y) > 0.2)
      )
        continue;
      sites.push({
        kind: spec.animal,
        x,
        y,
        z,
        heading: angle + Math.PI * 0.5,
        seed: (seed % 1000) + placed * 1.71,
      });
      placed++;
    }
  }
  return sites;
}
/** Instanced articulated parts: at most 26 draws for all four species, no per-frame allocation. */
export class LivestockScene {
  readonly group = new T.Group();
  private rigs = new Map<
    AnimalKind,
    { parts: AnimalPart[]; meshes: T.InstancedMesh[]; sites: AnimalSite[] }
  >();
  private revision = '';
  private root = new T.Matrix4();
  private part = new T.Matrix4();
  private joint = new T.Object3D();
  private animal = new T.Object3D();
  constructor() {
    const material = animalMaterial();
    for (const kind of species) {
      const parts = animalModel(kind),
        meshes = parts.map((part) => {
          const mesh = new T.InstancedMesh(part.geometry, material, MAX_VISIBLE_LIVESTOCK);
          mesh.count = 0;
          mesh.frustumCulled = false;
          mesh.castShadow = false;
          mesh.receiveShadow = true;
          mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
          this.group.add(mesh);
          return mesh;
        });
      this.rigs.set(kind, { parts, meshes, sites: [] });
    }
    this.group.name = 'Living livestock';
  }
  update(w: World, p: Player) {
    const revision = JSON.stringify([
      w.id,
      Math.floor(p.x / 12),
      Math.floor(p.z / 12),
      w.terrain,
      w.settings.seaLevel,
      w.landscape,
      w.buildings.map((b) => [
        b.id,
        b.kind,
        b.x,
        b.z,
        b.rotation,
        b.construction,
        b.creatorBounds,
        herdSpec(b) ? b.stock[herdSpec(b)!.animal] : 0,
      ]),
    ]);
    if (revision === this.revision) return;
    this.revision = revision;
    const sites = livestockSites(w, p);
    for (const [kind, rig] of this.rigs) {
      rig.sites = sites.filter((s) => s.kind === kind);
      for (const mesh of rig.meshes) {
        mesh.count = rig.sites.length;
        rig.sites.forEach((site, i) =>
          mesh.setColorAt(i, new T.Color().setScalar(0.91 + (site.seed % 1) * 0.09)),
        );
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    }
  }
  animate(time: number) {
    for (const [kind, rig] of this.rigs) {
      const bird = kind === 'chickens';
      rig.sites.forEach((site, i) => {
        const t = time + site.seed,
          cycle = (t % 32) / 32,
          walk = cycle > 0.68 && cycle < 0.86;
        // A small continuous out-and-back stroll within the prevalidated clear area.
        const travel =
          cycle > 0.68 && cycle < 0.86 ? Math.sin(((cycle - 0.68) / 0.18) * Math.PI) * 0.38 : 0;
        this.animal.position.set(
          site.x + Math.sin(site.heading) * travel,
          site.y,
          site.z + Math.cos(site.heading) * travel,
        );
        this.animal.rotation.set(0, site.heading + Math.sin(t * 0.12) * 0.12, 0);
        this.animal.scale.setScalar(0.94 + (site.seed % 1) * 0.08);
        this.animal.updateMatrix();
        this.root.copy(this.animal.matrix);
        rig.parts.forEach((part, j) => {
          this.joint.position.copy(part.pivot);
          this.joint.rotation.set(0, 0, 0);
          this.joint.scale.set(1, 1, 1);
          if (part.motion === 'body') this.joint.scale.x = 1 + Math.sin(t * 1.5) * 0.009;
          if (part.motion === 'head') {
            this.joint.rotation.x = walk
              ? Math.sin(t * 4) * 0.025
              : bird
                ? 0.3 + 0.3 * Math.sin(t * 3)
                : 0.24 + 0.32 * Math.sin(t * 0.39);
            this.joint.rotation.y = Math.sin(t * 0.7) * 0.1;
          }
          if (part.motion === 'leg' && walk)
            this.joint.rotation.x = Math.sin(t * (bird ? 9 : 5)) * part.phase * 0.24;
          if (part.motion === 'tail') this.joint.rotation.z = Math.sin(t * 2.3) * 0.16;
          this.joint.updateMatrix();
          this.part.multiplyMatrices(this.root, this.joint.matrix);
          rig.meshes[j].setMatrixAt(i, this.part);
        });
      });
      for (const mesh of rig.meshes) if (mesh.count) mesh.instanceMatrix.needsUpdate = true;
    }
  }
  reset() {
    this.revision = '';
    for (const rig of this.rigs.values()) {
      rig.sites = [];
      for (const m of rig.meshes) m.count = 0;
    }
  }
}
