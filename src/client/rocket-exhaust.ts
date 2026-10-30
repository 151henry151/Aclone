// SPDX-License-Identifier: GPL-3.0-or-later
import { spaceportMotion } from '../shared/spaceport-flight';
/** Metres, relative to the pad. Ground wash requires exhaust to actually reach it. */
export function rocketExhaust(elapsed: number) {
  const m = spaceportMotion(elapsed);
  const landing = elapsed >= 250;
  const length = (landing ? 52 : 320) * Math.sqrt(m.thrust);
  const nozzle = m.height + 8.4;
  const contact = m.thrust * Math.max(0, Math.min(1, (length - nozzle) / 25));
  return { ...m, length, nozzle, contact, landing };
}
/** Stateless births make late joins, background-tab resumes and replays agree.
 * Each slot is reused only after its previous puff has fully faded. */
export function groundPuff(elapsed: number, slot: number, count = 120) {
  const lifetime = 24;
  const birth =
    Math.floor(elapsed / lifetime - slot / count) * lifetime + (slot * lifetime) / count;
  const age = elapsed - birth;
  const source = rocketExhaust(birth);
  const opacity =
    source.contact *
    Math.min(1, age / 0.7) *
    (1 - Math.max(0, (age / lifetime - 0.45) / 0.55)) ** 1.4;
  const angle = slot * 2.399963 + Math.floor(birth / lifetime) * 0.37;
  const spread = 12 + age * (source.landing ? 8 : 17) * (0.7 + (slot % 7) / 14);
  const size = (source.landing ? 18 : 30) + age * (source.landing ? 5 : 9);
  return {
    x: Math.cos(angle) * spread + age * 1.2,
    z: Math.sin(angle) * spread,
    y: 2 + size * 0.3 + age * (source.landing ? 0.65 : 1.2),
    size,
    opacity,
    age,
  };
}
