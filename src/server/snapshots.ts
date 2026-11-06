import { publicParkedVehicles } from '../shared/parked-vehicles';
import { buildingDoorActivity } from '../shared/building-doors';
import { storedBoatDisplay } from '../shared/stored-boats';
import { ROWBOAT } from '../shared/rowboat-rules';
import { stockWeight } from '../shared/fishing-expedition';
import { vehicleDef } from '../shared/vehicle-config';
import { CANOE } from '../shared/canoe-rules';
import { fuelRules } from '../shared/fuel-rules';
import { strandedVessel } from '../shared/towing';
import { charterOffers } from '../shared/charter';
import { fishingOffers, fishingCrewCaptain, deckhands } from '../shared/fishing-expedition';
import { visibleTrawl } from '../shared/commercial-fishing';
import { vehiclePaint } from '../shared/appearance.ts';
import { families, personalOffers, familyInvites } from '../shared/social.ts';
import { repairRecipientReady } from '../shared/vehicle-services.ts';
import { productionReport } from '../shared/reports.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import { offlineGroundObstacle } from '../shared/ground-contacts';
import { refuelRecipientReady } from '../shared/player-aid.ts';
import {
  motorRunning,
  productionActivity,
  craftingBuildings,
  productionEfficiency,
  productionStaffing,
} from '../shared/sound-state';
import type { World, Player } from '../shared/types';
import { publicTowns, townBallots } from '../shared/civics.ts';
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
      doorActivity: buildingDoorActivity(w, building),
      ...(building.kind === 'boathouse' ? { storedBoats: storedBoatDisplay(w, building) } : {}),
      productionStatus: productionReport(w, building),
      staffing:
        building.kind !== 'farm' && (building.production || building.recipe)
          ? productionStaffing(w, building)
          : undefined,
      employeeNames: Object.fromEntries(
        building.employees.map((id) => [id, w.players[id]?.name ?? id]),
      ),
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
    boatHolds: Object.fromEntries(
      Object.values(w.mooredBoats ?? {})
        .filter((b) => b.owner === p.id && b.cargo)
        .map((b) => [b.slot, b.cargo]),
    ),
    trailerCargo: Object.fromEntries(
      Object.values(w.trailers ?? {})
        .filter((t) => t.owner === p.id)
        .map((t) => [t.id, t.cargo]),
    ),
    crewOffers: fishingOffers(w, p),
    charterOffers: charterOffers(w, p),
    charterElapsed: p.charterPassage
      ? w.players[p.charterPassage.captain]?.charter?.elapsed
      : undefined,
    crewBerth: (() => {
      const c = fishingCrewCaptain(w, p);
      return c
        ? {
            captain: c.id,
            name: c.name,
            share: c.fishingVoyage!.members[p.id],
            stores: c.boatStores ?? {},
          }
        : undefined;
    })(),
    trawl: visibleTrawl(w, p),
    familyInvites: familyInvites(w, p),
    tradeOffers: personalOffers(w, p),
    statements: Object.fromEntries(
      w.buildings
        .filter((b) => b.owner === p.id || p.authority >= 20)
        .filter((b) => b.accounts)
        .map((b) => [b.id, b.accounts]),
    ),
    engineRunning: motorRunning(w, p),
    ballots: townBallots(w, p),
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
  settingsFields: SerializedFields;
  compact?: WeakMap<
    Frame,
    {
      world: string[];
      entities: string;
      order?: string;
      settings?: string;
      settingsPatch?: FieldPatch;
    }
  >;
}
/** Serialize shared world data once per broadcast, rather than once per recipient. */
export function prepareFrame(w: World): Frame {
  const {
    players,
    ledger,
    script,
    scriptVariables,
    messages,
    landscapeHistory,
    roadProject,
    families: _families,
    tradeOffers: _offers,
    ...common
  } = w;
  const publicFamilies = Object.fromEntries(
    Object.entries(families(w)).map(([id, f]) => [id, { ...f, invited: [] }]),
  );
  Object.assign(common, {
    parkedVehicles: publicParkedVehicles(w),
    families: publicFamilies,
    familyNames: Object.fromEntries(
      Object.values(families(w)).flatMap((f) =>
        f.members.map((id) => [id, w.players[id]?.name ?? id]),
      ),
    ),
  });
  if (common.mooredBoats)
    common.mooredBoats = Object.fromEntries(
      Object.entries(common.mooredBoats).map(([key, b]) => {
        const { cargo, cargoBasis: _privateBasis, cargoLife: _privateLife, ...publicBoat } = b;
        return [
          key,
          {
            ...publicBoat,
            ...(cargo
              ? {
                  load: Math.min(
                    1,
                    Math.ceil(
                      (stockWeight(w, cargo) / (vehicleDef(w, b.slot).holdCapacity || 1)) * 10,
                    ) / 10,
                  ),
                }
              : {}),
          },
        ];
      }),
    );
  if (common.boatRescues)
    common.boatRescues = Object.fromEntries(
      Object.entries(common.boatRescues).map(([id, r]) => [
        id,
        { boat: r.boat, dinghy: r.dinghy, cargo: {}, spoilage: r.spoilage, landing: r.landing },
      ]),
    );
  if (common.trailers)
    common.trailers = Object.fromEntries(
      Object.entries(common.trailers).map(([id, t]) => [
        id,
        {
          ...t,
          life: undefined,
          fuelService:
            t.kind === 'fuel' && w.players[t.owner]
              ? {
                  ownerName: w.players[t.owner].name,
                  ownerOnline: w.players[t.owner].online,
                  stopped:
                    !t.attached ||
                    !!(
                      w.players[t.attached] &&
                      Math.abs(w.players[t.attached].speed) <= fuelRules(w.settings).refuelSpeed
                    ),
                }
              : undefined,
          cargo: Object.fromEntries(
            Object.entries(t.cargo).map(([item, n]) => [
              item,
              t.kind === 'livestock' || t.kind === 'fuel' ? n : n > 0 ? Math.ceil(n / 10) * 10 : 0,
            ]),
          ),
        },
      ]),
    );
  common.landscapeUndo = !!landscapeHistory?.length;
  common.buildings = publicBuildings(w);
  (common as Record<string, unknown>).towns = publicTowns(w);
  common.scriptInteraction = w.script.includes('ObjectInteract');
  const fields = serializeFields(common);
  const publicPlayers: Record<string, string> = {};
  for (const p of Object.values(players))
    if (
      p.online ||
      offlineGroundObstacle(w, p) ||
      !!w.boatRescues?.[p.id] ||
      !!w.towJobs?.[p.id] ||
      p.charterPassage ||
      Object.keys(p.charter?.tickets ?? {}).length ||
      deckhands(w, p).length ||
      (p.hitch && players[p.hitch]?.fishingVoyage?.members[p.id])
    )
      publicPlayers[p.id] = JSON.stringify({
        id: p.id,
        name: p.name,
        npc: p.npc,
        x: +p.x.toFixed(2),
        y: +p.y.toFixed(2),
        z: +p.z.toFixed(2),
        heading: +p.heading.toFixed(3),
        speed: +p.speed.toFixed(2),
        flight: p.flight,
        freightLoad: p.boatHold
          ? Math.min(
              1,
              Math.ceil(
                (stockWeight(w, p.boatHold) / (vehicleDef(w, p.vehicle).holdCapacity || 1)) * 10,
              ) / 10,
            )
          : undefined,
        trawl: visibleTrawl(w, p),
        lastFlightCrash: p.lastFlightCrash,
        vehicle: p.vehicle,
        hitch: p.hitch,
        canBeTowed: !!strandedVessel(w, p.id),
        canReceiveFuel: refuelRecipientReady(p, w),
        canReceiveRepair: repairRecipientReady(p, w),
        tractorPaint: vehiclePaint(p),
        atHome: p.atHome,
        inside: p.inside,
        task: p.task?.arrival || p.task?.mount ? p.task : undefined,
        carrying: p.carrying,
        smallCraft: p.smallCraft,
        lights: p.lights,
        boatLighting: p.boatLighting,
        engineRunning: motorRunning(w, p),
        rowing: p.vehicle === CANOE || p.vehicle === ROWBOAT || (p.vehicle === 33 && p.fuel <= 0),
        team: p.team,
        game: p.game,
        health: p.health,
        kudos: p.kudos,
        online: p.online,
        lastSeen: p.lastSeen,
        kills: p.kills,
        age: Math.floor(p.age),
        lastHorn: p.lastHorn,
      });
  return {
    fields,
    players: publicPlayers,
    buildings: Object.fromEntries(common.buildings.map((b) => [b.id, serializeFields(b)])),
    buildingOrder: JSON.stringify(common.buildings.map((b) => b.id)),
    settingsFields: serializeFields(w.settings),
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
  constructor(
    private compact = false,
    private settingsDelta = true,
  ) {}
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
            .filter(
              ([key, value]) =>
                key !== 'buildings' && key !== 'settings' && this.previous!.fields[key] !== value,
            )
            .map(([key, value]) => JSON.stringify(key) + ':' + value),
          entities: JSON.stringify({
            buildings: entities(this.previous.buildings, frame.buildings),
            players: entities(this.previous.playerFields, frame.playerFields),
          }),
          order: order === this.previous.buildingOrder ? undefined : order,
          settings:
            frame.fields.settings === this.previous.fields.settings
              ? undefined
              : frame.fields.settings,
          settingsPatch: diffFields(this.previous.settingsFields, frame.settingsFields),
        };
        frame.compact.set(this.previous, shared);
      }
      fields.push(...shared.world);
      if (this.settingsDelta) {
        if (shared.settingsPatch)
          tail.push('"settingsPatch":' + JSON.stringify(shared.settingsPatch));
      } else if (shared.settings) fields.push('"settings":' + shared.settings);
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
