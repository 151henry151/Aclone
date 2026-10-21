// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { createWorld } from '../../../src/shared/simulation';
import { creatorSchema } from '../../../src/shared/creator';
import {
  groundMaterial,
  snowCover,
  snowDepthVisual,
  waitForTextures,
} from '../../../src/client/materials';
const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(800, 600);
renderer.setClearColor('#253440');
document.body.style.margin = '0';
document.body.append(renderer.domElement);
const scene = new T.Scene();
scene.add(new T.HemisphereLight('#ffffff', '#999999', 3));
const camera = new T.OrthographicCamera(-40, 40, 30, -30, 0.1, 200);
camera.position.set(0, 100, 0);
camera.up.set(0, 0, -1);
camera.lookAt(0, 0, 0);
const w = createWorld('snow-road-preview', 'Snow roads', 'owner');
w.creator = creatorSchema.parse({ roads: false });
w.roads = [{ a: { x: 0, z: -80 }, b: { x: 0, z: 80 }, width: 6 }];
const geometry = new T.PlaneGeometry(100, 100);
geometry.rotateX(-Math.PI / 2);
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
