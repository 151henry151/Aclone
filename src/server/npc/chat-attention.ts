// SPDX-License-Identifier: GPL-3.0-or-later
import type { ResidentState } from './memory.ts';

const words = (text: string): string[] => text.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [];
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Vocatives and @mentions address a player; third-person references do not. */
export function publicAddressees<T extends { name: string }>(text: string, players: T[]): T[] {
  const aliases = (p: T) => [p.name, p.name.split(' ')[0]];
  const tagged = players.filter((p) =>
    aliases(p).some((name) => new RegExp(`@${escape(name)}(?![\\p{L}\\p{N}_])`, 'iu').test(text)),
  );
  if (tagged.length) return tagged;
  // An opening address takes precedence over names mentioned later in the sentence.
  const opening = text
    .trim()
    .replace(/^(?:(?:hey|hi|hello|ok|okay|thanks|thank you)[,!]?\s+)+/i, '');
  const first = players.filter((p) => {
    const name = aliases(p).find((name) =>
      new RegExp(`^${escape(name)}(?![\\p{L}\\p{N}_])`, 'iu').test(opening),
    );
    return (
      name !== undefined &&
      !/^(?:['’]s|\s+(?:is|was|has|had|seems|said|says|told|keeps|does|looks|works|owns)\b)/iu.test(
        opening.slice(name.length),
      )
    );
  });
  if (first.length) {
    const head = opening.split(/[,:!?]/)[0];
    return players.filter(
      (p) =>
        first.includes(p) ||
        (/\band\b/i.test(head) &&
          aliases(p).some((name) => new RegExp(`\\band\\s+${escape(name)}$`, 'iu').test(head))),
    );
  }
  return players.filter((p) =>
    aliases(p).some(
      (name) =>
        new RegExp(`,\\s*${escape(name)}[.!?]*$`, 'iu').test(text) ||
        (/\b(?:you|your)\b/i.test(text) && new RegExp(`\\s${escape(name)}\\?+$`, 'iu').test(text)),
    ),
  );
}

export function mentionsName(text: string, name: string) {
  return words(text).includes(name.toLowerCase().split(' ')[0]);
}

/** Handle requests for silence locally, without asking a model to acknowledge them. */
export function isChatDismissal(text: string) {
  const t = text.toLowerCase().replace(/[’']/g, '');
  if (/\b(?:dont|do not|never) stop\b|\bhow (?:do|can) (?:i|we)\b/.test(t)) return false;
  return (
    /\b(?:sh+h+|shush|shut up|be quiet|keep quiet|stay quiet|enough for now|leave (?:me|us) alone)\b/.test(
      t,
    ) ||
    /\b(?:stop|quit) (?:sending (?:me |us )?messages|responding|replying|talking|chatting|interrupting)\b/.test(
      t,
    ) ||
    /\b(?:dont|do not) (?:reply|respond|interrupt)\b/.test(t) ||
    /\b(?:we|i) (?:dont|do not) need (?:any |your )?(?:help|input|advice) (?:right )?now\b/.test(
      t,
    ) ||
    /\byour (?:input|help|advice) (?:isnt|is not) (?:required|needed|wanted)\b/.test(t) ||
    /\bno need (?:for you )?to (?:reply|respond|comment)\b/.test(t)
  );
}

/** Acknowledgements close an implicit thread rather than purchasing another reply. */
export function isChatClosing(text: string) {
  return /^(?:(?:ok(?:ay)?|thanks|thank you|cheers|bye|goodbye|lol|lmao|haha|jeez|cool|got it|no thanks|all good|thats all|that is all|see you|talk later|o\/)\s*[,!.?]*)+$/i.test(
    text.trim().replace(/[’']/g, ''),
  );
}

export function chatWasDismissed(state: ResidentState, world: string, id?: number, to?: string) {
  const closed = state.dismissedChat;
  return !!(
    id &&
    closed?.world === world &&
    id <= (to ? (closed.privateThrough?.[to] ?? 0) : (closed.publicThrough ?? 0))
  );
}
