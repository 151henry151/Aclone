// SPDX-License-Identifier: GPL-3.0-or-later
/** Network deltas must all be merged/acknowledged, but only the newest merged
 * state needs expensive scene/HUD presentation. Hidden windows retain one item. */
export class FrameInbox<T> {
  private pending?: T;
  private frame?: number;
  private active = true;
  constructor(
    private present: (value: T) => void,
    private schedule = (fn: () => void) => requestAnimationFrame(fn),
    private cancel = (id: number) => cancelAnimationFrame(id),
  ) {}
  push(value: T) {
    this.pending = value;
    this.request();
  }
  setActive(active: boolean) {
    this.active = active;
    if (!active && this.frame !== undefined) {
      this.cancel(this.frame);
      this.frame = undefined;
    }
    this.request();
  }
  clear() {
    this.pending = undefined;
    if (this.frame !== undefined) this.cancel(this.frame);
    this.frame = undefined;
  }
  private request() {
    if (!this.active || this.frame !== undefined || this.pending === undefined) return;
    this.frame = this.schedule(() => {
      this.frame = undefined;
      const value = this.pending;
      this.pending = undefined;
      if (value !== undefined) this.present(value);
    });
  }
}
