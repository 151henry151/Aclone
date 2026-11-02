// SPDX-License-Identifier: GPL-3.0-or-later
import { MOTORBOAT } from './boats';
import { vehicleDef } from './vehicle-config';
import { requiredLicence } from './vehicle-services';
import type { World } from './types';

/** Larger than the outboard motorboat. A tuning flag can force or waive it. */
export function needsCaptain(w: World, slot: number) {
  if (w.settings.requireCaptainSkill !== true) return false;
  const def = vehicleDef(w, slot);
  if (def.requiresCaptain === false) return false;
  if (def.requiresCaptain === true) return def.mode === 3 || def.mode === 5;
  if (def.mode !== 3 && def.mode !== 5) return false;
  const limit = vehicleDef(w, MOTORBOAT).length ?? 4.3;
  return (def.length ?? 0) > limit;
}

export function helmQualification(w: World, slot: number) {
  return requiredLicence(w, slot) ?? (needsCaptain(w, slot) ? 'captain' : undefined);
}

export function helmBlock(w: World, slot: number, skills: readonly string[]) {
  const skill = helmQualification(w, slot);
  if (!skill || skills.includes(skill)) return;
  return skill === 'captain'
    ? 'Learn captain at the school before helming this boat'
    : `Learn ${skill} at school to drive this vehicle`;
}
