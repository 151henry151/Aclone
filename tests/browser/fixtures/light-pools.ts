// SPDX-License-Identifier: GPL-3.0-or-later
// GPU regression fixture using the actual batched streetlamp material and mesh.
import * as T from 'three';
import { TownLighting } from '../../../src/client/lighting';
import { createWorld } from '../../../src/shared/simulation';
const renderer = new T.WebGLRenderer();
renderer.setSize(64, 64);
const scene = new T.Scene();
const camera = new T.OrthographicCamera(-16, 16, 16, -16, 0.1, 100);
camera.position.set(0, 40, 0);
camera.up.set(0, 0, -1);
camera.lookAt(0, 0, 0);
const root = new T.Group();
const lamp = new T.Mesh(new T.BoxGeometry(0.1, 0.1, 0.1), new T.MeshStandardMaterial());
lamp.position.set(0, 3.6, 0);
lamp.userData.lightSource = 'street';
root.add(lamp);
const lighting = new TownLighting(0);
lighting.reset(root, () => 0);
const w = createWorld('glow-test', 'Glow test', 'server');
w.settings.time = 0;
lighting.update(w, new T.Vector3());
scene.add(lighting.glow);
const target = new T.WebGLRenderTarget(64, 64);
const pixels = new Uint8Array(64 * 64 * 4);
(globalThis as any).renderGlows = (mode: string, colour: string) => {
  scene.fog =
    mode === 'none'
      ? null
      : mode === 'exponential'
        ? new T.FogExp2(colour, 0.025)
        : new T.Fog(colour, 0, mode === 'opaque' ? 30 : 80);
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  renderer.readRenderTargetPixels(target, 0, 0, 64, 64, pixels);
  const at = (x: number, y: number) =>
    Array.from(pixels.slice((y * 64 + x) * 4, (y * 64 + x) * 4 + 3));
  return {
    centre: at(32, 32),
    skirt: at(48, 32),
    corners: [at(8, 8), at(56, 8), at(8, 56), at(56, 56)],
    draws: renderer.info.render.calls,
  };
};
