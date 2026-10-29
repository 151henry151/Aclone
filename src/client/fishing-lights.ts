// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import {
  boatLighting,
  navigationSector,
  navigationSignals,
  type NavigationLamp,
} from '../shared/boat-lighting';
import type { Player } from '../shared/types';
import { batch } from './tractor';
const deckPositions = [new T.Vector3(-1.8, 3.86, -0.05), new T.Vector3(1.8, 3.86, -0.05)];
const cabinPosition = new T.Vector3(0, 3.65, 3.67);
export type MarineLightLayout = {
  deck: T.Vector3[];
  targets: T.Vector3[];
  cabin: T.Vector3;
  cabinTarget: T.Vector3;
  deckPower: number;
  cabinPower: number;
  specs: [NavigationLamp, string, number, number, number][];
};
export const canalLightLayout: MarineLightLayout = {
  deck: [new T.Vector3(0, 2.53, 4.84), new T.Vector3(0, 2.53, -3.65)],
  targets: [new T.Vector3(0, 0.85, 5.7), new T.Vector3(0, 0.85, -5.4)],
  cabin: new T.Vector3(0, 2.35, 3.2),
  cabinTarget: new T.Vector3(0, 1.1, 3.75),
  deckPower: 24,
  cabinPower: 3.5,
  specs: [
    ['port', '#ff3020', 1.47, 2.62, 3.9],
    ['starboard', '#1cff68', -1.47, 2.62, 3.9],
    ['stern', '#fff4d2', 0, 1.7, -6.15],
    ['masthead', '#fff4d2', 0, 3.8, 3.9],
    ['trawlWhite', '#fff4d2', 0, 3.96, 3.9],
  ],
};
let windowMask: T.CanvasTexture;
export function fishingWindowMask() {
  if (!windowMask) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const c = canvas.getContext('2d')!;
    c.fillStyle = '#000';
    c.fillRect(0, 0, 1024, 512);
    c.fillStyle = '#fff';
    for (const x of [55, 355, 655]) c.fillRect(x + 10, 45, 250, 250);
    windowMask = new T.CanvasTexture(canvas);
    windowMask.colorSpace = T.SRGBColorSpace;
    windowMask.userData.shared = true;
  }
  return windowMask;
}
/** Emissive fixtures are cheap on every vessel; real illumination uses a scene-wide pool. */
export function createFishingLights(
  windowMaterial: T.MeshStandardMaterial,
  cabinMaterial: T.MeshStandardMaterial,
  layout?: MarineLightLayout,
) {
  const group = new T.Group(),
    fittings = new T.Group();
  group.name = layout
    ? 'Canal boat navigation and deck lights'
    : 'Fishing boat navigation and work lights';
  group.add(fittings);
  const housing = new T.MeshStandardMaterial({ color: '#233738', roughness: 0.6, metalness: 0.4 });
  const lamps = new Map<NavigationLamp, T.Mesh<T.SphereGeometry, T.MeshBasicMaterial>>();
  const specs: [NavigationLamp, string, number, number, number][] = layout?.specs ?? [
    // Forward is +Z; port is +X, starboard -X in these model coordinates.
    ['port', '#ff3020', 2.36, 4.25, 4.3],
    ['starboard', '#1cff68', -2.36, 4.25, 4.3],
    ['stern', '#fff4d2', 0, 2.08, -9.8],
    ['masthead', '#fff4d2', 0, 6.5, 2.6],
    ['trawlGreen', '#1cff68', 0, 7.8, 2.6],
    ['trawlWhite', '#fff4d2', 0, 5.8, 2.6],
  ];
  for (const [name, color, x, y, z] of specs) {
    const bracket = new T.Mesh(new T.CylinderGeometry(0.19, 0.19, 0.09, 8), housing);
    bracket.position.set(x, y - 0.18, z);
    fittings.add(bracket);
    if (!layout && (name === 'masthead' || name.startsWith('trawl'))) {
      const arm = new T.Mesh(new T.BoxGeometry(0.12, 0.08, 0.5), housing);
      arm.position.set(x, y - 0.18, 2.4);
      fittings.add(arm);
    }
    const lens = new T.Mesh(
      new T.SphereGeometry(0.14, 8, 6),
      new T.MeshBasicMaterial({ color, toneMapped: false }),
    );
    lens.name = 'Marine light ' + name;
    lens.position.set(x, y, z);
    group.add(lens);
    lamps.set(name, lens);
  }
  const floodMaterial = new T.MeshBasicMaterial({ color: '#151e20', toneMapped: false });
  const floods = new T.Group();
  group.add(floods);
  for (const [index, pos] of (layout?.deck ?? deckPositions).entries()) {
    const shell = new T.Mesh(new T.BoxGeometry(0.58, 0.31, 0.22), housing);
    shell.position.copy(pos);
    shell.rotation.x = -0.55;
    fittings.add(shell);
    const lens = new T.Mesh(new T.PlaneGeometry(0.49, 0.23), floodMaterial);
    lens.position.copy(pos).add(new T.Vector3(0, -0.06, -0.11));
    lens.rotation.set(Math.PI + 0.55, 0, 0);
    floods.add(lens);
    if (layout) {
      shell.lookAt(layout.targets[index]);
      lens.position
        .copy(pos)
        .addScaledVector(layout.targets[index].clone().sub(pos).normalize(), 0.12);
      lens.lookAt(layout.targets[index]);
    }
  }
  batch(fittings);
  batch(floods);
  windowMaterial.emissiveMap ??= fishingWindowMask();
  const observer = new T.Vector3();
  function update(root: T.Object3D, camera: T.Vector3, p?: Player, moored = false) {
    const state = p ? boatLighting(p) : { deck: false, cabin: 'off' };
    const trawling = !layout && !!(p?.trawl?.deployed || p?.trawl?.netFull);
    if (layout) root.userData.workLightLayout = layout;
    const signals = navigationSignals(trawling, p?.speed ?? 0, moored);
    root.updateWorldMatrix(true, false);
    observer.copy(camera);
    root.worldToLocal(observer);
    const bearing = Math.atan2(-observer.x, observer.z);
    const scale = Math.min(3, Math.max(1, observer.length() / 160));
    for (const [name, lens] of lamps) {
      lens.visible = signals[name] && navigationSector(name, bearing);
      lens.scale.setScalar(scale);
    }
    const color = state.cabin === 'red' ? '#ff3220' : '#ffe1a3';
    windowMaterial.emissive.set(color);
    windowMaterial.emissiveIntensity =
      state.cabin === 'off' ? 0 : state.cabin === 'red' ? 0.22 : 0.65;
    cabinMaterial.emissive.set(color);
    cabinMaterial.emissiveIntensity = state.cabin === 'off' ? 0 : state.cabin === 'red' ? 0.5 : 1.2;
    floodMaterial.color.set(state.deck ? '#fff1cc' : '#151e20');
    group.userData.signals = signals;
  }
  // Parked/gallery models start dark until their scene assigns a vessel state.
  for (const lens of lamps.values()) lens.visible = false;
  return { group, update };
}
/** Three shadow-free work lights total, irrespective of the number of boats.
 * Select the nearest operating boat; all others retain lit lenses and windows. */
