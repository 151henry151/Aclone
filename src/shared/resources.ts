import defaults from '../../data/settings.json';
import { gatheringRules } from './gathering-rules';
import { recordGathered } from './player-statistics.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player, Settings } from './types.ts';
import { canCarry, distance, terrainHeight } from './simulation.ts';
import { legacyHalf, mapHalf, terrainSeed, woodland } from './terrain.ts';
import { hash2 } from './noise.ts';
import { townRefusal } from './town-charter.ts';
export interface ResourceNode {
  id: string;
  item: string;
  name: string;
  x: number;
  z: number;
  capacity: number;
  regrowth: number;
}
/** Surveyed public gathering grounds; shared stable IDs make depletion survive restarts. */
export const gatheringSites: Record<string, [number, number][]> = {
  logs: [
    [-204, -74],
    [-224, -118],
    [-179, -136],
    [-164, -194],
    [-216, -205],
    [-125, -199],
  ],
  stone: [
    [221, -170],
    [156, -200],
    [100, -174],
    [201, -45],
    [206, 20],
    [183, 38],
  ],
  gravel: [
    [-221, 125],
    [-184, 101],
    [-217, 4],
    [185, 104],
    [225, 84],
    [230, -83],
  ],
  dirt: [
    [-145, 126],
    [-150, -53],
    [-78, -224],
    [66, -229],
    [151, -151],
    [171, 61],
  ],
};
const names: Record<string, string> = {
  logs: 'Woodland clearing',
  stone: 'Stone outcrop',
  gravel: 'Gravel hollow',
  dirt: 'Exposed topsoil',
};
/** One reusable implement per ground. Workshop tools are for furniture, not digging. */
export const gatheringImplements: Record<string, { item: string; need: string }> = {
  logs: { item: 'chainsaw', need: 'a chainsaw' },
  stone: { item: 'pickaxe', need: 'a pickaxe' },
  gravel: { item: 'shovel', need: 'a shovel' },
  dirt: { item: 'shovel', need: 'a shovel' },
};
export const resourceNode = (id: string, item: string, x: number, z: number): ResourceNode => ({
  id,
  item,
  name: names[item],
  x,
  z,
  capacity: item === 'logs' ? defaults.resourceLogsCapacity : defaults.resourceOtherCapacity,
  regrowth:
    item === 'logs' ? defaults.resourceLogsRegrowthSeconds : defaults.resourceOtherRegrowthSeconds,
});
export const resourceNodes: ResourceNode[] = Object.entries(gatheringSites).flatMap(
  ([item, positions]) =>
    // Retain existing depletion/task/NPC IDs when relocating the old town grids.
    positions.map(([x, z], i) => resourceNode(`${item}-${i}`, item, x, z)),
);
/** Countryside patches on a 400 m lattice. Stable IDs are derived from the lattice
 * cell, so depletion, tasks and NPC plans survive restarts without storing positions. */
const patchCell = 400;
function countrysidePatches(w: World): ResourceNode[] {
  const half = mapHalf(w);
  if (half <= legacyHalf) return [];
  const seed = terrainSeed(w) ^ 0x5bd1e995,
    cells = Math.ceil(half / patchCell),
    out: ResourceNode[] = [];
  for (let cz = -cells; cz < cells; cz++)
    for (let cx = -cells; cx < cells; cx++) {
      if (hash2(cx, cz, seed) > 0.42) continue;
      const x = (cx + 0.5) * patchCell + (hash2(cx, cz, seed + 1) - 0.5) * 240,
        z = (cz + 0.5) * patchCell + (hash2(cx, cz, seed + 2) - 0.5) * 240;
      if (Math.abs(x) >= half - 40 || Math.abs(z) >= half - 40) continue;
      if (Math.max(Math.abs(x), Math.abs(z)) < 320) continue;
      const h = terrainHeight(w, x, z);
      if (h <= w.settings.seaLevel + 1.5) continue;
      const pick = hash2(cx, cz, seed + 3);
      const item =
        woodland(w, x, z) > 0.45
          ? 'logs'
          : h > 16
            ? pick < 0.6
              ? 'stone'
              : 'gravel'
            : pick < 0.5
              ? 'dirt'
              : 'gravel';
      out.push(
        resourceNode(`${item}-c${cx + cells}-${cz + cells}`, item, Math.round(x), Math.round(z)),
      );
    }
  return out;
}
const resourceCache = new WeakMap<
  World,
  { key: string; additions?: ResourceNode[]; northern?: ResourceNode[]; nodes: ResourceNode[] }
