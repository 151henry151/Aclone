// SPDX-License-Identifier: GPL-3.0-or-later
/** Preserve existing message nodes and the reader's position across snapshots.
 * The server supplies its bounded, privacy-filtered recent history. */
export class ChatLog {
  private world = '';
  private followOnReveal = false;
  private keys: string[] = [];
  constructor(
    private element: HTMLElement,
    private latest: HTMLButtonElement,
  ) {
    const panel = element.closest<HTMLElement>('.chat-panel') ?? element;
    panel.addEventListener(
      'wheel',
      (event) => {
        if (event.ctrlKey || event.metaKey) return; // Keep browser zoom/pinch gestures available.
        const line = parseFloat(getComputedStyle(element).lineHeight) || 18;
        // Firefox/system settings can report a whole page per wheel notch.
        // Keep every notch small enough to retain context in this compact HUD.
        const unit = event.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? 1 : line;
        const limit = Math.min(line * 3, Math.max(line, element.clientHeight / 3));
        this.scrollBy(Math.max(-limit, Math.min(limit, event.deltaY * unit)));
        // Consume the wheel even at the ends, including over the message input.
        event.preventDefault();
        event.stopPropagation();
      },
      { passive: false },
    );
    panel.addEventListener('keydown', (event) => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        !['PageUp', 'PageDown'].includes(event.key)
      )
        return;
      const line = parseFloat(getComputedStyle(element).lineHeight) || 18;
      this.scrollBy(
        (event.key === 'PageUp' ? -1 : 1) * Math.max(line, element.clientHeight - line * 3),
      );
      event.preventDefault();
      event.stopPropagation();
    });
    panel.addEventListener('pointerdown', () => this.stopScroll());
    panel.addEventListener('keydown', (event) => {
      if (event.key === 'Home' || event.key === 'End') this.stopScroll();
    });
    latest.addEventListener('click', () => {
      this.stopScroll();
      element.scrollTop = element.scrollHeight;
      latest.hidden = true;
    });
    element.addEventListener('scroll', () => {
      if (this.atBottom()) latest.hidden = true;
    });
  }
  private scrollTarget: number | undefined;
  private scrollFrame = 0;
  private stopScroll() {
    cancelAnimationFrame(this.scrollFrame);
    this.scrollFrame = 0;
    this.scrollTarget = undefined;
  }
  private scrollBy(delta: number) {
    const el = this.element;
    this.scrollTarget = Math.max(
      0,
      Math.min(el.scrollHeight - el.clientHeight, (this.scrollTarget ?? el.scrollTop) + delta),
    );
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.scrollTop = this.scrollTarget;
      this.stopScroll();
      return;
    }
    if (this.scrollFrame) return;
    let previous = performance.now();
    const frame = (now: number) => {
      this.scrollTarget = Math.max(
        0,
        Math.min(el.scrollHeight - el.clientHeight, this.scrollTarget!),
      );
      const remaining = this.scrollTarget! - el.scrollTop;
      if (Math.abs(remaining) < 1) {
        el.scrollTop = this.scrollTarget!;
        this.stopScroll();
        return;
      }
      const step = Math.abs(remaining) * (1 - Math.exp(-Math.min(64, now - previous) / 45));
      el.scrollTop += Math.sign(remaining) * Math.min(Math.abs(remaining), Math.max(1, step));
      previous = now;
      this.scrollFrame = requestAnimationFrame(frame);
    };
    this.scrollFrame = requestAnimationFrame(frame);
  }
  private atBottom() {
    return this.element.scrollHeight - this.element.scrollTop - this.element.clientHeight < 12;
  }
  update(world: string, lines: string[]) {
    // A hidden HUD has zero scroll dimensions. Defer only the initial/world-reset
    // jump until layout exists; subsequent updates retain deliberate scrollback.
    if (this.followOnReveal && this.element.clientHeight > 0) {
      this.element.scrollTop = this.element.scrollHeight;
      this.followOnReveal = false;
      this.latest.hidden = true;
    }
    const reset = world !== this.world;
    if (!reset && lines.length === this.keys.length && lines.every((v, i) => v === this.keys[i]))
      return;
    const follow = reset || (this.atBottom() && this.scrollTarget === undefined);
    const top = this.element.scrollTop;
    let removedHeight = 0;
    if (reset) {
      this.stopScroll();
      this.followOnReveal = this.element.clientHeight === 0;
      this.element.replaceChildren();
      this.keys = [];
    }
    // Match the previous suffix to the new prefix as the server's history ring rolls.
    let drop = 0;
    while (drop < this.keys.length && !this.keys.slice(drop).every((v, i) => lines[i] === v))
      drop++;
    for (let i = 0; i < drop; i++) {
      const first = this.element.firstElementChild as HTMLElement;
      removedHeight += first.getBoundingClientRect().height;
      first.remove();
    }
    for (const html of lines.slice(this.keys.length - drop))
      this.element.insertAdjacentHTML('beforeend', html);
    this.world = world;
    this.keys = lines;
    if (follow) this.element.scrollTop = this.element.scrollHeight;
    else {
      this.element.scrollTop = Math.max(0, top - removedHeight);
      if (this.scrollTarget !== undefined)
        this.scrollTarget = Math.max(
          0,
          Math.min(
            this.element.scrollHeight - this.element.clientHeight,
            this.scrollTarget - removedHeight,
          ),
        );
    }
    this.latest.hidden = follow;
  }
}
