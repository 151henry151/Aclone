// SPDX-License-Identifier: GPL-3.0-or-later
import type { Player, World, Building } from '../shared/types';
import { applyFields, type FieldPatch } from '../shared/state-patch';
export interface StateMessage {
  type: 'state';
  partial: boolean;
  world: Partial<Omit<World, 'players'>> & { players?: Record<string, Player | null> };
  me: string;
  self?: Player;
  selfPatch?: FieldPatch;
  entities?: {
    buildings: Record<string, FieldPatch | null>;
    players: Record<string, FieldPatch | null>;
  };
  buildingOrder?: string[];
  sequence?: number;
}
/** Pure merge shared by the browser and transport regression tests. */
export function mergeState(previous: World | undefined, message: StateMessage): World {
  if (!message.partial) {
    const world = message.world as World;
    if (message.self) world.players[message.me] = message.self;
    return world;
  }
  if (!previous || (message.world.id && message.world.id !== previous.id))
    throw Error('Partial state without its world baseline');
  const players = { ...previous.players };
  for (const [id, player] of Object.entries(message.world.players ?? {})) {
    if (player) players[id] = player;
    else delete players[id];
  }
  let buildings = message.world.buildings ?? previous.buildings;
  if (message.entities) {
    for (const [id, patch] of Object.entries(message.entities.players)) {
      if (patch) players[id] = applyFields(players[id] ?? ({} as Player), patch);
      else delete players[id];
    }
    if (Object.keys(message.entities.buildings).length || message.buildingOrder) {
      const byId = new Map(buildings.map((b) => [b.id, b]));
      for (const [id, patch] of Object.entries(message.entities.buildings)) {
        if (patch) byId.set(id, applyFields(byId.get(id) ?? ({} as Building), patch));
        else byId.delete(id);
      }
      buildings = message.buildingOrder
        ? message.buildingOrder.map((id) => byId.get(id)!)
        : [...byId.values()];
    }
  }
  // Public rounding must never overwrite the local player's precise private pose or fields.
  if (message.entities) players[message.me] = previous.players[message.me];
  if (message.selfPatch) players[message.me] = applyFields(players[message.me], message.selfPatch);
  if (message.self) players[message.me] = message.self;
  return { ...previous, ...message.world, players, buildings } as World;
}
