// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
/** Yield between uploads so the loading UI remains responsive. Shared textures upload once. */
export function sceneTextures(scene: T.Object3D) {
  const textures = new Set<T.Texture>();
  scene.traverse((object) => {
    const material = (object as T.Mesh).material;
    for (const mat of material ? (Array.isArray(material) ? material : [material]) : []) {
      for (const value of Object.values(mat)) if (value instanceof T.Texture) textures.add(value);
      for (const value of (mat.userData.warmTextures ?? []) as T.Texture[]) textures.add(value);
      if (mat instanceof T.ShaderMaterial)
        for (const uniform of Object.values(mat.uniforms))
          if (uniform.value instanceof T.Texture) textures.add(uniform.value);
    }
  });
  return [...textures].filter(
    (t) =>
      t.image &&
      (typeof HTMLImageElement === 'undefined' ||
        !(t.image instanceof HTMLImageElement) ||
        t.image.complete),
  );
}
export const yieldFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
export async function uploadTextures(
  textures: T.Texture[],
  upload: (t: T.Texture) => void,
  current: () => boolean,
  progress: (done: number, total: number) => void,
  yieldTask = yieldFrame,
) {
  for (let i = 0; i < textures.length; i++) {
    if (!current()) return false;
    progress(i, textures.length);
    upload(textures[i]);
    await yieldTask();
  }
  return current();
}

/** Wait without blocking the main thread for the driver's first-use work to finish. */
export async function finishGpuWork(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  current: () => boolean,
) {
  if (!('fenceSync' in gl)) {
    await yieldFrame();
    return current();
  }
  const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  if (!fence) throw Error('Could not prepare the graphics context');
  gl.flush();
  const deadline = performance.now() + 30000;
  try {
    while (current()) {
      const state = gl.clientWaitSync(fence, 0, 0);
      if (state === gl.ALREADY_SIGNALED || state === gl.CONDITION_SATISFIED) return true;
      if (state === gl.WAIT_FAILED || gl.isContextLost())
        throw Error('Graphics context was interrupted');
      if (performance.now() > deadline) throw Error('Graphics preparation timed out');
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
    }
    return false;
  } finally {
    gl.deleteSync(fence);
  }
}

/** Upload one geometry per yield into a private pixel, leaving the visible scene intact.
 * Three uploads all attributes when a mesh is submitted, even with this simple material. */
export function* uploadGeometrySteps(
  renderer: Pick<T.WebGLRenderer, 'getRenderTarget' | 'setRenderTarget' | 'render'>,
  root: T.Object3D,
  camera: T.Camera,
): Generator<void> {
  const scene = new T.Scene(),
    target = new T.WebGLRenderTarget(1, 1);
  const material = new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const meshes: T.Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof T.Mesh && o.visible) meshes.push(o);
  });
  const seen = new Set<T.BufferGeometry>();
  try {
    for (const source of meshes) {
      if (seen.has(source.geometry)) continue;
      seen.add(source.geometry);
      if (!source.geometry.boundingSphere) source.geometry.computeBoundingSphere();
      const proxy = new T.Mesh(source.geometry, material);
      proxy.frustumCulled = false;
      scene.add(proxy);
      const previous = renderer.getRenderTarget();
      try {
        renderer.setRenderTarget(target);
        renderer.render(scene, camera);
      } finally {
        renderer.setRenderTarget(previous);
        scene.remove(proxy);
      }
      yield;
    }
  } finally {
    target.dispose();
    material.dispose();
  }
}

/** compileAsync still visits/initializes every material synchronously before its
 * promise. Yield between objects while retaining the real object/shader variant. */
export function* compileSceneSteps(
  renderer: {
    compileAsync: (object: T.Object3D, camera: T.Camera, target: T.Scene) => Promise<unknown>;
  },
  root: T.Object3D,
  camera: T.Camera,
  target: T.Scene,
): Generator<Promise<unknown>> {
  const objects: T.Object3D[] = [];
  root.traverse((object) => {
    if (
      object instanceof T.Mesh ||
      object instanceof T.Line ||
      object instanceof T.Points ||
      object instanceof T.Sprite
    )
      objects.push(object);
  });
  for (const object of objects) yield renderer.compileAsync(object, camera, target);
}
