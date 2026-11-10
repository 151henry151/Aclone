import { communicationRules } from './communication-rules';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player, Action } from './types';
import { radioRules, type RadioRules } from './radio-rules';
import { vehicleDef } from './vehicle-config';
import { terrainHeight } from './terrain';
import { surfaceWaterLevel } from './ocean';
import { chatText } from './messages';
export interface RadioConfig {
  channel: number;
  handle: string;
  squelch: number;
  volume: number;
}
export interface RadioEvent {
  id: number;
  channel: number;
  from: string;
  handle: string;
  text: string;
  strength: number;
  collision: boolean;
  rescue?: { x: number; z: number };
}
interface Transmission {
  id: number;
  from: string;
  slot: number;
  channel: number;
  handle: string;
  text: string;
  since: number;
  duration: number;
  rate: number;
  voice?: string;
  voiceRules?: RadioRules;
  heard: Map<string, { strength: number; collision: boolean; text: string; end: number }>;
}
interface Listener {
  slot: number;
  traffic: RadioEvent[];
}
interface State {
  now: number;
  sequence: number;
  transmitters: Map<string, Transmission>;
  listeners: Map<string, Listener>;
}
const states = new WeakMap<World, State>();
function state(w: World) {
  let s = states.get(w);
  if (!s) {
    s = { now: 0, sequence: 0, transmitters: new Map(), listeners: new Map() };
    states.set(w, s);
  }
  return s;
}
function need(ok: unknown, message: string): asserts ok {
  if (!ok) throw Error(message);
}
export function radioAvailable(w: World, p: Player) {
  const r = radioRules(w.settings);
  return (
    r.radioEnabled &&
    p.online &&
    !p.atHome &&
    !p.crowBody &&
    !p.hitch &&
    (!p.npc || r.radioResidents) &&
    [0, 1, 2, 3, 4].includes(vehicleDef(w, p.vehicle).mode)
  );
}
export function radioConfig(w: World, p: Player): RadioConfig {
  const r = radioRules(w.settings),
    saved = p.radios?.[p.vehicle];
  return {
    channel: Math.min(r.radioChannelCount, saved?.channel ?? r.radioDefaultChannel),
    handle: saved?.handle ?? p.name,
    squelch: saved?.squelch ?? r.radioDefaultSquelch,
    volume: saved?.volume ?? 1,
  };
}
/** Deterministic bounded terrain sampling: altitude helps until a ridge cuts the ray. */
export function radioSignal(w: World, a: Player, b: Player) {
  const r = radioRules(w.settings),
    av = vehicleDef(w, a.vehicle),
    bv = vehicleDef(w, b.vehicle);
  const base = (p: Player) => Math.max(terrainHeight(w, p.x, p.z), surfaceWaterLevel(w, p.x, p.z));
  const antenna = (p: Player, mode: number) =>
    Math.max(base(p), p.y) +
    (mode === 2 ? r.radioAircraftAntenna : mode === 3 ? r.radioBoatAntenna : r.radioGroundAntenna);
  const ay = antenna(a, av.mode),
    by = antenna(b, bv.mode),
    distance = Math.hypot(a.x - b.x, a.z - b.z);
  const elevated = Math.max(
    0,
    Math.max(ay, by) - Math.min(base(a), base(b)) - r.radioGroundAntenna,
  );
  const overWater = av.mode === 3 && bv.mode === 3;
  const range =
    r.radioRange *
    (1 + Math.sqrt(elevated / r.radioHeightScale)) *
    (overWater ? r.radioWaterRange : 1);
  if (distance >= range) return 0;
  let obstruction = 0;
  for (let i = 1; i <= r.radioTerrainSamples; i++) {
    const t = i / (r.radioTerrainSamples + 1),
      x = a.x + (b.x - a.x) * t,
      z = a.z + (b.z - a.z) * t;
    obstruction = Math.max(obstruction, terrainHeight(w, x, z) - (ay + (by - ay) * t));
  }
  return Math.max(0, 1 - distance / range) * Math.exp(-obstruction * r.radioTerrainAttenuation);
}
function listener(w: World, p: Player) {
  const s = state(w);
  let l = s.listeners.get(p.id);
  if (!l || l.slot !== p.vehicle || !radioAvailable(w, p)) {
    l = { slot: p.vehicle, traffic: [] };
    s.listeners.set(p.id, l);
  }
  return l;
}
function heard(w: World, p: Player, tx: Transmission) {
  const sender = w.players[tx.from],
    cfg = radioConfig(w, p);
  if (!sender || !radioAvailable(w, p) || !radioAvailable(w, sender) || cfg.channel !== tx.channel)
    return 0;
  const strength = radioSignal(w, sender, p);
  return strength > 0 && strength >= cfg.squelch ? strength : 0;
}
export function radioView(w: World, p: Player) {
  const cfg = radioConfig(w, p),
    s = state(w),
    l = listener(w, p);
  return {
    available: radioAvailable(w, p),
    config: cfg,
    traffic: l.traffic.slice(),
    keyed: [...s.transmitters.values()]
      .filter((tx) => heard(w, p, tx) > 0)
      .map((tx) => ({
        voice: tx.voice,
        from: tx.from,
        handle: tx.handle,
        remaining: Math.max(0, tx.duration - (s.now - tx.since)),
        strength: heard(w, p, tx),
      })),
  };
}
function hash(text: string) {
  let n = 2166136261;
  for (const c of text) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  n = Math.imul(n ^ (n >>> 16), 0x85ebca6b);
  n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
export function radioLegibility(text: string, strength: number, w: World, seed: string) {
  const r = radioRules(w.settings);
  if (strength >= r.radioClearSignal) return text;
  if (strength <= r.radioStaticSignal) return '[static]';
  const clarity = (strength - r.radioStaticSignal) / (r.radioClearSignal - r.radioStaticSignal);
  return text
    .split(/\s+/)
    .map((word, i) => (hash(`${seed}:${i}`) < clarity ? word : '…'))
    .join(' ');
}
function finish(w: World, s: State, tx: Transmission) {
  const r = radioRules(w.settings),
    sender = w.players[tx.from];
  for (const [id, reception] of tx.heard) {
    const p = w.players[id];
    if (!p || !radioAvailable(w, p) || radioConfig(w, p).channel !== tx.channel) continue;
    if (!reception.text) continue;
    const collision = reception.collision;
    const event: RadioEvent = {
      id: tx.id,
      from: tx.from,
      handle: tx.handle,
      channel: tx.channel,
      strength: reception.strength,
      collision,
      text: collision
        ? '[doubling — overlapping transmissions]'
        : tx.voice
          ? reception.strength <= r.radioStaticSignal
            ? '[static]'
            : reception.strength < r.radioClearSignal
              ? 'Voice transmission · weak reception'
              : 'Voice transmission'
          : radioLegibility(reception.text, reception.strength, w, `${tx.id}:${id}`),
    };
    if (
      !collision &&
      r.radioRescuePrompts &&
      tx.channel === r.radioEmergencyChannel &&
      sender &&
      vehicleDef(w, p.vehicle).mode === 3 &&
      vehicleDef(w, sender.vehicle).mode === 3 &&
      Math.hypot(p.x - sender.x, p.z - sender.z) <= r.radioRescueRange &&
      (sender.vehicle === 29 ||
        w.boatRescues?.[sender.id] ||
        (vehicleDef(w, sender.vehicle).fuel > 0 && sender.fuel <= 0))
    )
      event.rescue = { x: sender.x, z: sender.z };
    const log = listener(w, p).traffic;
    log.push(event);
    log.splice(0, Math.max(0, log.length - r.radioLogLimit));
  }
  s.transmitters.delete(tx.from);
}
export function radioAction(w: World, p: Player, a: Action) {
  need(radioAvailable(w, p), 'Board an enabled vehicle radio');
  const r = radioRules(w.settings),
    cfg = radioConfig(w, p),
    s = state(w),
    op = a.operation;
  if (op === 'key' || op === 'voice') {
    const voice = op === 'voice';
    if (voice)
      need(
        typeof a.value === 'string' && /^[a-zA-Z0-9-]{1,64}$/.test(a.value),
        'Invalid microphone session',
      );
    const text = chatText(
      w,
      p,
      voice ? 'Voice transmission' : a.text,
      voice ? Infinity : Math.min(r.radioMaxLength, communicationRules(w.settings).chatMaxLength),
      r.radioModeration,
    );
    need(!s.transmitters.has(p.id), 'Your microphone is already keyed');
    need(
      ![...s.transmitters.values()].some(
        (tx) => s.now - tx.since > r.radioSimultaneousWindow && heard(w, p, tx) > 0,
      ),
      'CB channel is busy; wait for the transmission to finish',
    );
    s.transmitters.set(p.id, {
      id: ++s.sequence,
      from: p.id,
      slot: p.vehicle,
      channel: cfg.channel,
      handle: cfg.handle,
      text,
      since: s.now,
      duration: voice
        ? r.radioVoiceMaxSeconds
        : Math.max(r.radioMinDuration, text.length / r.radioCharsPerSecond),
      ...(voice ? { voice: String(a.value), voiceRules: r } : {}),
      rate: r.radioCharsPerSecond,
      heard: new Map(),
    });
    return 'CB microphone keyed';
  }
  if (op === 'release') {
    const tx = s.transmitters.get(p.id);
    if (tx && (!a.value || tx.voice === a.value)) finish(w, s, tx);
    return 'CB microphone released';
  }
  need(!s.transmitters.has(p.id), 'Release the microphone before adjusting the radio');
  if (op === 'handle') {
    need(
      typeof a.value === 'string' &&
        a.value.trim().length > 0 &&
        a.value.length <= r.radioHandleLength,
      'Invalid call sign',
    );
    cfg.handle = a.value.trim();
  } else if (op === 'channel') {
    need(
      typeof a.value === 'number' &&
        Number.isSafeInteger(a.value) &&
        a.value >= 1 &&
        a.value <= r.radioChannelCount,
      'Invalid radio channel',
    );
    cfg.channel = a.value;
  } else if (op === 'squelch' || op === 'volume') {
    need(
      typeof a.value === 'number' && Number.isFinite(a.value) && a.value >= 0 && a.value <= 1,
      'Choose a level from zero to one',
    );
    cfg[op] = a.value;
  } else throw Error('Unknown radio operation');
  (p.radios ??= {})[p.vehicle] = cfg;
  return 'CB radio adjusted';
}
export function tickRadio(w: World, seconds: number) {
  const s = states.get(w);
  if (!s || !Number.isFinite(seconds) || seconds <= 0) return;
  for (const p of Object.values(w.players)) listener(w, p);
  for (const [id, tx] of s.transmitters) {
    const p = w.players[id];
    if (
      !p ||
      !radioAvailable(w, p) ||
      p.vehicle !== tx.slot ||
      (tx.voice && radioRules(w.settings).radioModeration && (p.muted || w.settings.chatLocked))
    )
      s.transmitters.delete(id);
  }
  for (const p of Object.values(w.players)) {
    if (!radioAvailable(w, p)) continue;
    const receiving = [...s.transmitters.values()]
      .map((tx) => ({ tx, strength: heard(w, p, tx) }))
      .filter((v) => v.strength > 0);
    for (const { tx, strength } of receiving) {
      if (tx.from === p.id || tx.voice) continue;
      const old = tx.heard.get(p.id),
        elapsed = Math.min(seconds, Math.max(0, tx.duration - (s.now - tx.since)));
      const start = Math.max(old?.end ?? 0, Math.floor((s.now - tx.since) * tx.rate + 1e-9)),
        end = Math.min(tx.text.length, Math.floor((s.now - tx.since + elapsed) * tx.rate + 1e-9));
      tx.heard.set(p.id, {
        strength: Math.min(old?.strength ?? 1, strength),
        collision: !!old?.collision || receiving.length > 1,
        text:
          (old?.text ?? '') +
          (old?.text && start > old.end ? ' … ' : '') +
          tx.text.slice(start, end),
        end,
      });
    }
  }
  s.now += seconds;
  for (const tx of [...s.transmitters.values()])
    if (s.now - tx.since >= tx.duration) finish(w, s, tx);
}
/** Departure must clear immediately, even when reconnect happens before the next tick. */
export function leaveRadio(w: World, p: Player) {
  const s = states.get(w);
  if (!s) return;
  s.transmitters.delete(p.id);
  s.listeners.delete(p.id);
  for (const tx of s.transmitters.values()) tx.heard.delete(p.id);
}
/** Server action transactions retain transient radio traffic across rollback world copies. */
export function radioCheckpoint(w: World) {
  const s = states.get(w);
  return s ? structuredClone(s) : undefined;
}
export function restoreRadio(w: World, checkpoint: ReturnType<typeof radioCheckpoint>) {
  if (checkpoint) states.set(w, checkpoint);
  else states.delete(w);
}

/** Validate the live carrier independently of the client and the simulation tick. */
export function radioVoiceSession(w: World, p: Player, token: string) {
  const tx = state(w).transmitters.get(p.id),
    r = radioRules(w.settings);
  if (
    !tx ||
    tx.voice !== token ||
    !tx.voiceRules ||
    !radioAvailable(w, p) ||
    p.vehicle !== tx.slot ||
    radioConfig(w, p).channel !== tx.channel ||
    w.maintenance?.paused ||
    (r.radioModeration && (p.muted || w.settings.chatLocked))
  )
    return;
  return tx;
}
export function radioVoiceListeners(w: World, sender: Player, token: string) {
  const tx = radioVoiceSession(w, sender, token);
  if (!tx) return [];
  const s = state(w);
  return Object.values(w.players).flatMap((p) => {
    if (p.id === sender.id || s.transmitters.has(p.id)) return [];
    const strength = heard(w, p, tx);
    if (!strength) return [];
    const collision = [...s.transmitters.values()].some(
      (other) => other !== tx && heard(w, p, other) > 0,
    );
    const old = tx.heard.get(p.id);
    tx.heard.set(p.id, {
      strength: Math.min(old?.strength ?? 1, strength),
      collision: !!old?.collision || collision,
      text: 'Voice transmission',
      end: 0,
    });
    return [{ id: p.id, strength, collision }];
  });
}
