// SPDX-License-Identifier: GPL-3.0-or-later
import type { Material } from 'three';

const decorated = new WeakMap<Material, { value: number }>();

/** Ordinary fog only recolours opaque geometry. Small scenery then remains a
 * silhouette against the directional sky, even beyond visibility range. Fade
 * its coverage in the last part of the fog instead. Screen-door coverage keeps
 * instanced trees opaque/depth-writing, with no sorting or extra draw calls. */
export function fadeSceneryIntoFog(material: Material, range?: number) {
  const existing = decorated.get(material);
  if (existing) {
    if (range !== undefined) existing.value = range;
    return;
  }
  const distance = { value: range ?? 1e20 };
  decorated.set(material, distance);
  const previous = material.onBeforeCompile;
  const key = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    shader.uniforms.sceneryRange = distance;
    shader.vertexShader =
      'varying float vSceneryDistance;\n' +
      shader.vertexShader.replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvSceneryDistance=length(mvPosition.xyz);',
      );
    shader.fragmentShader =
      'varying float vSceneryDistance;uniform float sceneryRange;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <fog_fragment>',
      `#include <fog_fragment>
      #ifdef USE_FOG
        float sceneryCoverage = 1.0 - smoothstep(0.6, 1.0, fogFactor);
        sceneryCoverage *= 1.0-smoothstep(sceneryRange*.6,sceneryRange,vSceneryDistance);
        // A bounded threshold avoids lingering pixels when coverage reaches zero.
        float sceneryThreshold = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        if (sceneryCoverage <= sceneryThreshold) discard;
      #endif`,
    );
  };
  material.customProgramCacheKey = () => `${key}:scenery-fog-v2`;
}
