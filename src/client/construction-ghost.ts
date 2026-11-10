// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { Building, World } from '../shared/types';
import { buildingModel } from './buildings';
import { creatorModel } from './creator-model';
import { addFoundation } from './foundations';
import { foundationProfile } from '../shared/construction-site';
import { terrainHeight } from '../shared/terrain';
import { fitBoatyardToWater } from './boatyard';
import { fitQuayToWater } from './quay';
import { fitRiverDockToWater } from './river-dock';
/** Private, on-demand geometry in the existing world renderer. Never a world building. */
export class ConstructionGhost {
  group?: T.Group;
  private key = '';
  private bounds = new T.Box3();
  private center = new T.Vector3();
  private size = new T.Vector3();
  private color = new T.Color();
  private view = Math.PI / 4;
  private saved?: { position: T.Vector3; rotation: T.Quaternion };
  private world?: World;
  constructor(
    private scene: T.Scene,
    private camera: T.PerspectiveCamera,
    private makeModel = buildingModel,
  ) {}
  show(b: Building, w: World, refusal: string) {
    this.world = w;
    const custom = w.creator?.models.find((m) => m.id === b.creatorModel);
    const profile = foundationProfile(w, b);
    const key = JSON.stringify([
      w.id,
      b.kind,
      b.creatorModel,
      custom,
      b.architecture,
      b.style,
      b.size,
      b.rotation,
      b.x,
      b.z,
      b.foundationY,
      profile.low,
    ]);
    this.color.set(refusal ? '#ef8b68' : '#95e5b3');
    if (this.key !== key || !this.group) {
      this.clearModel();
      this.key = key;
      const group = custom ? creatorModel(custom, w) : this.makeModel(b);
      this.group = group;
      addFoundation(group, b, w);
      if (b.kind === 'boathouse') fitBoatyardToWater(group, b, w);
      if (b.kind === 'quay') fitQuayToWater(group, b, w);
      if (b.kind === 'riverDock') fitRiverDockToWater(group, b, w);
      group.position.set(b.x, b.foundationY ?? profile.level, b.z);
      group.rotation.y = b.rotation;
      group.name = 'Local construction preview';
      group.userData.redraw = () => {
        if (this.group === group) this.refresh();
      };
      this.scene.add(group);
    }
    this.refresh();
  }
  private refresh() {
    if (!this.group) return;
    this.group.traverse((o) => {
      if (o instanceof T.Light || o instanceof T.Sprite) o.visible = false;
      if (!(o instanceof T.Mesh)) return;
      o.castShadow = false;
      o.receiveShadow = false;
      if (!o.userData.ghostOriginal) {
        o.userData.ghostOriginal = o.material;
        const originals = Array.isArray(o.material) ? o.material : [o.material];
        const materials = originals.map(
          (original) =>
            new T.MeshBasicMaterial({
              map: 'map' in original ? (original.map as T.Texture) : null,
              transparent: true,
              opacity: 0.42,
              depthWrite: false,
              side: T.DoubleSide,
            }),
        );
        o.material = Array.isArray(o.material) ? materials : materials[0];
      }
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        (m as T.MeshBasicMaterial).color.copy(this.color);
    });
    this.bounds.setFromObject(this.group);
    this.bounds.getCenter(this.center);
    this.bounds.getSize(this.size);
  }
  turn(angle: number) {
    this.view += angle;
  }
  frame(width: number, height: number) {
    if (!this.group || this.bounds.isEmpty()) return;
    this.saved ??= {
      position: this.camera.position.clone(),
      rotation: this.camera.quaternion.clone(),
    };
    // Reserve the lower portion for the compact confirmation card, including phones.
    const usableHeight = height * (width < 650 ? 0.53 : 0.64);
    const fov = T.MathUtils.degToRad(this.camera.fov);
    const radius = Math.max(2, this.size.length() / 2);
    const distance =
      (radius / Math.sin(fov / 2)) * Math.max(height / usableHeight, height / width) * 1.08;
    this.camera.position
      .copy(this.center)
      .add(
        new T.Vector3(Math.sin(this.view) * 0.8, 0.6, Math.cos(this.view) * 0.8).multiplyScalar(
          distance,
        ),
      );
    if (this.world)
      this.camera.position.y = Math.max(
        this.camera.position.y,
        terrainHeight(this.world, this.camera.position.x, this.camera.position.z) + 2,
      );
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.center);
    this.camera.setViewOffset(
      width,
      height,
      0,
      height * (width < 650 ? 0.21 : 0.16),
      width,
      height,
    );
  }
  private clearModel() {
    const group = this.group;
    if (!group) return;
    this.scene.remove(group);
    delete group.userData.redraw;
    const materials = new Set<T.Material>(),
      textures = new Set<T.Texture>(),
      geometries = new Set<T.BufferGeometry>();
    group.traverse((o) => {
      o.userData.disposed = true;
      o.userData.mixer?.stopAllAction();
      if (o.userData.mixer) o.userData.mixer.uncacheRoot(o.userData.animationRoot);
      if (o instanceof T.InstancedMesh) o.dispose();
      if (o instanceof T.Mesh || o instanceof T.Line || o instanceof T.Sprite) {
        if ('geometry' in o && !o.geometry.userData.shared) geometries.add(o.geometry);
        for (const collection of [o.material, o.userData.ghostOriginal])
          for (const m of Array.isArray(collection) ? collection : [collection])
            if (m && !m.userData.shared) {
              materials.add(m);
              for (const value of Object.values(m))
                if (value instanceof T.Texture && !value.userData.shared) textures.add(value);
            }
      }
    });
    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
    for (const t of textures) t.dispose();
    this.group = undefined;
  }
  clear() {
    this.clearModel();
    this.key = '';
    this.world = undefined;
    this.view = Math.PI / 4;
    if (this.saved) {
      this.camera.position.copy(this.saved.position);
      this.camera.quaternion.copy(this.saved.rotation);
      this.camera.clearViewOffset();
      this.saved = undefined;
    }
  }
}
