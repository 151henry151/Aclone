// SPDX-License-Identifier: GPL-3.0-or-later
import { alpineRules } from '../shared/alpine-rules';
import type { World } from '../shared/types';
type AlpineWorld = Pick<World, 'settings' | 'northernIsland'>;
export function alpineSnowUniforms(w: AlpineWorld) {
  const uniforms = {
    alpineEnabled: { value: 0 },
    alpineSnowStart: { value: 0 },
    alpineSnowFull: { value: 0 },
  };
  updateAlpineSnow(uniforms, w);
  return uniforms;
}
export function updateAlpineSnow(uniforms: ReturnType<typeof alpineSnowUniforms>, w: AlpineWorld) {
  const rules = alpineRules(w.settings);
  uniforms.alpineEnabled.value = w.northernIsland && rules.alpinePermanentSnow ? 1 : 0;
  uniforms.alpineSnowStart.value = rules.alpineSnowStart;
  uniforms.alpineSnowFull.value = rules.alpineSnowFull;
}
