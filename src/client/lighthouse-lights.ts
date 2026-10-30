// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { World } from '../shared/types';
import { terrainHeight } from '../shared/terrain';
import { earthDrop } from '../shared/marine-visibility';
import { buildingPlan } from '../shared/building-shapes';
import { lighthouseRange, lighthouseFlash, lighthouseSignal } from '../shared/lighthouse-optics';

/** Signals have their own LOD: no distant terrain/house rendering is necessary. */
export class LighthouseLights {
  readonly group = new T.Group();
  private signals = new Map<
    string,
    { sprite: T.Sprite; checked: number; clear: boolean; eye: T.Vector3 }
  >();
  private map: T.DataTexture;
  constructor() {
    const pixels = new Uint8Array(32 * 32 * 4);
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        const i = (y * 32 + x) * 4,
          r = Math.hypot(x - 15.5, y - 15.5) / 15.5;
        pixels.set(
          [255, 242, 208, Math.round(Math.min(1, Math.max(0, 1 - r) * 1.7) ** 2 * 255)],
          i,
        );
      }
    this.map = new T.DataTexture(pixels, 32, 32);
    this.map.needsUpdate = true;
    this.group.name = 'Distant lighthouse navigation signals';
  }
  update(
    w: World,
    camera: T.Camera,
    time: number,
    daylight: number,
    mist: number,
    viewportHeight = 900,
  ) {
    const eye = camera.position,
      sources = w.buildings.filter((b) => b.kind === 'lighthouse' && !b.construction);
    const present = new Set(sources.map((b) => b.id));
    for (const [id, s] of this.signals)
      if (!present.has(id)) {
        this.group.remove(s.sprite);
        s.sprite.material.dispose();
        this.signals.delete(id);
      }
    for (const b of sources) {
      const tower = buildingPlan(b).volumes[0],
        c = Math.cos(b.rotation),
        s = Math.sin(b.rotation);
      const at = new T.Vector3(
        b.x + tower.x * c + tower.z * s,
        (b.foundationY ?? terrainHeight(w, b.x, b.z)) + tower.eaves + 1.45,
        b.z - tower.x * s + tower.z * c,
      );
      const delta = eye.clone().sub(at),
        d = delta.length(),
        horizontal = Math.hypot(delta.x, delta.z);
      const angle = (time * Math.PI) / 8 + b.x * 0.01 + b.rotation;
      let signal = this.signals.get(b.id);
      if (!signal) {
        const sprite = new T.Sprite(
          new T.SpriteMaterial({
            map: this.map,
            transparent: true,
            depthWrite: false,
            depthTest: true,
            fog: false,
            toneMapped: false,
            blending: T.AdditiveBlending,
          }),
        );
        sprite.name = b.name + ' rotating flash';
        // Water/glazing must not wash out the signal, but foreground opaque objects still occlude it.
        sprite.renderOrder = 10;
        this.group.add(sprite);
        signal = { sprite, checked: -Infinity, clear: false, eye: new T.Vector3(Infinity, 0, 0) };
        this.signals.set(b.id, signal);
      }
      const range = lighthouseRange(at.y - w.settings.seaLevel, eye.y - w.settings.seaLevel);
      if (time - signal.checked > 0.5 || time < signal.checked || signal.eye.distanceTo(eye) > 15) {
        signal.checked = time;
        signal.eye.copy(eye);
        signal.clear = horizontal <= range;
        // Terrain occlusion is independent of the streamed scene/fog. Never
        // shine through a headland whose mesh is outside the draw radius.
        const steps = Math.ceil(horizontal / 25);
        for (let i = 1; signal.clear && i < steps; i++) {
          const t = i / steps,
            x = at.x + delta.x * t,
            z = at.z + delta.z * t;
          if (terrainHeight(w, x, z) + earthDrop(horizontal) * t * (1 - t) > at.y + delta.y * t)
            signal.clear = false;
        }
      }
      const flash = lighthouseFlash(
        angle,
        Math.atan2(-delta.z, delta.x),
        Math.atan2(delta.y, horizontal),
      );
      signal.sprite.material.opacity = signal.clear
        ? lighthouseSignal(flash, d, daylight, mist)
        : 0;
      signal.sprite.visible = signal.sprite.material.opacity > 0.001;
      const apparent = at.clone();
      apparent.y -= earthDrop(horizontal);
      const direction = apparent.sub(eye),
        draw = Math.max(0, direction.length() - 3.5);
      signal.sprite.position.copy(eye).addScaledVector(direction.normalize(), draw);
      // A sub-pixel physical lamp needs a small optical glare, not a huge glowing ball.
      const fov = (camera as T.PerspectiveCamera).fov ?? 53;
      signal.sprite.scale.setScalar(
        Math.max(
          0.18,
          (2 * draw * Math.tan((fov * Math.PI) / 360) * (3 + 4 * flash)) / viewportHeight,
        ),
      );
    }
  }
}
