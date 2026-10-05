// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player } from './types.ts';
import { terrainHeight, mapHalf } from './terrain.ts';
import { travelHeight } from './dock.ts';
export const crowClasses = {
  scout: { name: 'Scout', speed: 1.3, integrity: 18000, weapons: [] as string[] },
  interceptor: { name: 'Interceptor', speed: 1, integrity: 30000, weapons: ['machine', 'plasma'] },
  bomber: { name: 'Bomber', speed: 0.8, integrity: 24000, weapons: ['grenade', 'rocket'] },
};
export type CrowClass = keyof typeof crowClasses;
export function returnCrow(w: World, p: Player) {
  if (!p.crowBody) return;
  Object.assign(p, p.crowBody);
  p.y = travelHeight(w, p.x, p.z);
  p.speed = 0;
  delete p.crowBody;
  delete p.crowClass;
  delete p.crowMark;
  delete p.crowIntegrity;
}
export function crowAbility(w: World, p: Player, operation: string) {
  if (!w.settings.crowAbilities || !w.settings.fighting || !p.crowBody || p.game)
    throw Error('Advanced robocrows require an enabled combat world, outside team matches');
  if (operation === 'mark') {
    p.crowMark = { x: p.x, y: p.y, z: p.z };
    return 'Robocrow point marked.';
  }
  if (operation !== 'recall') throw Error('Choose mark or recall');
  if (!p.crowMark) throw Error('Mark a point first');
  if ((p.crowRecallAt ?? 0) > w.time) throw Error('Recall cooling down');
  if (p.energy < 25000) throw Error('Recall needs 25,000 energy');
  const point = p.crowMark;
  if (Math.abs(point.x) > mapHalf(w) - 5 || Math.abs(point.z) > mapHalf(w) - 5)
    throw Error('Invalid recall point');
  p.energy -= 25000;
  p.crowRecallAt = w.time + 10;
  p.x = point.x;
  p.z = point.z;
  p.y = Math.max(point.y, terrainHeight(w, p.x, p.z) + 12);
  p.speed = 0;
  return 'Robocrow recalled to its mark.';
}
