// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player, Action } from './types';
import { canoeRules } from './canoe-rules';
import { worldItems } from './world-catalogue';
import { canCarry, log, nearby } from './simulation';
import { terrainHeight, mapHalf } from './terrain';
import { surfaceWaterLevel } from './ocean';
import { blocksBuilding } from './building-shapes';
import { creatorBlocks } from './creator';

export interface SmallCraft {
  id: string;
  kind: 'canoe';
  owner: string;
  state: 'carried' | 'setDown' | 'launched' | 'moored';
  x: number;
  z: number;
  heading: number;
  paint: string;
}
function need(ok: unknown, message: string): asserts ok {
  if (!ok) throw Error(message);
}
export function canoeAction(w: World, p: Player, a: Action) {
  const rules = canoeRules(w.settings),
    operation = a.operation;
  need(
    (!p.atHome || operation === 'store') &&
      !p.task &&
      !p.hitch &&
      !p.game &&
      !p.crowBody &&
      Math.abs(p.speed) <= rules.canoeStoppedSpeed,
    'Stop outside and finish your activity before handling a canoe',
  );
  need(p.vehicle === 5, 'Walk before handling a canoe');
  const current = p.carrying && w.smallCraft?.[p.carrying];
  const lift = (c?: SmallCraft) => {
    need(!current, 'Set down your carried canoe first');
    need(canCarry(p, 'canoe', 1, w), 'Not enough carry weight for a canoe');
    if (!c) {
      const id = `craft-${(w.smallCraftSeq ?? 0) + 1}`;
      c = {
        id,
        kind: 'canoe',
        owner: p.id,
        state: 'carried',
        x: p.x,
        z: p.z,
        heading: p.heading,
        paint: '#a84e32',
      };
      w.smallCraftSeq = (w.smallCraftSeq ?? 0) + 1;
    }
    c.owner = p.id;
    c.state = 'carried';
    c.x = p.x;
    c.z = p.z;
    c.heading = p.heading;
    (w.smallCraft ??= {})[c.id] = c;
    p.carrying = c.id;
  };
  const building = () => nearby(w, p, a.building);
  if (operation === 'buy' || operation === 'craft') {
    const b = building();
    need(
      b.kind === 'carpenter' || (operation === 'buy' && b.kind === 'boathouse'),
      'Visit a carpenter or boathouse to buy; craft at a carpenter',
    );
    need(!current, 'Set down your carried canoe first');
    const cost = worldItems(w).canoe.price;
    if (operation === 'buy') {
      need(p.cash >= cost, 'Not enough cash');
      lift();
      p.cash -= cost;
      log(w, 'sink', cost, p.id, 'treasury', 'canoe purchase');
    } else {
      need((p.inventory.wood ?? 0) >= rules.canoeWood, 'Bring enough wood to craft a canoe');
      const remaining = { ...p.inventory, wood: p.inventory.wood - rules.canoeWood };
      need(
        canCarry({ ...p, inventory: remaining }, 'canoe', 1, w),
        'Not enough carry weight for the finished canoe',
      );
      const before = p.inventory;
      p.inventory = remaining;
      try {
        lift();
      } catch (e) {
        p.inventory = before;
        throw e;
      }
    }
  } else if (operation === 'carry') {
    need((p.inventory.canoe ?? 0) > 0, 'No canoe in inventory');
    need(!current, 'Set down your carried canoe first');
    p.inventory.canoe--;
    try {
      lift();
    } catch (e) {
      p.inventory.canoe++;
      throw e;
    }
  } else if (operation === 'pickup') {
    const c = w.smallCraft?.[String(a.id)];
    need(c && c.state === 'setDown', 'Choose a set-down canoe');
    need(c.owner === p.id || rules.canoePublicPickup, 'Only the owner may pick up this canoe');
    need(Math.hypot(c.x - p.x, c.z - p.z) <= rules.canoeRange, 'Stand beside the canoe');
    lift(c);
  } else if (operation === 'setDown') {
    need(current, 'No carried canoe');
    const x = p.x + Math.sin(p.heading) * rules.canoeRange,
      z = p.z + Math.cos(p.heading) * rules.canoeRange;
    const y = terrainHeight(w, x, z);
    need(
      Math.max(Math.abs(x), Math.abs(z)) < mapHalf(w) && y > surfaceWaterLevel(w, x, z),
      'Set the canoe down on dry ground',
    );
    need(
      !w.buildings.some((b) => blocksBuilding(b, x, z, 0, 1)) && !creatorBlocks(w, x, z, y, 1),
      'Ground is obstructed',
    );
    Object.assign(current, { state: 'setDown', x, z, heading: p.heading });
    delete p.carrying;
  } else if (operation === 'store' || operation === 'retrieve') {
    const b = building();
    need(b.kind === 'home' && b.owner === p.id, 'Use your own home');
    if (operation === 'store') {
      need(current, 'Carry a canoe to store it');
      need((b.stock.canoe ?? 0) < rules.canoeHomeLimit, 'Home canoe limit is full');
      b.stock.canoe = (b.stock.canoe ?? 0) + 1;
      delete w.smallCraft![current.id];
      delete p.carrying;
    } else {
      need((b.stock.canoe ?? 0) > 0, 'No canoe stored at home');
      lift();
      b.stock.canoe--;
    }
  } else throw Error('Unknown canoe operation');
}
export function canoeDeath(w: World, p: Player) {
  const rules = canoeRules(w.settings);
  for (const [id, c] of Object.entries(w.smallCraft ?? {})) {
    if (c.owner !== p.id) continue;
    if (
      (c.state === 'setDown' && rules.canoeLoseOnLandDeath) ||
      (c.state === 'carried' && w.settings.loseInventoryOnDeath)
    )
      delete w.smallCraft![id];
    else if (c.state === 'carried') {
      c.state = 'setDown';
      c.x = p.x;
      c.z = p.z;
      c.heading = p.heading;
    }
  }
  delete p.carrying;
}