>();
/** Every gathering ground: original village sites, countryside patches and saved additions. */
export function worldResources(w: World): ResourceNode[] {
  const key = `${w.id}:${mapHalf(w)}:${w.settings.seaLevel}:${w.landscape?.heightmap?.length ?? 0}:${w.terrain.length}:${w.additionalResources?.length ?? 0}:${JSON.stringify(w.resourceRelocations ?? {})}`;
  const cached = resourceCache.get(w);
  if (
    cached?.key === key &&
    cached.additions === w.additionalResources &&
    cached.northern === w.northernIsland?.resources
  )
    return cached.nodes;
  const base = w.northernIsland?.resources ?? [...resourceNodes, ...countrysidePatches(w)];
  const merged = new Map(base.map((n) => [n.id, n]));
  for (const n of w.additionalResources ?? []) merged.set(n.id, n);
  const nodes = [...merged.values()].map((n) =>
    w.resourceRelocations?.[n.id] ? { ...n, ...w.resourceRelocations[n.id] } : n,
  );
  resourceCache.set(w, {
    key,
    additions: w.additionalResources,
    northern: w.northernIsland?.resources,
    nodes,
  });
  return nodes;
}
/** Standard survey fields inherit world rules; authored non-default fields remain overrides.
 * Keep raw node records stable so frozen geography never captures a transient rule value. */
