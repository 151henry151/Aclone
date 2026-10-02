// SPDX-License-Identifier: GPL-3.0-or-later
/** Session-only UI drafts. Live facts still rerender; only values the player
 * actually edited override defaults. Never retain passwords, keys or files. */
type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
type Value = { value: string; checked?: boolean; selected?: string[] };
type View = {
  fields: Map<string, Value>;
  scroll: [number, number][];
  focus?: string;
  selection?: [number | null, number | null];
};
export class PanelMemory {
  private views = new Map<string, View>();
  constructor(private host: HTMLElement) {
    for (const type of ['input', 'change'])
      host.addEventListener(type, (event) => this.remember(event.target));
  }
  clear() {
    this.views.clear();
  }
  private view(key: string) {
    let view = this.views.get(key);
    if (!view) {
      view = { fields: new Map(), scroll: [] };
      this.views.set(key, view);
      if (this.views.size > 64) this.views.delete(this.views.keys().next().value!);
    }
    return view;
  }
  private controls() {
    return [...this.host.querySelectorAll<Control>('input,select,textarea')];
  }
  private key(input: Control) {
    if (!input.name && !input.id) return;
    if (
      input instanceof HTMLInputElement &&
      ['hidden', 'password', 'file', 'submit', 'button'].includes(input.type)
    )
      return;
    if (/password|token|secret|pilot.?key|recovery.?key/i.test(input.name + ' ' + input.id)) return;
    const form = input.form;
    const identity = form
      ? [
          form.id,
          form.dataset.action,
          [...form.querySelectorAll<HTMLInputElement>('input[type=hidden]')]
            .filter((v) => !/token|secret|password/i.test(v.name))
            .map((v) => [v.name, v.value]),
          [...form.elements].map((v) => (v as HTMLInputElement).name).filter(Boolean),
        ]
      : [];
    const priceSelection =
      input.name === 'priceDenarii' && form?.hasAttribute('data-price-editor')
        ? ['item', 'side'].map((name) => (form.elements.namedItem(name) as HTMLSelectElement).value)
        : [];
    return JSON.stringify([
      identity,
      input.id || input.name,
      input.type === 'radio' ? input.value : '',
      priceSelection,
    ]);
  }
  private scrollers() {
    return [
      ...this.host.querySelectorAll<HTMLElement>(
        '.window,.trade-list,.directory,textarea,[data-preserve-scroll]',
      ),
    ];
  }
  private remember(target: EventTarget | null) {
    if (!(
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement
    ))
      return;
    const scope = this.host.dataset.viewKey;
    if (!scope) return;
    const view = this.view(scope);
    for (const input of target.type === 'radio'
      ? this.controls().filter(
          (c) => c.type === 'radio' && c.form === target.form && c.name === target.name,
        )
      : [target]) {
      const key = this.key(input);
      if (!key) continue;
      view.fields.set(key, {
        value: input.value,
        checked: input instanceof HTMLInputElement ? input.checked : undefined,
        selected:
          input instanceof HTMLSelectElement && input.multiple
            ? [...input.selectedOptions].map((o) => o.value)
            : undefined,
      });
      if (view.fields.size > 256) view.fields.delete(view.fields.keys().next().value!);
    }
  }
  capture() {
    const scope = this.host.dataset.viewKey;
    if (!scope || !this.host.firstElementChild) return;
    const view = this.view(scope);
    view.scroll = this.scrollers().map((el) => [el.scrollLeft, el.scrollTop]);
    const focused = this.controls().find((el) => el === document.activeElement);
    view.focus = focused && this.key(focused);
    view.selection =
      focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement
        ? [focused.selectionStart, focused.selectionEnd]
        : undefined;
  }
  restore(scope: string) {
    const sameView = this.host.dataset.viewKey === scope;
    this.host.dataset.viewKey = scope;
    const view = this.views.get(scope);
    if (!view) return;
    for (const input of this.controls()) {
      const key = this.key(input),
        value = key && view.fields.get(key);
      if (!value) continue;
      if (input instanceof HTMLSelectElement) {
        if (value.selected)
          for (const option of input.options)
            option.selected = value.selected.includes(option.value);
        else if ([...input.options].some((option) => option.value === value.value))
          input.value = value.value;
        else continue; // A removed crop/item is not a valid remembered choice.
      } else input.value = value.value;
      if (input instanceof HTMLInputElement && ['checkbox', 'radio'].includes(input.type))
        input.checked = !!value.checked;
      input.dataset.dirty = 'true';
      if (sameView && key === view.focus) {
        input.focus({ preventScroll: true });
        if (
          view.selection?.[0] !== null &&
          view.selection?.[0] !== undefined &&
          !(input instanceof HTMLSelectElement)
        )
          input.setSelectionRange(view.selection[0], view.selection[1]);
      }
    }
    this.scrollers().forEach((el, i) => {
      if (view.scroll[i]) {
        el.scrollLeft = view.scroll[i][0];
        el.scrollTop = view.scroll[i][1];
      }
    });
  }
}
