// SPDX-License-Identifier: GPL-3.0-or-later
import { motorRunning, productionActivity, craftingBuildings } from '../shared/sound-state';
import type { World, Player } from '../shared/types';
import type { Account } from './universe';
export function publicBuildings(w: World) {
  const crafting = craftingBuildings(w);
  return w.buildings.map((building) => {
    const b = { ...building, operating: productionActivity(w, building, crafting) };
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
}
/** Serialize shared world data once per broadcast, rather than once per recipient. */
export function prepareFrame(w: World): Frame {
  const { players, ledger, script, scriptVariables, messages, ...common } = w;
  common.buildings = publicBuildings(w);
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
  return { fields, players: publicPlayers };
}
export class DeltaStream {
  private previous?: Frame;
  encode(w: World, account: Account, frame: Frame) {
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
}
