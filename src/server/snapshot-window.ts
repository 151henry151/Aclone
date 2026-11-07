// SPDX-License-Identifier: GPL-3.0-or-later
/** At most three snapshots may be in transit. ACKs acknowledge cumulative delivery,
 * not gameplay authority. Skipped broadcasts never advance the delta baseline. */
export class SnapshotWindow {
  private sequence = 0;
  private acknowledged = 0;
  private baseline = 0;
  private slow = false;
  private sent = new Map<number, number>();
  get ready() {
    // Do not queue obsolete deltas behind a potentially large world transfer.
    const limit = this.acknowledged > this.baseline && !this.slow ? 3 : 1;
    return this.sequence - this.acknowledged < limit;
  }
  next(now = performance.now()) {
    this.sent.set(++this.sequence, now);
    return this.sequence;
  }
  ack(sequence: number, now = performance.now()) {
    if (
      Number.isSafeInteger(sequence) &&
      sequence > this.acknowledged &&
      sequence <= this.sequence
    ) {
      const at = this.sent.get(sequence);
      // A half-second delivery already exhausts local prediction's fresh-state
      // horizon. Keep one fresh update in flight instead of a queue of old ones.
      if (at !== undefined) this.slow = now - at > 500;
      this.acknowledged = sequence;
      for (const key of this.sent.keys()) if (key <= sequence) this.sent.delete(key);
    }
  }
  reset() {
    this.acknowledged = this.baseline = this.sequence;
    this.sent.clear();
    this.slow = false;
  }
}
