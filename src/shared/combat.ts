import { maximumHealth } from './nutrition.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import { creatorBlocksSegment } from './creator.ts';
import { blocksBuilding } from './building-shapes.ts';
import { weapons, vehicles } from './catalog.ts';
import { distance, damage, terrainHeight, log, say } from './simulation.ts';
import type { World, Player, Action } from './types.ts';
export type CombatMode = 'deathmatch' | 'capture' | 'ctf';
export interface Combat {
  mode: CombatMode;
  scores: number[];
  round: number;
  ends: number;
  winner?: number;
  restart?: number;
  flags: { carrier?: string; x: number; z: number; dropped?: number }[];
}
export const ammunition: Record<string, number> = {
  machine: 120,
  grenade: 8,
  plasma: 24,
  rocket: 8,
  javelin: 6,
  mine: 6,
};
export const bases = [
  { x: -100, z: -110 },
  { x: 100, z: -110 },
];
export const combatBases = (w: World) => w.creator?.arena.bases ?? bases;
const duration = (w: World) => w.creator?.arena.roundSeconds ?? 600;
export function combatSpawn(w: World, p: Player) {
  p.x = combatBases(w)[p.team].x;
  p.z = combatBases(w)[p.team].z;
  p.y = terrainHeight(w, p.x, p.z);
  p.health = maximumHealth(p);
  p.energy = 65000;
  p.speed = 0;
  p.vehicle = p.combatVehicle ?? 0;
  p.invulnerableUntil = w.time + (w.creator?.arena.protectionSeconds ?? 3);
  p.ammo = { ...ammunition };
  delete p.weaponCharge;
}
export function leaveCombat(w: World, p: Player) {
  for (const f of w.combat?.flags ?? [])
    if (f.carrier === p.id) {
      delete f.carrier;
      f.x = p.x;
      f.z = p.z;
      f.dropped = w.time;
    }
  delete p.weaponCharge;
}
export function joinCombat(w: World, p: Player, mode: string) {
  if (!w.settings.fighting) throw Error('Fighting is disabled');
  if (w.creator?.arena.mode && w.creator.arena.mode !== 'open') mode = w.creator.arena.mode;
  if (!['deathmatch', 'capture', 'ctf'].includes(mode)) throw Error('Choose a combat mode');
  if (p.task || p.game || p.crowBody || p.hitch)
    throw Error('Finish or leave your current activity first');
  const others = Object.values(w.players).filter((q) => q.online && q.game === 'combat');
  if (others.length && w.combat?.mode !== mode)
    throw Error('A different combat mode is already running');
  if (!others.length)
    w.combat = {
      mode: mode as CombatMode,
      scores: [0, 0],
      round: (w.combat?.round ?? 0) + 1,
      ends: w.time + duration(w),
      flags: combatBases(w).map((v) => ({ ...v })),
    };
  p.team =
    others.filter((q) => q.team === 0).length <= others.filter((q) => q.team === 1).length ? 0 : 1;
  p.game = 'combat';
  p.atHome = false;
  p.combatVehicle = p.vehicle === 5 ? 5 : 0;
  combatSpawn(w, p);
}
function safe(w: World, p: { x: number; z: number }) {
  return w.zones.some((z) => z.kind === 'safe' && distance(p, z) < z.radius);
}
export function fireWeapon(w: World, p: Player, a: Action) {
  if (!w.settings.fighting) throw Error('Fighting is disabled on this world');
  if (safe(w, p)) throw Error('Weapons are disabled in safe zones');
  if (p.atHome || p.task || p.crowBody || p.hitch) throw Error('Weapons are disabled here');
  const key = String(a.weapon),
    def = weapons[key];
  if (!Object.hasOwn(weapons, key)) throw Error('Unknown weapon');
  if (w.creator && !w.creator.arena.weapons.includes(key as any))
    throw Error('That weapon is disabled by this world creator');
  if (a.type === 'chargeWeapon') {
    if (key !== 'javelin') throw Error('Only javelins charge');
    // A fresh deliberate press starts a fresh charge, including after a cancelled touch.
    p.weaponCharge = { weapon: key, start: w.time };
    return;
  }
  if (p.game === 'combat' && w.combat?.restart) throw Error('Wait for the next round');
  if (w.time - p.lastShot < def.delay) throw Error('Weapon cooling down');
  if (w.projectiles.length >= 512 || w.projectiles.filter((s) => s.owner === p.id).length >= 24)
    throw Error('Too many weapons in flight');
  let power = 1;
  if (key === 'javelin') {
    if (p.weaponCharge?.weapon !== key) throw Error('Hold Tab to charge a javelin');
    power = 0.5 + Math.min(1.5, Math.max(0, w.time - p.weaponCharge.start));
  }
  if (w.settings.weaponMode === 'ammo') {
    if (((p.ammo ?? ammunition)[key] ?? 0) < 1)
      throw Error('Out of ammunition; refit at the garage');
  } else if (p.energy < def.energy) throw Error('Not enough energy');
  if (w.settings.weaponMode === 'ammo') {
    p.ammo ??= { ...ammunition };
    p.ammo[key]--;
  } else p.energy -= def.energy;
  delete p.weaponCharge;
  p.lastShot = w.time;
  p.invulnerableUntil = 0;
  w.projectiles.push({
    id: ++w.revision,
    owner: p.id,
    weapon: key,
    x: p.x,
    y: p.y + (key === 'mine' ? 0.2 : 1.7),
    z: p.z,
    vx: Math.sin(p.heading) * def.speed * power,
    vy: def.gravity ? def.speed * 0.4 * power : 0,
    vz: Math.cos(p.heading) * def.speed * power,
    ttl: key === 'mine' ? 90 : def.ttl,
    power,
    age: 0,
    game: p.game,
    team: p.team,
  });
}
export function tickCombat(w: World, seconds: number, kill: (p: Player) => void) {
  if (!w.settings.fighting) {
    w.projectiles = [];
    return;
  }
  // No offline battles. Large catch-up steps expire ordnance without hurting returning pilots.
  if (seconds > 10) {
    w.projectiles = [];
    return;
  }
  const players = Object.values(w.players);
  const enemy = (shooter: Player | undefined, q: Player) =>
    q.online &&
    !q.atHome &&
    q.id !== shooter?.id &&
    !safe(w, q) &&
    (q.invulnerableUntil ?? 0) <= w.time &&
    (shooter?.game === 'combat'
      ? q.game === 'combat' && shooter.team !== q.team
      : q.game !== 'combat');
  const hit = (shooter: Player | undefined, q: Player, amount: number) => {
    q.health -= damage(amount, w.vehicleTuning?.[q.vehicle]?.armour ?? vehicles[q.vehicle].armour);
    if (q.health > 0) return;
    leaveCombat(w, q);
    const match = q.game === 'combat';
    kill(q);
    if (match) combatSpawn(w, q);
    if (shooter) {
      shooter.kills++;
      shooter.kudos += 2;
      if (match && w.combat?.mode === 'deathmatch') w.combat.scores[shooter.team]++;
      const reward = w.settings.killReward ?? 0;
      if (reward > 0 && w.time - (q.lastRewardedDeath ?? -Infinity) >= 30) {
        shooter.cash += reward;
        log(w, 'faucet', reward, 'treasury', shooter.id, 'combat reward');
        q.lastRewardedDeath = w.time;
      }
    }
  };
  for (const shot of w.projectiles) {
    const def = weapons[shot.weapon],
      shooter = w.players[shot.owner];
    if (
      !def ||
      !shooter?.online ||
      shot.game !== shooter.game ||
      (shot.team !== undefined && shot.team !== shooter.team)
    ) {
      shot.ttl = 0;
      continue;
    }
    for (let left = seconds; left > 0 && shot.ttl > 0;) {
      const dt = Math.min(0.02, left);
      left -= dt;
      shot.ttl -= dt;
      shot.age = (shot.age ?? 0) + dt;
      const from = { x: shot.x, y: shot.y, z: shot.z };
      shot.x += shot.vx * dt;
      shot.z += shot.vz * dt;
      shot.y += shot.vy * dt;
      shot.vy -= def.gravity * dt;
      if (
        w.zones.some((z) => {
          if (z.kind !== 'safe') return false;
          const dx = shot.x - from.x,
            dz = shot.z - from.z,
            length = dx * dx + dz * dz;
          const t = length
            ? Math.max(0, Math.min(1, ((z.x - from.x) * dx + (z.z - from.z) * dz) / length))
            : 0;
          return Math.hypot(from.x + t * dx - z.x, from.z + t * dz - z.z) < z.radius;
        })
      ) {
        shot.ttl = 0;
        break;
      }
      if (creatorBlocksSegment(w, from, shot, 0)) {
        shot.ttl = 0;
        break;
      }
      const ground = terrainHeight(w, shot.x, shot.z);
      if (shot.weapon === 'mine') shot.y = ground + 0.2;
      if (shot.weapon === 'grenade' && shot.y <= ground + 0.15) {
        shot.y = ground + 0.15;
        shot.vy = Math.abs(shot.vy) * 0.45;
        shot.vx *= 0.65;
        shot.vz *= 0.65;
      }
      const armed = shot.weapon !== 'mine' || shot.age >= 1.5;
      const target = armed
        ? players.find(
            (q) =>
              enemy(shooter, q) &&
              distance(q, shot) < (shot.weapon === 'mine' ? def.radius : 1.6) &&
              Math.abs(q.y + 1.4 - shot.y) < 2.5,
          )
        : undefined;
      const building = armed
        ? w.buildings.find(
            (b) =>
              Math.abs(b.x - shot.x) < 16 &&
              Math.abs(b.z - shot.z) < 16 &&
              blocksBuilding(b, shot.x, shot.z, shot.y - terrainHeight(w, b.x, b.z), 0),
          )
        : undefined;
      const groundImpact = shot.y <= ground && shot.weapon !== 'grenade' && shot.weapon !== 'mine';
      if (target || building || groundImpact || shot.ttl <= 0) {
        const explosive = ['rocket', 'grenade', 'mine'].includes(shot.weapon);
        if (explosive && armed)
          for (const q of players) {
            const d = Math.hypot(q.x - shot.x, q.y + 1 - shot.y, q.z - shot.z);
            if (enemy(shooter, q) && d < def.radius)
              hit(shooter, q, def.damage * (1 - (d / def.radius) * 0.6) * (shot.power ?? 1));
          }
        else if (target && !building) hit(shooter, target, def.damage * (shot.power ?? 1));
        if (
          building &&
          !building.government &&
          building.owner !== shooter.id &&
          shooter.game !== 'combat' &&
          !safe(w, building)
        )
          building.condition = Math.max(
            building.lodging ? 1 : 0,
            building.condition - def.buildDamage / 1000,
          );
        shot.ttl = 0;
      }
    }
  }
  w.projectiles = w.projectiles.filter((s) => s.ttl > 0);
  const c = w.combat;
  if (!c) return;
  const joined = players.filter((p) => p.online && p.game === 'combat');
  const grounded = joined.filter(
    (p) => Math.abs(p.y - terrainHeight(w, p.x, p.z)) < 3 && !p.atHome && !p.crowBody,
  );
  if (c.restart) {
    if (w.time >= c.restart) {
      c.scores = [0, 0];
      c.round++;
      c.ends = w.time + duration(w);
      delete c.winner;
      delete c.restart;
      c.flags = combatBases(w).map((b) => ({ ...b }));
      for (const p of joined) combatSpawn(w, p);
    }
    return;
  }
  if (![0, 1].every((t) => joined.some((p) => p.team === t))) {
    c.ends += seconds;
    return;
  }
  if (c.mode === 'capture') {
    const teams = new Set(
      grounded
        .filter(
          (p) =>
            distance(p, w.creator?.arena.capture ?? { x: 0, z: -110 }) <
            (w.creator?.arena.capture.radius ?? 12),
        )
        .map((p) => p.team),
    );
    if (teams.size === 1) c.scores[[...teams][0]] += seconds;
  }
  if (c.mode === 'ctf')
    for (let team = 0; team < 2; team++) {
      const f = c.flags[team];
      const carrier = f.carrier && w.players[f.carrier];
      if (carrier && carrier.online && carrier.game === 'combat') {
        f.x = carrier.x;
        f.z = carrier.z;
        const home = c.flags[carrier.team];
        if (
          grounded.includes(carrier) &&
          distance(carrier, combatBases(w)[carrier.team]) < 8 &&
          !home.carrier &&
          distance(home, combatBases(w)[carrier.team]) < 1
        ) {
          c.scores[carrier.team]++;
          c.flags[team] = { ...combatBases(w)[team] };
          say(w, 'Capture the flag', `${carrier.name} brought the flag home.`);
        }
      } else {
        if (f.carrier) {
          delete f.carrier;
          f.dropped = w.time;
        }
        if (f.dropped && w.time - f.dropped > (w.creator?.arena.flagReturnSeconds ?? 30)) {
          c.flags[team] = { ...combatBases(w)[team] };
          continue;
        }
        const defender = grounded.find((p) => p.team === team && distance(p, f) < 5);
        if (defender && distance(f, combatBases(w)[team]) > 1) {
          c.flags[team] = { ...combatBases(w)[team] };
          continue;
        }
        const thief = grounded.find((p) => p.team !== team && distance(p, f) < 5);
        if (thief) {
          f.carrier = thief.id;
          delete f.dropped;
          thief.invulnerableUntil = 0;
        }
      }
    }
  const limit =
    w.creator?.arena.scoreLimit ?? (c.mode === 'capture' ? 120 : c.mode === 'ctf' ? 3 : 10);
  if (c.scores.some((s) => s >= limit) || w.time >= c.ends) {
    c.winner = c.scores[0] === c.scores[1] ? -1 : c.scores[0] > c.scores[1] ? 0 : 1;
    c.restart = w.time + 15;
    say(
      w,
      'Combat marshal',
      `Round ${c.round}: ${c.winner < 0 ? 'draw' : (w.creator?.arena.teams[c.winner] ?? (c.winner === 0 ? 'Rust' : 'Moss')) + ' wins'}. Next round in 15 seconds.`,
    );
    for (const p of joined) if (p.team === c.winner) p.kudos += 5;
    w.projectiles = [];
  }
}
