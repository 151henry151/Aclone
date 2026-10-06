// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { calendar, eveningLights, sunAt } from '../shared/environment';
import type { World } from '../shared/types';
type Source = {
  pane: T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>;
  building?: string;
  position: T.Vector3;
  target: T.Vector3;
};
type Glow = { source: Source; start: number; falloff: Float32Array; weight: number };
const lampColour = new T.Color('#ffcd83').multiplyScalar(0.3);
const glowRadius = 13,
  glowGrid = 9,
  // Spotlights fade out over this many metres before the next lamp would take their slot.
  handover = 20;
/** Fixed light budget, regardless of village size. Windows shine outward, not through their house. */
export class TownLighting {
  readonly group = new T.Group();
  /** Ground pools for lit streetlamps that have no spotlight of their own. */
  readonly glow = new T.Mesh(
    new T.BufferGeometry(),
    new T.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: T.AdditiveBlending,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    }),
  );
  private sources: Source[] = [];
  private glows: Glow[] = [];
  private lastWorld?: World;
  private lastClock = NaN;
  private lastTime = NaN;
  private lastFocus = new T.Vector3(Infinity, Infinity, Infinity);
  private pool: T.SpotLight[];
  constructor(limit = 12) {
    this.pool = Array.from({ length: limit }, () => {
      const light = new T.SpotLight('#ffcd83', 0, 22, 1.12, 0.72, 1.4);
      this.group.add(light, light.target);
      return light;
    });
    this.glow.visible = false;
  }
  /** `ground` gives the terrain height under a lamp; by default its pool lies flat below the lamp. */
  reset(root: T.Group, ground?: (x: number, z: number) => number) {
    this.lastWorld = undefined;
    this.sources = [];
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (!(o instanceof T.Mesh) || !o.userData.lightSource) return;
      const pane = o as Source['pane'],
        position = o.getWorldPosition(new T.Vector3());
      const street = o.userData.lightSource === 'street';
      const out = street
        ? new T.Vector3(0, -1, 0)
        : new T.Vector3(0, -0.35, 1).transformDirection(o.matrixWorld);
      this.sources.push({
        pane,
        position: position.clone().addScaledVector(out, 0.24),
        target: position.clone().addScaledVector(out, 6),
        building: street ? undefined : o.userData.lightSource,
      });
    });
    // One dynamic pane draw per building, rather than one per window.
    const batches = new Map<string, Source[]>();
    for (const source of this.sources) {
      const key = source.building ?? 'street';
      const list = batches.get(key) ?? [];
      list.push(source);
      batches.set(key, list);
    }
    for (const list of batches.values()) {
      const geometries = list.map((s) => s.pane.geometry.clone().applyMatrix4(s.pane.matrixWorld));
      const pane = new T.Mesh(mergeGeometries(geometries)!, list[0].pane.material.clone());
      root.add(pane);
      for (const source of list) {
        source.pane.removeFromParent();
        source.pane.geometry.dispose();
        source.pane.material.dispose();
        source.pane = pane;
      }
      geometries.forEach((g) => g.dispose());
    }
    this.buildGlow(root, ground);
  }
  private buildGlow(root: T.Group, ground?: (x: number, z: number) => number) {
    this.glow.removeFromParent();
    this.glow.geometry.dispose();
    this.glows = [];
    const positions: number[] = [],
      index: number[] = [];
    for (const source of this.sources) {
      if (source.building) continue;
      const { x: cx, z: cz } = source.position,
        start = positions.length / 3,
        falloff = new Float32Array(glowGrid * glowGrid);
      for (let j = 0; j < glowGrid; j++)
        for (let i = 0; i < glowGrid; i++) {
          const x = cx + ((i / (glowGrid - 1)) * 2 - 1) * glowRadius,
            z = cz + ((j / (glowGrid - 1)) * 2 - 1) * glowRadius,
            r = Math.hypot(x - cx, z - cz) / glowRadius;
          const y = ground ? ground(x, z) : source.position.y - 3.36;
          positions.push(x, y + 0.2, z);
          falloff[j * glowGrid + i] = Math.max(0, 1 - r * r) ** 2;
          if (i && j) {
            const a = start + (j - 1) * glowGrid + i - 1,
              b = a + 1,
              c = a + glowGrid,
              d = c + 1;
            index.push(a, c, b, b, c, d);
          }
        }
      this.glows.push({ source, start, falloff, weight: 0 });
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new T.Float32BufferAttribute(positions.length, 3));
    geometry.setIndex(index);
    geometry.computeBoundingSphere();
    this.glow.geometry = geometry;
    this.glow.visible = false;
    root.add(this.glow);
  }
  update(w: World, focus: T.Vector3) {
    // Snapshot state changes at 5 Hz. Reusing it between frames avoids sorting
    // every window/streetlamp at 60 Hz while the focus barely moves.
    if (
      this.lastWorld === w &&
      this.lastClock === w.settings.time &&
      this.lastTime === w.time &&
      this.lastFocus.distanceToSquared(focus) < 1
    )
      return;
    this.lastWorld = w;
    this.lastClock = w.settings.time;
    this.lastTime = w.time;
    this.lastFocus.copy(focus);
    const day = calendar(w).dayOfYear,
      night = 1 - sunAt(w.settings.time, day).daylight;
    const byId = new Map(w.buildings.map((b) => [b.id, b]));
    const lit = new Set<Source>();
    const active = this.sources
      .filter((s) => {
        const b = s.building && byId.get(s.building);
        const on = s.building ? !!b && eveningLights(b, w.settings.time, day) : night > 0.8;
        s.pane.material.emissive.set('#ffca72');
        s.pane.material.emissiveIntensity = on ? 2 : 0;
        if (on) lit.add(s);
        return on;
      })
      .sort((a, b) => a.position.distanceToSquared(focus) - b.position.distanceToSquared(focus));
    this.group.visible = active.length > 0;
    const counts = new Map<string, number>();
    const nearby = active.filter((s) => {
      const key = s.building ?? String(s.position.z);
      const n = counts.get(key) ?? 0;
      counts.set(key, n + 1);
      return n < 3;
    });
    // Fade each spotlight as the next candidate closes in, so a slot changes hands at zero.
    const next = nearby[this.pool.length],
      reach = next ? next.position.distanceTo(focus) : Infinity;
    const strength = new Map<Source, number>();
    this.pool.forEach((light, i) => {
      const source = nearby[i];
      const fade = source
        ? Math.min(1, Math.max(0, (reach - source.position.distanceTo(focus)) / handover))
        : 0;
      if (source) strength.set(source, fade);
      light.intensity = source ? (source.building ? 65 : 55) * fade : 0;
      if (source) {
        // Shallower distance falloff keeps the wide skirt useful between lamps.
        // Reduce output to retain the existing brightness directly underneath.
        // Reapply both profiles: a pooled lamp may have been a window last frame.
        const street = !source.building;
        light.distance = street ? 70 : 22;
        light.angle = street ? 1.55 : 1.12;
        light.penumbra = street ? 0.18 : 0.72;
        light.decay = street ? 0.8 : 1.4;
        light.position.copy(source.position);
        light.target.position.copy(source.target);
      }
    });
    this.updateGlow((s) => (lit.has(s) ? 1 - (strength.get(s) ?? 0) : 0));
  }
  private updateGlow(weight: (s: Source) => number) {
    const color = this.glow.geometry.getAttribute('color') as T.BufferAttribute | undefined;
    let visible = false,
      changed = false;
    for (const glow of this.glows) {
      const next = weight(glow.source);
      visible ||= next > 0;
      if (next === glow.weight || !color) continue;
      glow.weight = next;
      changed = true;
      for (let i = 0; i < glow.falloff.length; i++) {
        const f = glow.falloff[i] * next;
        color.setXYZ(glow.start + i, lampColour.r * f, lampColour.g * f, lampColour.b * f);
      }
    }
    if (changed && color) color.needsUpdate = true;
    this.glow.visible = visible;
  }
}
