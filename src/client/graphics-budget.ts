// SPDX-License-Identifier: GPL-3.0-or-later
/** Preserve fractional frame time, including the forced first render after warmup. */
export function pacedRenderTime(now: number, previous: number, interval: number) {
  const elapsed = now - previous;
  if (!Number.isFinite(elapsed) || elapsed < 0) return now;
  if (elapsed < interval) return undefined;
  return now - (elapsed % interval);
}

/** Sustained foreground frame pacing, not one shader compile or a hidden-tab gap. */
export class GraphicsBudget {
  private elapsed = 0;
  private frames = 0;
  private slowFrames = 0;
  reset() {
    this.elapsed = this.frames = this.slowFrames = 0;
  }
  observe(interval: number, active = true): boolean {
    if (!active || !Number.isFinite(interval) || interval <= 0 || interval > 2000) {
      this.reset();
      return false;
    }
    this.elapsed += interval;
    this.frames++;
    if (interval > 45) this.slowFrames++;
    if (this.elapsed < 2000 || this.frames < 8) return false;
    const slow = this.elapsed / this.frames > 45 && this.slowFrames / this.frames > 0.6;
    this.reset();
    return slow;
  }
}
