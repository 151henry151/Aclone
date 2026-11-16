// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { createServer } from 'vite';

test('removing a mesh while shaders compile completes warmup without a stale program error', async ({
  page,
}) => {
  const server = await createServer({
    server: { host: '127.0.0.1', port: 0, hmr: false },
    logLevel: 'silent',
  });
  await server.listen();
  const port = (server.httpServer!.address() as { port: number }).port;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.route(`http://127.0.0.1:${port}/`, (route) =>
      route.fulfill({ contentType: 'text/html', body: '<main></main>' }),
    );
    await page.goto(`http://127.0.0.1:${port}/`);
    const result = await page.evaluate(async () => {
      const { THREE: T } = await import('/tests/browser/fixtures/three.ts' as string);
      const { compileSceneSteps } = await import('/src/client/renderer-warmup.ts' as string);
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2')!;
      const getExtension = gl.getExtension.bind(gl);
      // SwiftShader lacks this optional extension. Emulate only its readiness
      // flag so both backends exercise the same asynchronous disposal race with
      // real compiled WebGL programs, rather than skipping the regression.
      const extension = getExtension('KHR_parallel_shader_compile') ?? {
        COMPLETION_STATUS_KHR: 0x91b1,
      };
      gl.getExtension = ((name: string) =>
        name === 'KHR_parallel_shader_compile'
          ? extension
          : getExtension(name)) as typeof gl.getExtension;
      const renderer = new T.WebGLRenderer({ canvas, context: gl });
      const scene = new T.Scene();
      const camera = new T.PerspectiveCamera();
      const material = new T.MeshStandardMaterial();
      const mesh = new T.Mesh(new T.BoxGeometry(), material);
      scene.add(mesh);
      scene.add(new T.HemisphereLight());
      const getParameter = gl.getProgramParameter.bind(gl);
      let ready = false;
      gl.getProgramParameter = (program: WebGLProgram, parameter: number) =>
        parameter === extension.COMPLETION_STATUS_KHR ? ready : getParameter(program, parameter);
      let disposed = 0;
      material.addEventListener('dispose', () => disposed++);
      const job = compileSceneSteps(renderer, mesh, camera, scene);
      const step = job.next();
      if (step.done || !step.value) throw Error('The mesh must actually enter shader compilation');
      const pending = step.value;
      scene.remove(mesh);
      material.dispose();
      ready = true;
      const completed = await Promise.race([
        Promise.resolve(pending).then(() => true),
        new Promise((resolve) => setTimeout(() => resolve(false), 1000)),
      ]);
      job.return();
      gl.getProgramParameter = getParameter;
      mesh.geometry.dispose();
      renderer.dispose();
      return { completed, disposed };
    });
    expect(errors).toEqual([]);
    expect(result).toEqual({ completed: true, disposed: 1 });
  } finally {
    await page.close();
    await server.close();
  }
});
