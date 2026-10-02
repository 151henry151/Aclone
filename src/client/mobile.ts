// SPDX-License-Identifier: GPL-3.0-or-later
import type { Input } from '../shared/types';

/** Phone-sized windows and touch tablets use the compact interface. Large/fine
 * pointer desktops retain their existing layout, controls and render settings. */
export const MOBILE_QUERY = '(max-width: 800px), (pointer: coarse) and (max-width: 1366px)';
const hold = (key: string, label: string, text: string) =>
  `<button type="button" data-hold="${key}" aria-label="${label}" aria-pressed="false">${text}</button>`;
export class MobileUI {
  active = false;
  drawer: 'chat' | 'status' | '' = '';
  private holds = new Map<number, { key: string; element: HTMLButtonElement }>();
  private taps = new Map<number, { button: HTMLButtonElement; x: number; y: number }>();
  private blocked = false;
  private seenWorld = '';
  private lastMessage = '';
  private unread = 0;
  private media = matchMedia(MOBILE_QUERY);
  constructor(
    private suspend: () => void,
    private fire: (phase: 'start' | 'end' | 'cancel') => void,
  ) {
    const hud = document.getElementById('world-hud')!;
    hud.insertAdjacentHTML(
      'beforeend',
      `<div class="mobile-only mobile-top"><button id="mobile-status" type="button" aria-expanded="false" aria-controls="mobile-status-panel"><span id="mobile-cash"></span><small id="mobile-vitals"></small></button></div><div class="mobile-only" id="mobile-target"></div><div class="mobile-only mobile-drive" aria-label="Touch driving controls"><div class="mobile-steering"><div class="drive-extras"><button type="button" data-do="horn" aria-label="Sound horn">Horn</button>${hold('boost', 'Hold to boost', 'Boost')}</div><div>${hold('left', 'Steer left', '◀')}${hold('right', 'Steer right', '▶')}</div></div><div class="mobile-pedals">${hold('forward', 'Accelerate or walk forward', '↑')}<span>DRIVE</span>${hold('reverse', 'Reverse or walk backward', '↓')}</div><div id="mobile-flight" hidden>${hold('up', 'Climb', 'Climb')}${hold('down', 'Descend', 'Descend')}</div><div id="mobile-combat" hidden>${hold('fire', 'Fire selected weapon; hold and release to throw a javelin', 'Fire')}</div></div><nav class="mobile-only mobile-nav" aria-label="Mobile game navigation"><button type="button" data-do="map">Map</button><button type="button" data-do="inventory">Bag</button><button type="button" id="mobile-chat" aria-expanded="false" aria-controls="mobile-chat-panel">Chat</button><button type="button" data-do="mobile-actions">Actions</button></nav><button type="button" class="mobile-only mobile-scrim" aria-label="Close mobile panel" hidden></button>`,
    );
    const chat = document.querySelector<HTMLElement>('.chat-panel')!;
    const status = document.querySelector<HTMLElement>('.status-panel')!;
    chat.id = 'mobile-chat-panel';
    status.id = 'mobile-status-panel';
    status.insertAdjacentHTML(
      'beforeend',
      '<p id="mobile-calendar" class="mobile-only"></p><p id="mobile-objective" class="mobile-only"></p>',
    );
    for (const [element, title] of [
      [chat, 'Parish chat'],
      [status, 'Pilot & parish'],
    ] as const) {
      element.insertAdjacentHTML(
        'afterbegin',
        `<header class="mobile-only mobile-sheet-header"><strong>${title}</strong><button type="button" data-mobile-close aria-label="Close ${title.toLowerCase()}">Done</button></header>`,
      );
    }
    document.getElementById('mobile-chat')!.onclick = () => this.open('chat');
    document.getElementById('mobile-status')!.onclick = () => this.open('status');
    for (const button of document.querySelectorAll<HTMLElement>(
      '[data-mobile-close], .mobile-scrim',
    )) {
      button.onclick = () => this.close();
      // Mobile browsers may suppress the compatibility click while stopping
      // momentum scrolling. A deliberate touch release still dismisses a sheet.
      let start: { id: number; x: number; y: number } | undefined;
      button.addEventListener('pointerdown', (e) => {
        start = { id: e.pointerId, x: e.clientX, y: e.clientY };
      });
      button.addEventListener('pointerup', (e) => {
        if (
          e.pointerType === 'touch' &&
          start?.id === e.pointerId &&
          Math.hypot(e.clientX - start.x, e.clientY - start.y) < 12
        ) {
          const drawer = this.drawer;
          // Let any compatibility click target this button before hiding it;
          // otherwise it can fall through to the HUD control underneath.
          setTimeout(() => {
            if (this.drawer === drawer) this.close();
          }, 0);
        }
        start = undefined;
      });
      button.addEventListener('pointercancel', () => {
        start = undefined;
      });
    }
    for (const b of document.querySelectorAll<HTMLButtonElement>('[data-hold]')) {
      b.addEventListener('pointerdown', (event) => {
        if (!this.active || this.blocked || this.drawer || b.disabled || event.button !== 0) return;
        event.preventDefault();
        if (b.dataset.hold === 'fire' && this.held('fire')) return;
        this.holds.set(event.pointerId, { key: b.dataset.hold!, element: b });
        b.setPointerCapture(event.pointerId);
        b.setAttribute('aria-pressed', 'true');
        if (b.dataset.hold === 'fire') this.fire('start');
      });
      b.addEventListener('pointerup', (e) => this.release(e.pointerId, false));
      b.addEventListener('pointercancel', (e) => this.release(e.pointerId, true));
      b.addEventListener('lostpointercapture', (e) => this.release(e.pointerId, true));
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    // A browser only creates a compatibility click for the primary finger.
    // Let the other thumb honk or open a menu while a driving finger stays down.
    const taps = this.taps;
    document.addEventListener('pointerdown', (e) => {
      if (!this.active || e.pointerType !== 'touch' || e.isPrimary) return;
      const button = (e.target as Element).closest<HTMLButtonElement>('button:not([data-hold])');
      if (button && !button.disabled) taps.set(e.pointerId, { button, x: e.clientX, y: e.clientY });
    });
    document.addEventListener('pointerup', (e) => {
      const tap = taps.get(e.pointerId);
      taps.delete(e.pointerId);
      if (
        tap &&
        !tap.button.disabled &&
        !tap.button.closest('[inert]') &&
        tap.button.getClientRects().length &&
        Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 12
      )
        tap.button.click();
    });
    document.addEventListener('pointercancel', (e) => taps.delete(e.pointerId));
    window.addEventListener('blur', () => this.reset());
    window.addEventListener('pagehide', () => this.reset());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.reset();
    });
    document.addEventListener('focusin', (e) => {
      if ((e.target as Element).matches('input,textarea,select')) this.reset();
    });
    const viewport = () => {
      const v = window.visualViewport;
      document.documentElement.style.setProperty(
        '--visible-height',
        `${v?.height ?? innerHeight}px`,
      );
      document.documentElement.style.setProperty('--visible-top', `${v?.offsetTop ?? 0}px`);
    };
    window.visualViewport?.addEventListener('resize', viewport);
    window.visualViewport?.addEventListener('scroll', viewport);
    window.addEventListener('resize', () => {
      this.reset();
      viewport();
    });
    const layout = () => {
      this.close();
      this.reset();
      this.active = this.media.matches;
      document.documentElement.classList.toggle('mobile-ui', this.active);
      const target = document.getElementById('target')!;
      if (this.active) document.getElementById('mobile-target')!.append(target);
      else chat.insertBefore(target, document.getElementById('npc-notice'));
      viewport();
    };
    this.media.addEventListener('change', layout);
    layout();
  }
  private held(key: string) {
    return [...this.holds.values()].some((v) => v.key === key);
  }
  private release(id: number, cancel: boolean) {
    const held = this.holds.get(id);
    if (!held) return;
    this.holds.delete(id);
    if (!this.held(held.key)) held.element.setAttribute('aria-pressed', 'false');
    if (held.element.hasPointerCapture(id)) held.element.releasePointerCapture(id);
    if (held.key === 'fire') this.fire(cancel ? 'cancel' : 'end');
  }
  reset() {
    this.taps.clear();
    for (const id of [...this.holds.keys()]) this.release(id, true);
  }
  setBlocked(value: boolean) {
    this.blocked = value;
    if (value) this.reset();
    document.documentElement.classList.toggle('mobile-modal', value);
  }
  input(): Input {
    const held = (key: string) => this.active && !this.blocked && !this.drawer && this.held(key);
    return {
      throttle: +held('forward') - +held('reverse'),
      steer: +held('left') - +held('right'),
      boost: held('boost'),
      lift: +held('up') - +held('down'),
    };
  }
  open(drawer: 'chat' | 'status') {
    if (!this.active) return;
    this.close();
    this.drawer = drawer;
    this.suspend();
    document.documentElement.classList.add(`mobile-${drawer}-open`);
    document.querySelector<HTMLButtonElement>('.mobile-scrim')!.hidden = false;
    document.getElementById(`mobile-${drawer}`)!.setAttribute('aria-expanded', 'true');
    (document.querySelector('.brand') as HTMLElement).inert = true;
    const surface = document.getElementById(`mobile-${drawer}-panel`)!;
    surface.setAttribute('role', 'dialog');
    surface.setAttribute('aria-modal', 'true');
    surface.setAttribute('aria-label', drawer === 'chat' ? 'Parish chat' : 'Pilot status');
    for (const child of document.getElementById('world-hud')!.children)
      (child as HTMLElement).inert = child !== surface && !child.classList.contains('mobile-scrim');
    if (drawer === 'chat') {
      const log = document.getElementById('chat-log')!;
      if (this.unread || !log.scrollTop) log.scrollTop = log.scrollHeight;
      this.unread = 0;
      document.getElementById('mobile-chat')!.textContent = 'Chat';
      // Opening the history does not summon the keyboard. Tap the input to type.
    }
    document
      .querySelector<HTMLElement>(`#mobile-${drawer}-panel [data-mobile-close]`)!
      .focus({ preventScroll: true });
  }
  close() {
    (document.querySelector('.brand') as HTMLElement).inert = false;
    if (this.drawer) {
      const input = document.querySelector<HTMLElement>(`#mobile-${this.drawer}-panel :focus`);
      input?.blur();
      document.getElementById(`mobile-${this.drawer}`)!.setAttribute('aria-expanded', 'false');
    }
    for (const child of document.getElementById('world-hud')!.children)
      (child as HTMLElement).inert = false;
    for (const selector of ['.chat-panel', '.status-panel']) {
      const surface = document.querySelector(selector)!;
      for (const attribute of ['role', 'aria-modal', 'aria-label'])
        surface.removeAttribute(attribute);
    }
    this.drawer = '';
    this.reset();
    document.documentElement.classList.remove('mobile-chat-open', 'mobile-status-open');
    document.querySelector<HTMLButtonElement>('.mobile-scrim')!.hidden = true;
  }
  messages(world: string, signature: string) {
    if (world !== this.seenWorld) {
      this.unread = 0;
      this.seenWorld = world;
    } else if (signature && signature !== this.lastMessage && this.drawer !== 'chat')
      this.unread = Math.min(99, this.unread + 1);
    this.lastMessage = signature;
    document.getElementById('mobile-chat')!.textContent = this.unread
      ? `Chat · ${this.unread}`
      : 'Chat';
  }
}
