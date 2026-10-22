// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { createWorld } from '../../../src/shared/simulation';
import { prepareSnowSurface, snowProfile, liftSnowShadow } from '../../../src/client/snow-surface';
import { GroundTracks } from '../../../src/client/ground-tracks';
import { tractor } from '../../../src/client/tractor';
import { creatorSchema } from '../../../src/shared/creator';
import {
  groundMaterial,
  snowCover,
  snowDepthVisual,
  waitForTextures,
} from '../../../src/client/materials';
const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(800, 600);
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.setClearColor('#253440');
document.body.style.margin = '0';
document.body.append(renderer.domElement);
const scene = new T.Scene();
scene.add(new T.HemisphereLight('#b6cbd9', '#7c8067', 1.1));
for (let i = 0; i < 6; i++) {
  const light = new T.SpotLight('#ffcd83', 1, 22, 1.12, 0.72, 1.4);
  light.position.set(-30, 5, -20 + i * 8);
  light.target.position.set(-30, 0, -20 + i * 8);
  scene.add(light, light.target);
}
const camera = new T.OrthographicCamera(-40, 40, 30, -30, 0.1, 200);
camera.position.set(0, 100, 0);
camera.up.set(0, 0, -1);
camera.lookAt(0, 0, 0);
const w = createWorld('snow-road-preview', 'Snow roads', 'owner');
w.creator = creatorSchema.parse({ roads: false });
w.roads = [{ a: { x: 0, z: -80 }, b: { x: 0, z: 80 }, width: 6 }];
const geometry = new T.PlaneGeometry(100, 100, 50, 50);
geometry.rotateX(-Math.PI / 2);
prepareSnowSurface(geometry, w);
scene.add(new T.Mesh(geometry, groundMaterial(w)));
await waitForTextures();
(window as any).renderSnow = (depth: number) => {
  snowDepthVisual.value = depth;
  snowCover.value = Math.min(1, depth / 0.04);
  renderer.render(scene, camera);
  const gl = renderer.getContext();
  const pixel = (x: number, y: number) => {
    const value = new Uint8Array(4);
    gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, value);
    return [...value].slice(0, 3);
  };
  return { road: pixel(400, 300), field: pixel(600, 300), calls: renderer.info.render.calls };
};

// Close view with fixed camera/scale, a real tractor and low plants: actual burial,
// not a colour-only comparison. The main terrain test above remains one draw call.
(window as any).snowCloseup = async (depth: number) => {
  if (!scene.getObjectByName('depth-reference')) {
    const reference = new T.Group();
    reference.name = 'depth-reference';
    const vehicle = new T.Group();
    vehicle.name = 'tractor';
    tractor(vehicle, '#b94e32');
    vehicle.position.set(6, 0, 0);
    reference.add(vehicle);
    for (let i = 0; i < 18; i++) {
      const plant = new T.Mesh(
        new T.BoxGeometry(0.025, 0.12, 0.025),
        new T.MeshStandardMaterial({ color: '#57763e' }),
      );
      plant.position.set(3.5 + (i % 6) * 0.65, 0.06, -2 + Math.floor(i / 6) * 0.35);
      reference.add(plant);
    }
    scene.add(reference);
    const sun = new T.DirectionalLight('#fff0dc', 1.5);
    sun.position.set(-8, 8, 5);
    scene.add(sun);
  }
  camera.left = -5;
  camera.right = 5;
  camera.top = 3.75;
  camera.bottom = -3.75;
  camera.position.set(-4, 3.5, 10);
  camera.up.set(0, 1, 0);
  camera.lookAt(4, 0.6, 0);
  camera.updateProjectionMatrix();
  await waitForTextures();
  liftSnowShadow(scene.getObjectByName('tractor')!, depth * snowProfile(w)(6, 0, 0));
  const result = (window as any).renderSnow(depth);
  const gl = renderer.getContext();
  const pixels = new Uint8Array(800 * 600 * 4);
  gl.readPixels(0, 0, 800, 600, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  let plants = 0;
  for (let i = 0; i < pixels.length; i += 4)
    if (pixels[i + 1] > pixels[i] * 1.25 && pixels[i + 1] > pixels[i + 2] * 1.15) plants++;
  return { ...result, plants };
};

// Exercise the same instanced rut material used by the game, including melting.
const tracks = new GroundTracks();
(window as any).snowTracks = (depth: number) => {
  if (!scene.children.includes(tracks.mesh)) {
    scene.add(tracks.mesh);
    for (let z = -6; z < 5; z += 1.16) tracks.record('driver', 6, z, 0, 'snow', true, 0.25);
  }
  tracks.sync((x, z) => depth * snowProfile(w)(x, z, 0), depth);
  (window as any).renderSnow(depth);
  return { calls: renderer.info.render.calls, marks: tracks.mesh.count };
};
