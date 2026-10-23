// SPDX-License-Identifier: GPL-3.0-or-later
import type { Input } from '../shared/types';
/** Send changes on the next 50 ms poll, with small heartbeats while driving.
 * Never queue a history of obsolete controls behind a blocked upload. */
export class InputStream {
  sequence = 0;
  private previous = '';
  private sentAt = -Infinity;
  encode(input: Input, now: number, bufferedAmount: number): string | undefined {
    if (bufferedAmount > 0) return;
    const value = JSON.stringify(input);
    const active =
      input.throttle !== 0 ||
      input.steer !== 0 ||
      !!input.lift ||
      input.boost ||
      !!input.pitch ||
      !!input.roll ||
      !!input.brake;
    if (value === this.previous && now - this.sentAt < (active ? 100 : 1000)) return;
    this.previous = value;
    this.sentAt = now;
    return JSON.stringify({ type: 'input', sequence: ++this.sequence, input });
  }
}
