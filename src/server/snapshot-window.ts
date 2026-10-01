// SPDX-License-Identifier: GPL-3.0-or-later
/** At most three snapshots may be in transit. ACKs acknowledge cumulative delivery,
 * not gameplay authority. Skipped broadcasts never advance the delta baseline. */
export class SnapshotWindow {
  private sequence = 0;
  private acknowledged = 0;
  get ready() {
    return this.sequence - this.acknowledged < 3;
  }
  next() {
    return ++this.sequence;
  }
  ack(sequence: number) {
    if (Number.isSafeInteger(sequence) && sequence > this.acknowledged && sequence <= this.sequence)
      this.acknowledged = sequence;
  }
  reset() {
    this.acknowledged = this.sequence;
  }
}