export class FishingLightPool {
  readonly group = new T.Group();
  private deck = deckPositions.map(() => new T.SpotLight('#fff0ce', 0, 18, 1.05, 0.7, 2));
  private cabin = new T.SpotLight('#ffe1a3', 0, 3.4, 1.35, 0.7, 1);
  constructor() {
    this.group.name = 'Bounded fishing work-light pool';
    for (const light of [...this.deck, this.cabin]) this.group.add(light, light.target);
    this.group.visible = false;
  }
  update(boats: { root: T.Object3D; player: Player }[], camera: T.Vector3) {
    let best: (typeof boats)[number] | undefined,
      distance = 80;
    for (const b of boats) {
      const state = boatLighting(b.player);
      if (!state.deck && state.cabin === 'off') continue;
      const d = camera.distanceTo(b.root.getWorldPosition(new T.Vector3()));
      if (d < distance) {
        best = b;
        distance = d;
      }
    }
    this.group.visible = !!best;
    if (!best) return;
    const state = boatLighting(best.player),
      root = best.root;
    const fade = Math.min(1, (80 - distance) / 20);
    const layout = root.userData.workLightLayout as MarineLightLayout | undefined;
    for (let i = 0; i < 2; i++) {
      const light = this.deck[i];
      light.position.copy(root.localToWorld((layout?.deck ?? deckPositions)[i].clone()));
      light.target.position.copy(
        root.localToWorld(layout?.targets[i].clone() ?? new T.Vector3(i ? 1.4 : -1.4, 1.15, -6)),
      );
      light.intensity = state.deck ? (layout?.deckPower ?? 100) * fade : 0;
    }
    this.cabin.position.copy(root.localToWorld((layout?.cabin ?? cabinPosition).clone()));
    this.cabin.target.position.copy(
      root.localToWorld(layout?.cabinTarget.clone() ?? new T.Vector3(0, 1.4, 3.67)),
    );
    this.cabin.color.set(state.cabin === 'red' ? '#ff3220' : '#ffe1a3');
    this.cabin.intensity =
      (state.cabin === 'off'
        ? 0
        : state.cabin === 'red'
          ? layout
            ? 1
            : 2
          : (layout?.cabinPower ?? 7)) * fade;
  }
}
