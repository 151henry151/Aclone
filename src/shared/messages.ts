// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from './types.ts';
export const MAX_CHAT_LENGTH = 1200;
export function say(w: World, name: string, text: string, kind = 'system', to?: string) {
  w.messageSeq = (w.messageSeq ?? 0) + 1;
  w.messages.push({ id: w.messageSeq, name, text, kind, time: w.time, ...(to ? { to } : {}) });
  if (w.messages.length > 100) w.messages.shift();
}
