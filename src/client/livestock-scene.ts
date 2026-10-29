// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { animalMaterial, animalModel, type AnimalPart } from './animal-model';
import { herdSpec, type AnimalKind } from '../shared/livestock';
import { pasturePoint, pastureFences } from '../shared/pasture-land';
import { grazingPose, type GrazingPoint } from './pasture-motion';
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
  points: GrazingPoint[];
  heights: number[][];
}
/** Positions belong to saved pastures, never to an arbitrary patch beside a barn. */
export function livestockSites(w: World, p: Pick<Player, 'x' | 'z'>): AnimalSite[] {
  const sites: AnimalSite[] = [];
  for (const b of w.buildings
    .filter(
      (b) => herdSpec(b) && b.pasture && !b.construction && Math.hypot(b.x - p.x, b.z - p.z) < 140,
    )
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, 12)) {
    const spec = herdSpec(b)!,
      pasture = b.pasture!;
    const n = Math.min(MAX_PER_HERD, Math.max(0, Math.floor(b.stock[spec.animal] ?? 0)));
    let seed = 0;
    for (const c of b.id) seed = (Math.imul(seed, 31) + c.charCodeAt(0)) >>> 0;
    for (let i = 0; i < n && sites.length < MAX_VISIBLE_LIVESTOCK; i++) {
      let rng = (seed + i * 3919) >>> 0;
      const random = () => {
        rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
        return rng / 4294967296;
      };
      // Separate lanes keep herds from passing through one another; each animal explores
      // a different strip of the pasture, with room to turn clear of the fence.
      const width = pasture.parcels * 16 - 6;
      const lane = i % 4,
        row = Math.floor(i / 4);
      const points: GrazingPoint[] = Array.from({ length: 6 }, (_, j) => {
        const x = pasture.x - 5 + (width * (row + 0.1 + random() * 0.8)) / Math.ceil(n / 4);
        const z = pasture.z - 5 + (lane + 0.15 + random() * 0.7) * 2.5;
        const q = pasturePoint(b, x, z);
        return { ...q, y: terrainHeight(w, q.x, q.z) };
      });
      sites.push({
        kind: spec.animal,
        ...points[0],
        heading: 0,
        seed: (seed % 1000) + i * 1.71,
        points,
        heights: points.map((a, j) => {
          const b = points[(j + 1) % points.length];
          const n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z)));
          return Array.from({ length: n + 1 }, (_, k) =>
            terrainHeight(w, a.x + ((b.x - a.x) * k) / n, a.z + ((b.z - a.z) * k) / n),
          );
        }),
      });
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
  private material: T.MeshStandardMaterial;
  private revision = '';
  private fences = new T.InstancedMesh(
    new T.BoxGeometry(1, 1, 1),
    new T.MeshStandardMaterial({ color: '#796448', roughness: 1 }),
    8192,
  );
  private root = new T.Matrix4();
  private part = new T.Matrix4();
  private joint = new T.Object3D();
  private animal = new T.Object3D();
  constructor() {
    const material = animalMaterial();
    this.material = material;
    for (const kind of species) {
      const parts = animalModel(kind),
        meshes = parts.map((part) => {
          part.geometry.setAttribute(
            'herdPhase',
            new T.InstancedBufferAttribute(new Float32Array(MAX_VISIBLE_LIVESTOCK), 1),
          );
          part.geometry.setAttribute(
            'herdWalk',
            new T.InstancedBufferAttribute(new Float32Array(MAX_VISIBLE_LIVESTOCK), 1),
          );
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
    this.fences.count = 0;
    this.fences.frustumCulled = false;
    this.fences.receiveShadow = true;
    this.group.add(this.fences);
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
        b.pasture,
        herdSpec(b) ? b.stock[herdSpec(b)!.animal] : 0,
      ]),
    ]);
    if (revision === this.revision) return;
    this.revision = revision;
    const sites = livestockSites(w, p);
    let fi = 0;
    const box = (
      x: number,
      y: number,
      z: number,
      sx: number,
      sy: number,
      sz: number,
      yaw = 0,
      pitch = 0,
    ) => {
      if (fi >= this.fences.instanceMatrix.count) return;
      this.joint.position.set(x, y, z);
      this.joint.rotation.set(pitch, yaw, 0, 'YXZ');
      this.joint.scale.set(sx, sy, sz);
      this.joint.updateMatrix();
      this.fences.setMatrixAt(fi++, this.joint.matrix);
    };
    for (const f of pastureFences(
      w.buildings.filter((b) => Math.hypot(b.x - p.x, b.z - p.z) < 180),
    )) {
      const ay = terrainHeight(w, f.a.x, f.a.z),
        by = terrainHeight(w, f.b.x, f.b.z);
      const dx = f.b.x - f.a.x,
        dz = f.b.z - f.a.z,
        len = Math.hypot(dx, dz);
      box(f.a.x, ay + 0.65, f.a.z, 0.16, 1.3, 0.16);
      for (const level of [0.4, 0.8, 1.12])
        box(
          (f.a.x + f.b.x) / 2,
          (ay + by) / 2 + level,
          (f.a.z + f.b.z) / 2,
          0.1,
          0.1,
          Math.hypot(len, by - ay),
          Math.atan2(dx, dz),
          -Math.atan2(by - ay, len),
        );
    }
    this.fences.count = fi;
    this.fences.instanceMatrix.needsUpdate = true;
    for (const [kind, rig] of this.rigs) {
      rig.sites = sites.filter((s) => s.kind === kind);
      for (const mesh of rig.meshes) {
        mesh.count = rig.sites.length;
        const phase = mesh.geometry.getAttribute('herdPhase');
        rig.sites.forEach((site, i) => phase.setX(i, site.seed));
        phase.needsUpdate = true;
        rig.sites.forEach((site, i) =>
          mesh.setColorAt(i, new T.Color().setScalar(0.91 + (site.seed % 1) * 0.09)),
        );
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    }
  }
  animate(time: number) {
    this.material.userData.herdClock.value = time;
    for (const [kind, rig] of this.rigs) {
      const bird = kind === 'chickens';
      rig.sites.forEach((site, i) => {
        const t = time + site.seed,
          pose = grazingPose(site, time),
          walk = pose.walk;
        this.animal.position.set(pose.x, pose.y, pose.z);
        this.animal.rotation.set(0, pose.heading, 0);
        this.animal.scale.setScalar(0.94 + (site.seed % 1) * 0.08);
        this.animal.updateMatrix();
        this.root.copy(this.animal.matrix);
        rig.parts.forEach((part, j) => {
          this.joint.position.copy(part.pivot);
          this.joint.rotation.set(0, 0, 0);
          this.joint.scale.set(1, 1, 1);
          if (part.motion === 'body') this.joint.scale.x = 1 + Math.sin(t * 1.5) * 0.009;
          if (part.motion === 'head') {
            this.joint.rotation.x =
              pose.graze * (bird ? 0.45 + 0.2 * Math.sin(t * 3) : 0.48 + 0.1 * Math.sin(t * 0.8)) +
              walk * Math.sin(t * 4) * 0.025;
            this.joint.rotation.y = Math.sin(t * 0.7) * 0.1;
          }
          if (part.motion === 'leg' && walk)
            this.joint.rotation.x = Math.sin(pose.stride) * part.phase * 0.3 * walk;
          if (part.motion === 'tail') this.joint.rotation.z = Math.sin(t * 2.3) * 0.16;
          this.joint.updateMatrix();
          this.part.multiplyMatrices(this.root, this.joint.matrix);
          rig.meshes[j].setMatrixAt(i, this.part);
          const gait = rig.meshes[j].geometry.getAttribute('herdWalk');
          gait.setX(i, walk);
          gait.needsUpdate = true;
        });
      });
      for (const mesh of rig.meshes) if (mesh.count) mesh.instanceMatrix.needsUpdate = true;
    }
  }
  reset() {
    this.revision = '';
    this.fences.count = 0;
    for (const rig of this.rigs.values()) {
      rig.sites = [];
      for (const m of rig.meshes) m.count = 0;
    }
  }
}
