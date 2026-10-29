// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { World } from '../shared/types';
import { terrainHeight } from '../shared/terrain';
import { buildingPlan } from '../shared/building-shapes';
import {
  lighthouseRange,
  lighthouseFlash,
  lighthouseLocalLight,
} from '../shared/lighthouse-optics';

/** Signals have their own LOD: no distant terrain/house rendering is necessary. */
export class LighthouseLights {
  readonly group = new T.Group();
  private signals = new Map<
    string,
    { sprite: T.Sprite; checked: number; clear: boolean; eye: T.Vector3 }
  >();
  private spot = new T.SpotLight('#fff1c6', 0, 350, 0.035, 0.8, 0);
  private shaft: T.Mesh<T.ConeGeometry, T.ShaderMaterial>;
  private map: T.DataTexture;
  private shadowTick = -1;
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
    this.spot.castShadow = true;
    this.spot.shadow.mapSize.set(512, 512);
    this.spot.shadow.bias = -0.0003;
    this.spot.shadow.autoUpdate = false;
    this.spot.shadow.camera.near = 1;
    this.spot.shadow.camera.far = 350;
    this.group.add(this.spot, this.spot.target);
    this.shaft = new T.Mesh(
      new T.ConeGeometry(20, 800, 16, 1, true),
      new T.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: T.DoubleSide,
        blending: T.AdditiveBlending,
        uniforms: { strength: { value: 0 } },
        vertexShader:
          'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader:
          'varying vec2 vUv; uniform float strength; void main(){gl_FragColor=vec4(1.,.94,.77,strength*pow(vUv.y,2.)*.035);}',
      }),
    );
    this.group.add(this.shaft);
    this.group.name = 'Horizon lighthouse flashes and local illumination';
  }
  update(w: World, camera: T.Camera, time: number, daylight: number, mist: number) {
    const eye = camera.position,
      sources = w.buildings.filter((b) => b.kind === 'lighthouse' && !b.construction);
    const present = new Set(sources.map((b) => b.id));
    for (const [id, s] of this.signals)
      if (!present.has(id)) {
        this.group.remove(s.sprite);
        s.sprite.material.dispose();
        this.signals.delete(id);
      }
    let nearest = Infinity;
    let selected: { at: T.Vector3; angle: number } | undefined;
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
      if (d < nearest) {
        nearest = d;
        selected = { at, angle };
      }
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
        this.group.add(sprite);
        signal = { sprite, checked: -Infinity, clear: false, eye: new T.Vector3(Infinity, 0, 0) };
        this.signals.set(b.id, signal);
      }
      const range = lighthouseRange(at.y - w.settings.seaLevel, eye.y - w.settings.seaLevel);
      if (time - signal.checked > 0.5 || time < signal.checked || signal.eye.distanceTo(eye) > 15) {
        signal.checked = time;
        signal.eye.copy(eye);
        signal.clear = d < range;
        // Terrain occlusion is independent of the streamed scene/fog. Never
        // shine through a headland whose mesh is outside the draw radius.
        const steps = Math.ceil(horizontal / 25);
        for (let i = 1; signal.clear && i < steps; i++) {
          const t = i / steps,
            x = at.x + delta.x * t,
            z = at.z + delta.z * t;
          if (terrainHeight(w, x, z) > at.y + delta.y * t) signal.clear = false;
        }
      }
      const flash = lighthouseFlash(
        angle,
        Math.atan2(-delta.z, delta.x),
        Math.atan2(delta.y, horizontal),
      );
      signal.sprite.material.opacity = signal.clear
        ? flash * (1 - 0.75 * daylight) * Math.exp(-d * (0.000012 + mist * 0.0012))
        : 0;
      signal.sprite.visible = signal.sprite.material.opacity > 0.001;
      // A projected beacon remains inside the camera far plane even at 30km.
      const draw = Math.min(Math.max(0, d - 3.5), (camera as T.PerspectiveCamera).far * 0.85);
      signal.sprite.position.copy(eye).addScaledVector(delta, -draw / Math.max(d, 0.01));
      signal.sprite.scale.setScalar(Math.max(0.25, draw * 0.003));
    }
    this.spot.intensity = 0;
    this.spot.visible = false;
    this.shaft.visible = false;
    if (selected && nearest < 1200) {
      const { at, angle } = selected,
        dir = new T.Vector3(Math.cos(angle), 0, -Math.sin(angle));
      this.spot.position.copy(at);
      this.spot.target.position.copy(at).addScaledVector(dir, 800);
      // Mask the landward sector instead of sweeping a searchlight over town.
      const seaward = [80, 200].every(
        (distance) =>
          terrainHeight(w, at.x + dir.x * distance, at.z + dir.z * distance) < w.settings.seaLevel,
      );
      const local = lighthouseLocalLight(daylight, mist, seaward);
      this.spot.intensity = local.surface;
      this.spot.visible = local.surface > 0;
      this.spot.shadow.needsUpdate = Math.floor(time * 4) !== this.shadowTick;
      this.shadowTick = Math.floor(time * 4);
      this.shaft.visible = local.shaft > 0;
      if (this.shaft.visible) {
        let reach = 800;
        for (let d = 10; d < 800; d += 10) {
          const p = at.clone().addScaledVector(dir, d);
          if (terrainHeight(w, p.x, p.z) > p.y) {
            reach = d;
            break;
          }
        }
        this.shaft.position.copy(at).addScaledVector(dir, reach / 2);
        this.shaft.quaternion.setFromUnitVectors(new T.Vector3(0, -1, 0), dir.normalize());
        this.shaft.scale.set(reach / 800, reach / 800, reach / 800);
        this.shaft.material.uniforms.strength.value = local.shaft;
      }
    }
  }
}
