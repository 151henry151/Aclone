/** Decides when the world has rendered smoothly long enough to hand over controls. */
export class FrameSettle {
  private start?: number;
  private smooth = 0;
  constructor(
    private readonly frames = 20,
    private readonly maxWait = 6000,
    private readonly minWait = 500,
  ) {}
  observe(now: number, interval: number, budget: number) {
    this.start ??= now;
    this.smooth = interval <= budget ? this.smooth + 1 : 0;
    const waited = now - this.start;
    return waited >= this.maxWait || (this.smooth >= this.frames && waited >= this.minWait);
  }
}
