// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { parseObj } from '../shared/obj';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Blueprint } from '../shared/creator';
import type { World } from '../shared/types';
import { publicPath } from '../shared/public-path';
declare const __ACLONE_BASE__: string;
/** Primitive parts are baked by color, keeping each instance's draw count small. */
const models = new Set<T.Group>();
export function creatorModel(model: Blueprint, world: World): T.Group {
  const root = new T.Group();
  models.add(root);
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
  const primitiveTexture = !model.asset && world.assets.find((a) => a.id === model.texture);
  if (primitiveTexture) {
    root.userData.loading = true;
    new T.TextureLoader().load(
      publicPath(__ACLONE_BASE__, primitiveTexture.url),
      (texture) => {
        if (root.userData.disposed) {
          texture.dispose();
          return;
        }
        texture.colorSpace = T.SRGBColorSpace;
        root.traverse((o) => {
          if (o instanceof T.Mesh) {
            o.material.map = texture;
            o.material.needsUpdate = true;
          }
        });
        root.userData.loading = false;
        root.userData.redraw?.();
      },
      undefined,
      () => {
        root.userData.loading = false;
        root.userData.loadFailed = true;
        root.userData.redraw?.();
      },
    );
  }
  const asset = world.assets.find((a) => a.id === model.asset);
  if (asset) {
    const url = publicPath(__ACLONE_BASE__, asset.url);
    if (asset.type.startsWith('image/')) {
      root.userData.loading = true;
      const texture = new T.TextureLoader().load(
        url,
        () => {
          root.userData.loading = false;
          if (root.userData.disposed) texture.dispose();
          else root.userData.redraw?.();
        },
        undefined,
        () => {
          root.userData.loading = false;
          root.userData.loadFailed = true;
          root.userData.redraw?.();
        },
      );
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
    } else if (['model/gltf-binary', 'model/obj'].includes(asset.type)) {
      const proxy = new T.Mesh(
        new T.BoxGeometry(model.width, model.height, model.depth),
        new T.MeshStandardMaterial({ color: '#869687', wireframe: true }),
      );
      proxy.position.y = model.height / 2;
      root.add(proxy);
      root.userData.loading = true;
      const load = async () => {
        if (asset.type === 'model/gltf-binary') {
          const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
          const gltf = await new GLTFLoader().loadAsync(url, (event) => {
            root.userData.progress = event.total
              ? Math.round((event.loaded / event.total) * 100)
              : undefined;
          });
          if (!root.userData.disposed && model.animation >= 0 && gltf.animations[model.animation]) {
            const mixer = new T.AnimationMixer(gltf.scene);
            mixer.timeScale = model.animationSpeed;
            mixer.clipAction(gltf.animations[model.animation]).play();
            root.userData.mixer = mixer;
            root.userData.animationRoot = gltf.scene;
          }
          return gltf.scene;
        }
        const response = await fetch(url);
        if (!response.ok) throw Error('Model download failed');
        const data = parseObj(await response.text());
        if (root.userData.disposed) return;
        const geometry = new T.BufferGeometry();
        geometry.setAttribute('position', new T.BufferAttribute(data.position, 3));
        geometry.setAttribute('uv', new T.BufferAttribute(data.uv, 2));
        if (data.normal) geometry.setAttribute('normal', new T.BufferAttribute(data.normal, 3));
        else geometry.computeVertexNormals();
        const visual = new T.Group(),
          material = new T.MeshStandardMaterial({
            color: '#ddd9ce',
            alphaTest: 0.15,
            roughness: 0.8,
            side: T.DoubleSide,
          });
        visual.add(new T.Mesh(geometry, material));
        const texture = world.assets.find(
          (a) => a.id === model.texture && a.type.startsWith('image/'),
        );
        try {
          if (texture) {
            material.map = await new T.TextureLoader().loadAsync(
              publicPath(__ACLONE_BASE__, texture.url),
            );
            material.map.colorSpace = T.SRGBColorSpace;
            material.color.set('#ffffff');
            material.needsUpdate = true;
          }
          return visual;
        } catch (error) {
          disposeCreator(visual);
          throw error;
        }
      };
      void load()
        .then((visual) => {
          root.userData.loading = false;
          if (!visual) return;
          if (root.userData.disposed) {
            disposeCreator(visual);
            return;
          }
          const box = new T.Box3().setFromObject(visual),
            size = box.getSize(new T.Vector3()),
            center = box.getCenter(new T.Vector3());
          if (box.isEmpty() || ![...size.toArray(), ...center.toArray()].every(Number.isFinite)) {
            disposeCreator(visual);
            throw Error('Invalid model bounds');
          }
          const scale = Math.min(
            model.width / Math.max(0.001, size.x),
            model.height / Math.max(0.001, size.y),
            model.depth / Math.max(0.001, size.z),
          );
          visual.scale.setScalar(scale);
          visual.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
          root.remove(proxy);
          proxy.geometry.dispose();
          proxy.material.dispose();
          root.add(visual);
          visual.updateMatrixWorld(true);
          root.userData.redraw?.();
        })
        .catch(() => {
          root.userData.loading = false;
          root.userData.loadFailed = true;
          root.userData.redraw?.();
        });
    }
  }
  return root;
}
export function disposeCreator(root: T.Object3D) {
  models.delete(root as T.Group);
  root.traverse((o) => {
    o.userData.disposed = true;
    o.userData.mixer?.stopAllAction();
    if (o.userData.mixer) o.userData.mixer.uncacheRoot(o.userData.animationRoot);
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
  const status = document.createElement('p');
  status.dataset.modelStatus = '';
  status.setAttribute('role', 'status');
  host.replaceChildren(renderer.domElement, status);
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
  const render = () => {
    status.textContent = group.userData.loading
      ? `Loading model… ${group.userData.progress ?? ''}${group.userData.progress === undefined ? '' : '%'}`
      : group.userData.loadFailed
        ? 'Model failed to load; showing its collision bounds.'
        : 'Model ready';
    renderer.render(scene, camera);
  };
  group.userData.redraw = render;
  render();
  let previous = performance.now();
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    if (group.userData.mixer) {
      group.userData.mixer.update(Math.min(0.1, (now - previous) / 1000));
      render();
    }
    previous = now;
  });
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
    renderer.setAnimationLoop(null);
    renderer.dispose();
    renderer.forceContextLoss();
  };
}

/** Bound animated creator cost; distant visuals keep their last pose. */
export function animateCreatorModels(root: T.Object3D, dt: number, observer: T.Vector3) {
  let active = 0,
    loading = 0,
    failed = 0;
  for (const o of models) {
    if (o.userData.disposed) {
      models.delete(o);
      continue;
    }
    let ancestor: T.Object3D | null = o;
    while (ancestor && ancestor !== root) ancestor = ancestor.parent;
    if (!ancestor) continue;
    if (o.userData.loading) loading++;
    if (o.userData.loadFailed) failed++;
    if (
      o.userData.mixer &&
      active < 24 &&
      o.getWorldPosition(position).distanceToSquared(observer) < 120 * 120
    ) {
      o.userData.mixer.update(Math.min(0.1, dt));
      active++;
    }
  }
  return { loading, failed, active };
}
const position = new T.Vector3();
