import { repairRecipientReady } from '../shared/vehicle-services.ts';
import { productionReport } from '../shared/reports.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import { refuelRecipientReady } from '../shared/player-aid.ts';
import {
  motorRunning,
  productionActivity,
  craftingBuildings,
  productionEfficiency,
} from '../shared/sound-state';
import type { World, Player } from '../shared/types';
import type { Account } from './universe';
import {
  diffFields,
  serializeFields,
  type SerializedFields,
  type FieldPatch,
} from '../shared/state-patch';
export function publicBuildings(w: World) {
  const crafting = craftingBuildings(w);
  return w.buildings.map((building) => {
    const { accounts: _privateAccounts, ...publicBuilding } = building;
    const b = {
      ...publicBuilding,
      productionStatus: productionReport(w, building),
      ownerName: building.owner ? w.players[building.owner]?.name : undefined,
      operating: productionActivity(w, building, crafting),
      efficiency:
        building.kind !== 'farm' && (building.production || building.recipe)
          ? productionEfficiency(w, building)
          : building.efficiency,
    };
    return b.lodging
      ? {
          ...b,
          lodging: {
            ...b.lodging,
            guests: Object.fromEntries(
              Object.entries(b.lodging.guests).map(([id, g]) => [
                id,
                { until: g.until, stock: {} },
              ]),
            ),
          },
        }
      : b;
  });
}
export function privatePlayer(w: World, p: Player) {
  return {
    ...p,
    departure: undefined,
    statements: Object.fromEntries(
      w.buildings
        .filter((b) => b.owner === p.id || p.authority >= 20)
        .filter((b) => b.accounts)
        .map((b) => [b.id, b.accounts]),
    ),
    engineRunning: motorRunning(w, p),
    roomPantries: Object.fromEntries(
      w.buildings
        .filter((b) => b.lodging?.guests[p.id])
        .map((b) => [b.id, b.lodging!.guests[p.id].stock]),
    ),
  };
}
export interface Frame {
  fields: Record<string, string>;
  players: Record<string, string>;
  buildings: Record<string, SerializedFields>;
  buildingOrder: string;
  playerFields: Record<string, SerializedFields>;
  compact?: WeakMap<Frame, { world: string[]; entities: string; order?: string }>;
}
/** Serialize shared world data once per broadcast, rather than once per recipient. */
export function prepareFrame(w: World): Frame {
  const { players, ledger, script, scriptVariables, messages, landscapeHistory, ...common } = w;
  common.landscapeUndo = !!landscapeHistory?.length;
  common.buildings = publicBuildings(w);
  common.scriptInteraction = w.script.includes('ObjectInteract');
  const fields = Object.fromEntries(
    Object.entries(common).map(([key, value]) => [key, JSON.stringify(value)]),
  );
  const publicPlayers: Record<string, string> = {};
  for (const p of Object.values(players))
    if (p.online)
      publicPlayers[p.id] = JSON.stringify({
        id: p.id,
        name: p.name,
        npc: p.npc,
        x: +p.x.toFixed(2),
        y: +p.y.toFixed(2),
        z: +p.z.toFixed(2),
        heading: +p.heading.toFixed(3),
        speed: +p.speed.toFixed(2),
        vehicle: p.vehicle,
        canReceiveFuel: refuelRecipientReady(p),
        canReceiveRepair: repairRecipientReady(p),
        tractorPaint: p.tractorPaint,
        atHome: p.atHome,
        lights: p.lights,
        engineRunning: motorRunning(w, p),
        team: p.team,
        game: p.game,
        health: p.health,
        kudos: p.kudos,
        online: p.online,
        kills: p.kills,
        age: Math.floor(p.age),
        lastHorn: p.lastHorn,
      });
  return {
    fields,
    players: publicPlayers,
    buildings: Object.fromEntries(common.buildings.map((b) => [b.id, serializeFields(b)])),
    buildingOrder: JSON.stringify(common.buildings.map((b) => b.id)),
    playerFields: Object.fromEntries(
      Object.entries(publicPlayers).map(([id, value]) => [id, serializeFields(JSON.parse(value))]),
    ),
  };
}
export class DeltaStream {
  private previous?: Frame;
  private privateFields: Record<string, string> = {};
  private selfFields: SerializedFields = {};
  private accountJson?: string;
  constructor(private compact = false) {}
  encode(w: World, account: Account, frame: Frame) {
    if (this.compact) return this.encodeCompact(w, account, frame);
    const fields: string[] = [],
      changed: string[] = [];
    for (const [key, value] of Object.entries(frame.fields))
      if (this.previous?.fields[key] !== value) fields.push(JSON.stringify(key) + ':' + value);
    for (const [id, value] of Object.entries(frame.players))
      if (this.previous?.players[id] !== value) changed.push(JSON.stringify(id) + ':' + value);
    for (const id of Object.keys(this.previous?.players ?? {}))
      if (!frame.players[id]) changed.push(JSON.stringify(id) + ':null');
    fields.push('"players":{' + changed.join(',') + '}');
    const me = w.players[account.id];
    fields.push(
      '"messages":' +
        JSON.stringify(w.messages.filter((m) => !m.to || m.to === me.id || m.name === me.name)),
    );
    fields.push('"ledger":' + JSON.stringify(me.authority >= 20 ? w.ledger.slice(-30) : []));
    fields.push('"script":' + JSON.stringify(me.authority >= 20 ? w.script : ''));
    fields.push('"scriptVariables":{}');
    const result =
      '{"type":"state","partial":' +
      !!this.previous +
      ',"world":{' +
      fields.join(',') +
      '},"me":' +
      JSON.stringify(me.id) +
      ',"self":' +
      JSON.stringify(privatePlayer(w, me)) +
      ',"account":' +
      JSON.stringify(account) +
      '}';
    this.previous = frame;
    return result;
  }
  private encodeCompact(w: World, account: Account, frame: Frame) {
    const me = w.players[account.id];
    const privateFields = serializeFields({
      messages: w.messages.filter((m) => !m.to || m.to === me.id || m.name === me.name),
      ledger: me.authority >= 20 ? w.ledger.slice(-30) : [],
      script: me.authority >= 20 ? w.script : '',
      scriptVariables: {},
    });
    const fields: string[] = [];
    const tail: string[] = [];
    if (!this.previous) {
      for (const [key, value] of Object.entries(frame.fields))
        fields.push(JSON.stringify(key) + ':' + value);
      fields.push(
        '"players":{' +
          Object.entries(frame.players)
            .map(([id, value]) => JSON.stringify(id) + ':' + value)
            .join(',') +
          '}',
      );
    } else {
      // All recipients on the same baseline share this work. A slow recipient can
      // have an older baseline; weak keys don't retain a chain of past frames.
      frame.compact ??= new WeakMap();
      let shared = frame.compact.get(this.previous);
      if (!shared) {
        const entities = (
          before: Record<string, SerializedFields>,
          after: Record<string, SerializedFields>,
        ) => {
          const changes: Record<string, FieldPatch | null> = {};
          for (const [id, value] of Object.entries(after)) {
            const patch = diffFields(before[id] ?? {}, value);
            if (patch) changes[id] = patch;
          }
          for (const id of Object.keys(before)) if (!after[id]) changes[id] = null;
          return changes;
        };
        const order = frame.buildingOrder;
        shared = {
          world: Object.entries(frame.fields)
            .filter(([key, value]) => key !== 'buildings' && this.previous!.fields[key] !== value)
            .map(([key, value]) => JSON.stringify(key) + ':' + value),
          entities: JSON.stringify({
            buildings: entities(this.previous.buildings, frame.buildings),
            players: entities(this.previous.playerFields, frame.playerFields),
          }),
          order: order === this.previous.buildingOrder ? undefined : order,
        };
        frame.compact.set(this.previous, shared);
      }
      fields.push(...shared.world);
      tail.push('"entities":' + shared.entities);
      if (shared.order) tail.push('"buildingOrder":' + shared.order);
    }
    for (const [key, value] of Object.entries(privateFields))
      if (this.privateFields[key] !== value) fields.push(JSON.stringify(key) + ':' + value);
    const self = privatePlayer(w, me),
      selfFields = serializeFields(self);
    if (!this.previous) tail.push('"self":' + JSON.stringify(self));
    else {
      const patch = diffFields(this.selfFields, selfFields);
      if (patch) tail.push('"selfPatch":' + JSON.stringify(patch));
    }
    const accountJson = JSON.stringify(account);
    if (this.accountJson !== accountJson) tail.push('"account":' + accountJson);
    const result =
      '{"type":"state","partial":' +
      !!this.previous +
      ',"me":' +
      JSON.stringify(me.id) +
      ',"world":{' +
      fields.join(',') +
      '}' +
      (tail.length ? ',' + tail.join(',') : '') +
      '}';
    this.previous = frame;
    this.privateFields = privateFields;
    this.selfFields = selfFields;
    this.accountJson = accountJson;
    return result;
  }
}
