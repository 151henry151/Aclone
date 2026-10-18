// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from './types.ts';
export const MAX_CHAT_LENGTH = 1200;
type Message = World['messages'][number];
// Opt-in server buffer: preserve bursts between durable saves without growing
// the shared world snapshot or browser chat history.
const archives = new WeakMap<World, Message[]>();
export function pendingPublicMessages(w: World) {
  let pending = archives.get(w);
  if (!pending) {
    pending = [];
    archives.set(w, pending);
    w.messageSeq = Math.max(w.messageSeq ?? 0, ...w.messages.map((m) => m.id ?? 0));
    for (const message of w.messages) message.id ??= ++w.messageSeq;
    pending.push(...w.messages.filter((m) => !m.to));
  }
  return pending;
}
export function say(w: World, name: string, text: string, kind = 'system', to?: string) {
  w.messageSeq = (w.messageSeq ?? 0) + 1;
  w.messages.push({ id: w.messageSeq, name, text, kind, time: w.time, ...(to ? { to } : {}) });
  if (!to) archives.get(w)?.push(w.messages.at(-1)!);
  if (w.messages.length > 100) w.messages.shift();
}
