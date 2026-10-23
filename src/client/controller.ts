// SPDX-License-Identifier: GPL-3.0-or-later
import type { Input } from '../shared/types';
export const controllerDefaults = {
  steer: 0,
  throttle: 1,
  deadZone: 0.18,
  confirm: 0,
  back: 1,
  menu: 9,
  boost: 5,
};
export type ControllerBindings = typeof controllerDefaults;
export function controllerInput(
  pad: Pick<Gamepad, 'axes' | 'buttons'> | null,
  config = controllerDefaults,
): Input {
  const axis = (i: number) => {
    const v = pad?.axes[i] ?? 0;
    return Math.abs(v) < config.deadZone
      ? 0
      : Math.sign(v) * Math.min(1, (Math.abs(v) - config.deadZone) / (1 - config.deadZone));
  };
  return {
    steer: -axis(config.steer) || 0,
    throttle: -axis(config.throttle) || 0,
    boost: !!pad?.buttons[config.boost]?.pressed,
  };
}
export function aircraftControllerInput(
  pad: Pick<Gamepad, 'axes' | 'buttons'> | null,
  config = controllerDefaults,
): Input {
  const axis = (i: number) => {
    const v = pad?.axes[i] ?? 0;
    return Math.abs(v) < config.deadZone
      ? 0
      : Math.sign(v) * Math.min(1, (Math.abs(v) - config.deadZone) / (1 - config.deadZone));
  };
  return {
    throttle: -axis(config.throttle),
    steer: -axis(config.steer),
    boost: false,
    pitch: -axis(3),
    roll: -axis(2),
    brake: !!pad?.buttons[4]?.pressed,
  };
}
export class Controller {
  config = { ...controllerDefaults };
  flight: Input = { throttle: 0, steer: 0, boost: false };
  private previous = new Set<number>();
  private nextRepeat = 0;
  input: Input = { throttle: 0, steer: 0, boost: false };
  constructor(
    private onMenu: () => void,
    private onBack: () => void,
    private onInteract: () => void,
  ) {
    try {
      const saved = JSON.parse(localStorage.getItem('aclone.controller') ?? '{}');
      for (const k of Object.keys(this.config) as (keyof ControllerBindings)[])
        if (Number.isFinite(saved[k]))
          this.config[k] =
            k === 'deadZone'
              ? Math.max(0.05, Math.min(0.5, saved[k]))
              : Math.max(0, Math.min(15, Math.floor(saved[k])));
    } catch {
      /* Keep safe defaults. */
    }
  }
  save() {
    localStorage.setItem('aclone.controller', JSON.stringify(this.config));
  }
  poll(menu: boolean, now = performance.now()) {
    const pad = document.hidden
      ? null
      : (Array.from(navigator.getGamepads?.() ?? []).find((p) => p?.connected) ?? null);
    this.input = controllerInput(pad, this.config);
    this.flight = aircraftControllerInput(pad, this.config);
    const pressed = new Set(pad?.buttons.flatMap((b, i) => (b.pressed ? [i] : [])) ?? []);
    const edge = (i: number) => pressed.has(i) && !this.previous.has(i);
    if (edge(this.config.menu)) this.onMenu();
    if (edge(this.config.back)) this.onBack();
    if (menu) {
      const root = document.querySelector('#modal-host')!;
      const controls = Array.from(
        root.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href]'),
      ).filter((el) => !el.hasAttribute('disabled') && el.getClientRects().length);
      const current = document.activeElement as HTMLElement;
      const direction = pressed.has(12) ? -1 : pressed.has(13) ? 1 : 0;
      if (direction && (edge(12) || edge(13) || now >= this.nextRepeat)) {
        const index = controls.indexOf(current);
        controls[
          index < 0
            ? direction > 0
              ? 0
              : controls.length - 1
            : (index + direction + controls.length) % controls.length
        ]?.focus();
        this.nextRepeat = now + 220;
      }
      if (edge(14) || edge(15)) {
        const sign = edge(14) ? -1 : 1;
        if (current instanceof HTMLSelectElement) {
          current.selectedIndex = Math.max(
            0,
            Math.min(current.options.length - 1, current.selectedIndex + sign),
          );
          current.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (current instanceof HTMLInputElement && ['number', 'range'].includes(current.type)) {
          if (sign > 0) current.stepUp();
          else current.stepDown();
          current.dispatchEvent(new Event('input', { bubbles: true }));
          current.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      if (edge(this.config.confirm)) {
        const el = controls.includes(current) ? current : controls[0];
        el?.focus();
        if (el?.matches('button,a')) el.click();
      }
    } else if (edge(this.config.confirm)) this.onInteract();
    this.previous = pressed;
  }
}
