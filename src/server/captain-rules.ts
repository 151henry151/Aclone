// SPDX-License-Identifier: GPL-3.0-or-later
import { needsCaptain } from '../shared/captain';
import { isPublicPuddlewick } from '../shared/harbour-supply';
import { say } from '../shared/messages';
import type { Player, World } from '../shared/types';

function foldBoatmaster(p: Player) {
  let changed = false;
  if (p.skills.includes('boatmaster')) {
    p.skills = [...new Set(p.skills.map((skill) => (skill === 'boatmaster' ? 'captain' : skill)))];
    changed = true;
  }
  if (p.learning?.skill === 'boatmaster') {
    p.learning.skill = 'captain';
    changed = true;
  }
  return changed;
}

function ownsLargeBoat(w: World, p: Player) {
  const slots = new Set(p.fleet ?? []);
  slots.add(p.vehicle);
  for (const boat of Object.values(w.mooredBoats ?? {}))
    if (boat.owner === p.id) slots.add(boat.slot);
  const rescue = w.boatRescues?.[p.id];
  if (rescue) slots.add(rescue.boat.slot);
  return [...slots].some((slot) => needsCaptain(w, slot));
}

/** New worlds already carry the setting. Public Puddlewick turns it on once
 * and qualifies people who already own a larger boat. Every world renames
 * boatmaster to captain once. Later owner edits are kept. */
export function prepareCaptainRules(w: World) {
  let changed = false;
  if (w.settings.requireCaptainSkill === undefined) {
    w.settings.requireCaptainSkill = isPublicPuddlewick(w);
    changed = true;
  }
  if (w.captainRulesVersion) return changed;
  for (const p of Object.values(w.players)) {
    if (foldBoatmaster(p)) changed = true;
    if (w.settings.requireCaptainSkill && ownsLargeBoat(w, p) && !p.skills.includes('captain')) {
      p.skills.push('captain');
      say(w, 'School', `${p.name} is qualified as captain, having already owned a larger boat.`);
      changed = true;
    }
  }
  w.captainRulesVersion = 1;
  w.revision++;
  return true;
}
