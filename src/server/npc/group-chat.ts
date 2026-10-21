// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player } from '../../shared/types.ts';
import { recipes } from '../../shared/catalog.ts';
import { worldSkills, skillLesson } from '../../shared/world-catalogue.ts';
import type { ResidentState } from './memory.ts';
import type { NpcConfig } from './config.ts';

export type GroupTopic = 'employment' | 'trading' | 'social';
/** Explicit public group salutations, not incidental references to other people. */
export function isGroupAddress(text: string) {
  return /^\s*(?:@(?:all|everyone|npcs)\b|(?:(?:hey|hi|hello|okay|ok)\s*[,!]?\s+)?(?:everyone\b|everybody\b|folks\b|guys\b|neighbou?rs\b|all(?=\s*[,!:?]|\s+of\s+you\b|\s*$)|anyone\b|anybody\b))/i.test(
    text,
  );
}
export function groupTopic(text: string): GroupTopic {
  return /\b(work(?:ing|ers)?|job|jobs|hiring|hire|wage|wages|employ\w*)\b/i.test(text)
    ? 'employment'
    : /\b(buy|buying|sell|selling|deliver|delivery|trade|trading|suppl\w*)\b/i.test(text)
      ? 'trading'
      : 'social';
}
export interface GroupCandidate {
  config: NpcConfig;
  state: ResidentState;
}
/** Cheap attention allocation, not acceptance of a job. Uses personal knowledge and
 * the speaker's unverified offer; never reads distant tills, wages or stock. */
export function groupInterest(w: World, p: Player, c: GroupCandidate, text: string) {
  const { state, config } = c;
  if (
    !p.online ||
    state.presence?.phase === 'offline' ||
    state.inSpace ||
    state.helpQuestion ||
    p.health <= 0
  )
    return;
  if (
    p.hunger > 30000 ||
    p.thirst > 30000 ||
    p.health < 15000 ||
    state.presence?.phase === 'preparing'
  )
    return;
  const topic = groupTopic(text);
  const preference = state.agenda?.preferences
    .filter((v) => v.world === w.id && v.activity === topic)
    .at(-1);
  if (preference?.stance === 'avoid') return;
  const activeAgreement = state.commitments?.some((c) => ['pending', 'blocked'].includes(c.status));
  if (topic !== 'social' && activeAgreement) return;
  let score = preference?.stance === 'prefer' ? 2 : 0;
  if (topic === 'employment') {
    if (w.settings.jobsEnabled === false) return;
    const words: string[] = text.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [];
    const skill =
      worldSkills(w).find((s) => words.includes(s) || words.includes(s + 's')) ??
      Object.values(recipes).find((r) => words.includes(r.skill.replace(/er$/, '')))?.skill ??
      (/\bfarm\b|\bfarming\b/i.test(text) ? 'farmer' : undefined);
    const offered = text.match(/\b(\d+(?:\.\d+)?)\s*d\b/i);
    const knownJob = p.job ? state.markets?.visits[p.job]?.building : undefined;
    if (p.job && (!offered || !knownJob || Number(offered[1]) * 100 <= knownJob.wage)) return;
    if (skill && !p.skills.includes(skill)) {
      if (!/\b(learn|train|study)\w*\b/i.test(text)) return;
      if (p.learning && p.learning.skill !== skill) return;
      if (
        !p.learning &&
        (p.skills.length >= w.settings.maxSkills || p.cash < skillLesson(w, p, skill).price + 5000)
      )
        return;
      if (!['employee', 'farmer', 'balanced'].includes(config.preference)) return;
      score += config.preference === 'farmer' && skill === 'farmer' ? 4 : 2;
    } else score += skill ? 8 : 2;
    if (config.preference === 'employee' || (config.preference === 'farmer' && skill === 'farmer'))
      score += 3;
    if (!p.job) score += 2;
  } else if (topic === 'trading') {
    if (!['trader', 'gatherer', 'farmer', 'balanced'].includes(config.preference)) return;
    score += config.preference === 'trader' ? 6 : 2;
  } else {
    // A greeting or open question needs one conversational reply, not nineteen.
    score += config.id === 'mabel' ? 3 : 1;
  }
  return { score, topic };
}
export function groupResponder<T extends GroupCandidate>(
  w: World,
  candidates: T[],
  text: string,
  messageId: number,
  now: number,
): T | undefined {
  // Shared cooldown survives restart and prevents repeated group pings fanning out.
  if (candidates.some((c) => now - (c.state.groupReplyAt ?? -Infinity) < 30000)) return;
  return candidates
    .flatMap((c) => {
      const p = w.players[c.state.playerId];
      const interest = p && groupInterest(w, p, c, text);
      return interest ? [{ c, score: interest.score }] : [];
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.c.state.groupReplyAt ?? 0) - (b.c.state.groupReplyAt ?? 0) ||
        // Stable tie-break independent of configuration iteration order.
        `${messageId}:${a.c.config.id}`.localeCompare(`${messageId}:${b.c.config.id}`),
    )[0]?.c;
}
