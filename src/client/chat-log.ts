// SPDX-License-Identifier: GPL-3.0-or-later
/** Preserve existing message nodes and the reader's position across snapshots.
 * The server supplies its bounded, privacy-filtered recent history. */
export class ChatLog {
  private world = '';
  private keys: string[] = [];
  constructor(
    private element: HTMLElement,
    private latest: HTMLButtonElement,
  ) {
    latest.addEventListener('click', () => {
      element.scrollTop = element.scrollHeight;
      latest.hidden = true;
    });
    element.addEventListener('scroll', () => {
      if (this.atBottom()) latest.hidden = true;
    });
  }
  private atBottom() {
    return this.element.scrollHeight - this.element.scrollTop - this.element.clientHeight < 12;
  }
  update(world: string, lines: string[]) {
    const reset = world !== this.world;
    if (!reset && lines.length === this.keys.length && lines.every((v, i) => v === this.keys[i]))
      return;
    const follow = reset || this.atBottom();
    const top = this.element.scrollTop;
    let removedHeight = 0;
    if (reset) {
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
    else this.element.scrollTop = Math.max(0, top - removedHeight);
    this.latest.hidden = follow;
  }
}
