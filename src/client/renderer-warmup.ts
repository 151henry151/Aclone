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
