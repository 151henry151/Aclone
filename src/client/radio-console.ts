// SPDX-License-Identifier: GPL-3.0-or-later
import type { Action, Player, World } from '../shared/types';
import type { radioView } from '../shared/radio';
import { radioRules } from '../shared/radio-rules';
import { vehicleDef } from '../shared/vehicle-config';
import { MAX_CHAT_LENGTH } from '../shared/messages';
type View = ReturnType<typeof radioView>;
export interface RadioMessage {
  world: string;
  vehicle: number;
  view: View;
}
const esc = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
/** A stable dashboard: live carriers never replace inputs or a captured PTT button. */
export class RadioConsole {
  private message?: RadioMessage;
  private root?: HTMLElement;
  private world?: World;
  private player?: Player;
  private scope = '';
  private draft = '';
  private held = false;
  private error = '';
  private seen = 0;
  private log = '';
  constructor(
    private send: (action: Action) => void,
    private alert: (volume: number) => void,
  ) {}
  receive(message: RadioMessage) {
    this.message = message;
    this.refresh();
  }
  sync(world: World, player: Player) {
    this.world = world;
    this.player = player;
    const scope = `${world.id}:${player.id}:${player.vehicle}`;
    if (scope !== this.scope) {
      this.transmit(false);
      this.scope = scope;
      this.draft = '';
      this.error = '';
      this.seen = 0;
      this.log = '';
      if (this.root) this.input('text').value = '';
    }
    this.refresh();
  }
  reset() {
    this.transmit(false);
    this.message = undefined;
    this.scope = '';
    this.draft = '';
    this.seen = 0;
    this.refresh();
  }
  mount(root: HTMLElement) {
    this.root = root;
    root.innerHTML = `<p data-radio-vehicle class="eyebrow"></p><p data-radio-status role="status"></p><div class="radio-controls"><label>Channel<select data-radio="channel" aria-label="Channel"></select></label><label>Call sign<input data-radio="handle" aria-label="Call sign" autocomplete="off"></label><label>Volume<input data-radio="volume" aria-label="Volume" type="range" min="0" max="1" step="0.01"></label><label>Squelch<input data-radio="squelch" aria-label="Squelch" type="range" min="0" max="1" step="0.01"></label></div><p data-radio-keyed aria-live="off"></p><label>Radio message<textarea data-radio="text" aria-label="Radio message" rows="3" placeholder="Type a message, then hold the microphone"></textarea></label><button type="button" data-radio-ptt aria-pressed="false">Hold to transmit</button><p class="note">Hold T after typing, hold this button, or hold the controller radio trigger. Release to stop early. Volume controls the received-message tone. Squelch filters weak stations.</p><p data-radio-error role="alert"></p><h3>Received traffic</h3><div class="radio-log" role="log" aria-label="Received CB traffic" aria-live="polite" tabindex="0"></div>`;
    this.input('text').value = this.draft;
    this.log = '';
    root.addEventListener('input', (e) => {
      const el = e.target as HTMLInputElement;
      if (el.dataset.radio === 'text') {
        this.draft = el.value;
        this.refreshButton();
      }
    });
    root.addEventListener('change', (e) => {
      const el = e.target as HTMLInputElement;
      const op = el.dataset.radio;
      if (op && op !== 'text')
        this.send({
          type: 'radio',
          operation: op,
          value: op === 'handle' ? el.value : Number(el.value),
        });
    });
    const button = root.querySelector<HTMLButtonElement>('[data-radio-ptt]')!;
    button.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      button.focus();
      button.setPointerCapture(e.pointerId);
      this.transmit(true);
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
      button.addEventListener(event, () => this.transmit(false));
    button.addEventListener('keydown', (e) => {
      if ([' ', 'Enter'].includes(e.key)) {
        e.preventDefault();
        if (!e.repeat) this.transmit(true);
      }
    });
    button.addEventListener('keyup', (e) => {
      if ([' ', 'Enter'].includes(e.key)) {
        e.preventDefault();
        this.transmit(false);
      }
    });
    button.addEventListener('blur', () => this.transmit(false));
    this.refresh();
  }
  unmount() {
    this.transmit(false);
    this.root = undefined;
  }
  result(ok: boolean, message: string) {
    this.error = ok ? '' : message;
    if (!ok) this.held = false;
    this.refresh();
  }
  transmit(down: boolean) {
    if (down === this.held) return;
    if (down && (!this.root?.isConnected || !this.view()?.available || !this.draft.trim())) return;
    this.held = down;
    this.error = '';
    this.send(
      down
        ? { type: 'radio', operation: 'key', text: this.draft }
        : { type: 'radio', operation: 'release' },
    );
    this.refreshButton();
  }
  private view() {
    return this.message &&
      this.message.world === this.world?.id &&
      this.message.vehicle === this.player?.vehicle
      ? this.message.view
      : undefined;
  }
  private input(name: string) {
    return this.root!.querySelector<HTMLInputElement>(`[data-radio="${name}"]`)!;
  }
  private refreshButton() {
    if (!this.root) return;
    const b = this.root.querySelector<HTMLButtonElement>('[data-radio-ptt]')!;
    b.disabled = !this.view()?.available || !this.draft.trim();
    b.setAttribute('aria-pressed', String(this.held));
  }
  private refresh() {
    const view = this.view(),
      w = this.world,
      p = this.player;
    if (!view?.available) {
      this.transmit(false);
      this.draft = '';
      if (this.root) this.input('text').value = '';
    }
    if (view) {
      const newest = Math.max(0, ...view.traffic.map((e) => e.id));
      if (newest > this.seen) this.alert(view.config.volume);
      this.seen = newest;
    }
    const root = this.root;
    if (!root || !w || !p) return;
    const r = radioRules(w.settings),
      enabled = !!view?.available;
    root.querySelector('[data-radio-vehicle]')!.textContent = vehicleDef(w, p.vehicle).name;
    root.querySelector('[data-radio-status]')!.textContent = !r.radioEnabled
      ? 'CB radio is disabled in this world.'
      : !enabled
        ? 'Board a vehicle with an enabled radio.'
        : `Channel ${view!.config.channel} · Emergency ${r.radioEmergencyChannel} · Road ${r.radioDefaultChannel}`;
    const channel = this.input('channel') as unknown as HTMLSelectElement;
    if (channel.options.length !== r.radioChannelCount)
      channel.innerHTML = Array.from(
        { length: r.radioChannelCount },
        (_, i) => `<option value="${i + 1}">${i + 1}</option>`,
      ).join('');
    for (const key of ['channel', 'handle', 'volume', 'squelch'] as const) {
      const el = this.input(key);
      el.disabled = !enabled || this.held;
      if (view && document.activeElement !== el) el.value = String(view.config[key]);
    }
    this.input('handle').maxLength = r.radioHandleLength;
    this.input('text').maxLength = Math.min(r.radioMaxLength, MAX_CHAT_LENGTH);
    this.input('text').disabled = !enabled;
    root.querySelector('[data-radio-keyed]')!.textContent = view?.keyed.length
      ? view.keyed
          .map(
            (tx) =>
              `${tx.handle} · ${tx.remaining.toFixed(1)}s · signal ${Math.round(tx.strength * 100)}%`,
          )
          .join(' / ')
      : 'Channel quiet';
    root.querySelector('[data-radio-error]')!.textContent = this.error;
    const html =
      enabled && view!.traffic.length
        ? view!.traffic
            .map(
              (e) =>
                `<article><strong>${esc(e.handle)}</strong><small>Channel ${e.channel} · signal ${Math.round(e.strength * 100)}%</small><p>${esc(e.text)}</p>${e.rescue ? `<p>Vessel requests help near ${Math.round(e.rescue.x)}, ${Math.round(e.rescue.z)}.</p><button type="button" data-do="player" data-id="${esc(e.from)}">Open rescue options</button>` : ''}</article>`,
            )
            .join('')
        : '<p>No received traffic</p>';
    if (html !== this.log) {
      const log = root.querySelector<HTMLElement>('.radio-log')!;
      const bottom = log.scrollHeight - log.scrollTop - log.clientHeight < 8;
      log.innerHTML = html;
      if (bottom) log.scrollTop = log.scrollHeight;
      this.log = html;
    }
    this.refreshButton();
  }
}
