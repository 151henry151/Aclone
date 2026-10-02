// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Blueprint } from '../shared/creator';
import type { World } from '../shared/types';
import { publicPath } from '../shared/public-path';
declare const __ACLONE_BASE__: string;
/** Primitive parts are baked by color, keeping each instance's draw count small. */
export function creatorModel(model: Blueprint, world: World): T.Group {
  const root = new T.Group();
  root.userData.creatorModel = true; // Keep dynamic/custom models out of world scenery baking.
  const batches = new Map<string, T.BufferGeometry[]>();
  for (const p of model.parts) {
    const g =
      p.shape === 'sphere'
        ? new T.SphereGeometry(0.5, 16, 10)
        : p.shape === 'cone'
          ? new T.ConeGeometry(0.5, 1, 16)
          : p.shape === 'cylinder'
            ? new T.CylinderGeometry(0.5, 0.5, 1, 16)
            : new T.BoxGeometry(1, 1, 1);
    g.scale(p.sx, p.sy, p.sz);
    g.rotateY((p.yaw * Math.PI) / 180);
    g.translate(p.x, p.y, p.z);
    const list = batches.get(p.color) ?? [];
    list.push(g.toNonIndexed());
    g.dispose();
    batches.set(p.color, list);
  }
  for (const [color, list] of batches) {
    const geometry = mergeGeometries(list);
    list.forEach((g) => g.dispose());
    if (geometry)
      root.add(new T.Mesh(geometry, new T.MeshStandardMaterial({ color, roughness: 0.7 })));
  }
  const asset = world.assets.find((a) => a.id === model.asset);
  if (asset) {
    const url = publicPath(__ACLONE_BASE__, asset.url);
    if (asset.type.startsWith('image/')) {
      const texture = new T.TextureLoader().load(url, () => {
        if (!root.userData.disposed) root.userData.redraw?.();
      });
      texture.colorSpace = T.SRGBColorSpace;
      const mesh = new T.Mesh(
        new T.PlaneGeometry(model.width, model.height),
        new T.MeshStandardMaterial({
          map: texture,
          side: T.DoubleSide,
          transparent: true,
          alphaTest: 0.15,
        }),
      );
      mesh.position.y = model.height / 2;
      root.add(mesh);
    } else if (asset.type === 'model/gltf-binary') {
      // Server validates embedded-only GLB. A visible proxy remains if loading fails.
      const proxy = new T.Mesh(
        new T.BoxGeometry(model.width, model.height, model.depth),
        new T.MeshStandardMaterial({ color: '#869687', wireframe: true }),
      );
      proxy.position.y = model.height / 2;
      root.add(proxy);
      void import('three/addons/loaders/GLTFLoader.js')
        .then(({ GLTFLoader }) => {
          if (root.userData.disposed) return;
          new GLTFLoader().load(
            url,
            (gltf) => {
              if (!gltf.scene) {
                root.userData.loadFailed = true;
                return;
              }
              if (root.userData.disposed) {
                disposeCreator(gltf.scene);
                return;
              }
              const box = new T.Box3().setFromObject(gltf.scene),
                size = box.getSize(new T.Vector3()),
                center = box.getCenter(new T.Vector3());
              if (
                box.isEmpty() ||
                ![...size.toArray(), ...center.toArray()].every(Number.isFinite)
              ) {
                disposeCreator(gltf.scene);
                root.userData.loadFailed = true;
                return;
              }
              const scale = Math.min(
                model.width / Math.max(0.001, size.x),
                model.height / Math.max(0.001, size.y),
                model.depth / Math.max(0.001, size.z),
              );
              gltf.scene.scale.setScalar(scale);
              gltf.scene.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
              root.remove(proxy);
              proxy.geometry.dispose();
              proxy.material.dispose();
              root.add(gltf.scene);
              gltf.scene.updateMatrixWorld(true);
              root.userData.redraw?.();
            },
            undefined,
            () => {
              root.userData.loadFailed = true;
            },
          );
        })
        .catch(() => {
          root.userData.loadFailed = true;
        });
    }
  }
  return root;
}
export function disposeCreator(root: T.Object3D) {
  root.traverse((o) => {
    o.userData.disposed = true;
    if (o instanceof T.Mesh) {
      o.geometry.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if ('map' in m) (m.map as T.Texture)?.dispose();
        m.dispose();
      }
    }
  });
}
/** One on-demand renderer, disposed when the workshop closes. */
export function previewCreator(host: HTMLElement, model: Blueprint, world: World) {
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(Math.max(200, host.clientWidth), 260);
  host.replaceChildren(renderer.domElement);
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(40, Math.max(200, host.clientWidth) / 260, 0.1, 500);
  scene.add(new T.HemisphereLight(0xe5f2ff, 0x35452a, 2));
  const light = new T.DirectionalLight(0xffefda, 3);
  light.position.set(10, 20, 10);
  scene.add(light);
  const group = creatorModel(model, world);
  scene.add(group);
  const size = Math.max(
    model.width,
    model.height,
    model.depth,
    ...model.parts.map((p) =>
      Math.max(Math.abs(p.x) + p.sx, Math.abs(p.y) + p.sy, Math.abs(p.z) + p.sz),
    ),
  );
  camera.position.set(size * 1.6, size * 1.1, size * 1.6);
  camera.lookAt(0, size * 0.35, 0);
  const render = () => renderer.render(scene, camera);
  group.userData.redraw = render;
  render();
  let dragging = false,
    last = 0;
  renderer.domElement.onpointerdown = (e) => {
    dragging = true;
    last = e.clientX;
    renderer.domElement.setPointerCapture(e.pointerId);
  };
  renderer.domElement.onpointerup = () => {
    dragging = false;
  };
  renderer.domElement.onpointermove = (e) => {
    if (dragging) {
      group.rotation.y += (e.clientX - last) * 0.015;
      last = e.clientX;
      render();
    }
  };
  return () => {
    group.userData.disposed = true;
    delete group.userData.redraw;
    disposeCreator(group);
    renderer.dispose();
    renderer.forceContextLoss();
  };
}
