// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';

/** More transmission looking down, more reflection at grazing angles. This keeps
 * near-surface gear readable without making the horizon or whole ocean transparent. */
export function seaMaterial() {
  const material = new T.MeshStandardMaterial({
    color: '#439ea7',
    roughness: 0.22,
    metalness: 0.2,
    transparent: true,
    opacity: 1,
  });
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `
      float seaGrazing = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));
      diffuseColor.a *= mix(0.55, 0.96, pow(seaGrazing, 2.0));
      #include <opaque_fragment>
    `,
    );
  };
  material.customProgramCacheKey = () => 'sea-view-angle-v1';
  return material;
}