export function resourceLimits(w: Pick<World, 'settings'>, n: ResourceNode) {
  const rules = gatheringRules(w.settings),
    logs = n.item === 'logs';
  const baseCapacity = logs ? defaults.resourceLogsCapacity : defaults.resourceOtherCapacity;
  const baseRegrowth = logs
    ? defaults.resourceLogsRegrowthSeconds
    : defaults.resourceOtherRegrowthSeconds;
  return {
    capacity:
      n.capacity === baseCapacity
        ? logs
          ? rules.resourceLogsCapacity
          : rules.resourceOtherCapacity
        : n.capacity,
    regrowth:
      n.regrowth === baseRegrowth
        ? logs
          ? rules.resourceLogsRegrowthSeconds
          : rules.resourceOtherRegrowthSeconds
        : n.regrowth,
  };
}
export function resourceRecoverySeconds(w: Pick<World, 'settings'>, n: ResourceNode) {
  const value = w.settings.resourceRecoveryMultiplier ?? defaults.resourceRecoveryMultiplier;
  return (
    resourceLimits(w, n).regrowth *
    Math.max(
      0.25,
      Math.min(24, Number.isFinite(value) ? value : defaults.resourceRecoveryMultiplier),
    )
  );
}
export function resourceAmount(w: World, n: ResourceNode) {
  const saved = w.resources?.[n.id],
    { capacity } = resourceLimits(w, n);
  return saved
    ? Math.min(
        capacity,
        saved.amount +
          Math.floor(Math.max(0, w.time - saved.updated) / resourceRecoverySeconds(w, n)) * 3,
      )
    : capacity;
}
const depositKeys = [
  'resourceLogsCapacity',
  'resourceOtherCapacity',
  'resourceLogsRegrowthSeconds',
  'resourceOtherRegrowthSeconds',
  'resourceRecoveryMultiplier',
] as const;
/** Settle the old pace once, preserving earned stock and fractional recovery under new rules. */
export function changeResourceRules(w: World, patch: Partial<Settings>) {
  const changes = Object.fromEntries(
    depositKeys
      .filter((k) => patch[k] !== undefined && patch[k] !== (w.settings[k] ?? defaults[k]))
      .map((k) => [k, patch[k]]),
  );
  if (!Object.keys(changes).length) return;
  const next = { settings: { ...w.settings, ...changes } };
  for (const n of worldResources(w)) {
    const saved = w.resources?.[n.id],
      oldCapacity = resourceLimits(w, n).capacity,
      capacity = resourceLimits(next, n).capacity;
    if (!saved && capacity <= oldCapacity) continue;
    const period = resourceRecoverySeconds(w, n),
      elapsed = saved ? Math.max(0, w.time - saved.updated) : 0;
    const earned = resourceAmount(w, n),
      amount = Math.min(capacity, earned);
    const fraction = earned >= oldCapacity || amount >= capacity ? 0 : (elapsed % period) / period;
    w.resources ??= {};
    w.resources[n.id] = { amount, updated: w.time - fraction * resourceRecoverySeconds(next, n) };
  }
  Object.assign(w.settings, changes);
}
/** Backwards-compatible multiplier entry point; use the same atomic transition. */
export function changeResourceRecovery(w: World, multiplier: number) {
  changeResourceRules(w, { resourceRecoveryMultiplier: multiplier });
}
/** Skill selects both rate components independently of the configured load amount. */
export function gatheringRate(w: World, p: Pick<Player, 'skills'>, item: string) {
  const rules = gatheringRules(w.settings),
    skilled = p.skills.includes(item === 'logs' ? 'forester' : 'excavator');
  return {
    amount: skilled ? rules.gatheringSkilledYield : rules.gatheringBaseYield,
    seconds: skilled ? rules.gatheringSkilledSeconds : rules.gatheringBaseSeconds,
  };
}
/** Read-only eligibility shared by the HUD and authoritative gathering action. */
export function gatheringStatus(w: World, p: Player, n: ResourceNode) {
  const { amount, seconds } = gatheringRate(w, p, n.item);
  const available = resourceAmount(w, n);
  let reason: string | undefined;
  if (distance(p, n) > 10 || Math.abs(p.y - terrainHeight(w, p.x, p.z)) > 3)
    reason = 'Move close to a marked gathering ground';
  else if (p.task || p.atHome || p.game || p.hitch || p.crowBody)
    reason = 'Finish your activity first';
  else if (w.buildings.some((b) => distance(b, n) < 12))
    reason = 'Buildings obstruct this gathering ground';
  else if (townRefusal(w, p.id, n.x, n.z, 'environment'))
    reason = townRefusal(w, p.id, n.x, n.z, 'environment');
  else if (gatheringImplements[n.item] && !(p.inventory[gatheringImplements[n.item].item] > 0))
    reason = `Carry ${gatheringImplements[n.item].need} to gather ${n.item === 'dirt' ? 'topsoil' : n.item}`;
  else if (available < amount) reason = 'This ground needs time to replenish';
  else if (!canCarry(p, n.item, amount, w)) reason = 'Make room in your cargo';
  return { amount, available, seconds, capacity: resourceLimits(w, n).capacity, reason };
}
export function gather(w: World, p: Player, id: string) {
  const n = worldResources(w).find((n) => n.id === id);
  if (!n) throw Error('Move close to a marked gathering ground');
  const { amount, available, seconds, reason } = gatheringStatus(w, p, n);
  if (reason) throw Error(reason);
  w.resources ??= {};
  w.resources[n.id] = { amount: available - amount, updated: w.time };
  p.task = {
    kind: 'gather',
    resource: n.id,
    item: n.item,
    amount,
    end: w.time + seconds,
  };
  p.speed = 0;
}
export function finishGather(p: Player, w?: World) {
  const t = p.task!;
  if (!t.item || !t.amount || !canCarry(p, t.item, t.amount, w)) {
    if (w) cancelGather(w, p);
    else delete p.task;
    return false;
  }
  p.inventory[t.item] = (p.inventory[t.item] ?? 0) + t.amount;
  if (w) recordGathered(w, p, t.item, t.amount);
  delete p.task;
  return true;
}

/** Cancel an unfinished load and return its reserved resources exactly once. */
export function cancelGather(w: World, p: Player) {
  const task = p.task;
  if (task?.kind !== 'gather') return;
  delete p.task;
  const n = worldResources(w).find((n) => n.id === task.resource);
  if (n && task.amount && w.resources)
    w.resources[n.id] = {
      amount: Math.min(resourceLimits(w, n).capacity, resourceAmount(w, n) + task.amount),
      updated: w.time,
    };
}
