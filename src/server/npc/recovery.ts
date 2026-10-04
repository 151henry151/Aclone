// SPDX-License-Identifier: GPL-3.0-or-later
import type { Step } from './decision.ts';
/** Durable limits use world time so restart and offline catch-up preserve them. */
export interface Recovery {
  streak?: number;
  lastFailureAt?: number;
  retryAt?: number;
  quiet?: boolean;
  failures?: {
    key: string;
    step: Step;
    message: string;
    count: number;
    at: number;
    until: number;
  }[];
  speech?: { text: string; to?: string; at: number }[];
}
function key(step: Step) {
  // Nearby variants of the same unreachable ground waypoint are one attempt.
  if (step.kind === 'move') return `move:${Math.floor(step.x / 8)}:${Math.floor(step.z / 8)}`;
  return JSON.stringify(step);
}
export function failStep(r: Recovery, time: number, step: Step | undefined, message: string) {
  r.streak = time - (r.lastFailureAt ?? -Infinity) <= 900 ? (r.streak ?? 0) + 1 : 1;
  r.lastFailureAt = time;
  r.retryAt = time + (r.streak < 2 ? 0 : Math.min(600, 30 * 2 ** Math.min(5, r.streak - 2)));
  r.quiet = r.streak >= 2;
  r.failures = (r.failures ?? []).filter((f) => time - f.at < 1800);
  if (!step) return;
  const k = key(step),
    previous = r.failures.find((f) => f.key === k);
  const count = (previous?.count ?? 0) + 1;
  r.failures = r.failures.filter((f) => f.key !== k);
  r.failures.push({
    key: k,
    step,
    message,
    count,
    at: time,
    until: /route|obstructed|journey/i.test(message)
      ? time + 600
      : count < 2
        ? time
        : time + Math.min(1800, 300 * 2 ** Math.min(3, count - 2)),
  });
  r.failures = r.failures.slice(-16);
}
export function blockedStep(r: Recovery | undefined, step: Step, time: number) {
  return r?.failures?.find((f) => f.key === key(step) && f.until > time);
}
export function madeProgress(r: Recovery) {
  r.streak = 0;
  r.retryAt = 0;
  r.quiet = false;
}
const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
function similar(a: string, b: string) {
  if (a === b) return true;
  const x = new Set(a.split(' ')),
    y = new Set(b.split(' '));
  const common = [...x].filter((v) => y.has(v)).length;
  return common >= 6 && common / new Set([...x, ...y]).size >= 0.8;
}
/** A direct human question can receive a repeated answer, but autonomous chatter
 * cannot repeatedly advertise a failed plan. Recipient scopes never cross. */
export function allowSpeech(
  r: Recovery,
  text: string,
  to: string | undefined,
  time: number,
  addressed: boolean,
) {
  r.speech = (r.speech ?? []).filter((s) => time - s.at < 600);
  const normalized = normalize(text);
  if (!addressed && (r.quiet || r.speech.some((s) => s.to === to && similar(s.text, normalized))))
    return false;
  r.speech.push({ text: normalized, to, at: time });
  r.speech = r.speech.slice(-8);
  return true;
}
