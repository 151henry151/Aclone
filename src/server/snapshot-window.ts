// SPDX-License-Identifier: GPL-3.0-or-later
/** At most three snapshots may be in transit. ACKs acknowledge cumulative delivery,
 * not gameplay authority. Skipped broadcasts never advance the delta baseline. */
export class SnapshotWindow {
  private sequence = 0;
  private acknowledged = 0;
  private baseline = 0;
  get ready() {
    // Do not queue obsolete deltas behind a potentially large world transfer.
    const limit = this.acknowledged > this.baseline ? 3 : 1;
    return this.sequence - this.acknowledged < limit;
  }
  next() {
    return ++this.sequence;
  }
  ack(sequence: number) {
    if (Number.isSafeInteger(sequence) && sequence > this.acknowledged && sequence <= this.sequence)
      this.acknowledged = sequence;
  }
  reset() {
    this.acknowledged = this.baseline = this.sequence;
  }
}
