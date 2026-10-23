// SPDX-License-Identifier: GPL-3.0-or-later
import { appearance, vehiclePaint, tractorPaint, paintableVehicle } from '../shared/appearance';
import { vehicles } from '../shared/catalog';
import { tractorSlots, tractorRoles, returnTractor } from '../shared/tractors';
import { carry, money } from '../shared/simulation';
import type { Player, World, Building } from '../shared/types';
import { TractorPreview } from './tractor-preview';
import { refreshActionVisibility } from './action-visibility';
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function vehiclePaintShop(w: World, p: Player, b: Building, slot: number) {
  if (!paintableVehicle(slot) || !(p.fleet ?? [0, 5]).includes(slot)) return '';
  const finish = tractorPaint(vehiclePaint(p, slot));
  const near = Math.hypot(p.x - b.x, p.z - b.z) < 18;
  return `<section class="vehicle-paint-shop"><h3>Paint ${esc(vehicles[slot].name)}</h3><p>Finish: ${esc(finish?.name ?? 'Factory colour')}. A repaint costs ${money(appearance.paintPrice, w.settings.denariiPerSheckle)} and changes only this machine. Its colour is saved when you switch vehicles or sign out.</p><div class="paint-options">${appearance.paints.map((c) => `<button data-do="paint" data-id="${c.id}" data-vehicle="${slot}" data-building="${esc(b.id)}" ${!near || p.cash < appearance.paintPrice || finish?.id === c.id ? 'disabled' : ''}><span class="paint-chip" style="background:${c.color}"></span>${esc(c.name)}</button>`).join('')}</div></section>`;
}
export function tractorShopHtml() {
  return `<section class="tractor-shop"><h3>Parish Motor Works</h3><p>Six machines, six different jobs. Compare before buying. Drag the preview to inspect it; every model is shown at the same scale.</p><label>Tractor model<select id="tractor-choice">${tractorSlots.map((s) => `<option value="${s}">${esc(vehicles[s].name)} — ${esc(tractorRoles[s].role)}</option>`).join('')}</select></label><div id="tractor-preview"></div><div id="tractor-specs" aria-live="polite"></div></section>`;
}
export function mountTractorShop(host: HTMLElement, w: World, p: Player, b: Building) {
  const select = host.querySelector<HTMLSelectElement>('#tractor-choice'),
    previewHost = host.querySelector<HTMLElement>('#tractor-preview');
  if (!select || !previewHost) return;
  if (select.dataset.dirty !== 'true') select.value = String(returnTractor(p));
  let preview: TractorPreview | undefined;
  try {
    preview = new TractorPreview(previewHost);
  } catch {
    previewHost.textContent = '3D preview unavailable. Specifications and purchases still work.';
  }
  const update = () => {
    const slot = Number(select.value),
      base = vehicles[slot],
      v = { ...base, ...w.vehicleTuning?.[slot] },
      role = tractorRoles[slot];
    const owned = (p.fleet ?? [0, 5]).includes(slot),
      current = p.vehicle === slot;
    const reason =
      carry(p, w) > v.capacity
        ? 'Unload cargo before choosing this tractor.'
        : !owned && p.cash < base.price
          ? 'Not enough cash.'
          : '';
    host.querySelector('#tractor-specs')!.innerHTML =
      `<h4>${esc(base.name)} · ${esc(role.role)}</h4><p>${esc(role.description)}</p><p><strong>Trade-off:</strong> ${esc(role.tradeoff)}</p><dl class="tractor-specs"><div><dt>Cargo</dt><dd>${v.capacity} weight</dd></div><div><dt>Road speed / boost</dt><dd>${(v.speed * 2.237).toFixed(1)} / ${(v.speed * 1.7 * 2.237).toFixed(1)} mph</dd></div><div><dt>Tank</dt><dd>${v.tank ?? 64} units</dd></div><div><dt>Fuel at cruise</dt><dd>${(v.fuel * 3600).toFixed(1)} units/hour</dd></div><div><dt>Steering</dt><dd>${v.turn.toFixed(2)} rad/s</dd></div><div><dt>Headlight output</dt><dd>${Math.round(((v.headlight ?? 150) / 150) * 100)}% of classic</dd></div><div><dt>Headlight reach</dt><dd>${v.lightRange ?? 110} m</dd></div><div><dt>Surface penalty recovered</dt><dd>${Math.round((v.traction ?? 0) * 100)}%</dd></div><div><dt>Price</dt><dd>${slot === 0 ? 'Starter machine' : money(base.price, w.settings.denariiPerSheckle)}</dd></div></dl><p class="note">Speeds are healthy-vehicle limits on dry level roads. Cargo is shared carried inventory, not extra storage. New machines have empty tanks; parked fuel and maintenance condition remain with each machine. One Fuel adds 8 tank units. Owned tractors can be recalled outside; purchasing requires this garage.</p><button data-do="vehicle" data-id="${slot}" data-building="${esc(b.id)}" ${current || reason ? 'disabled' : ''}>${current ? 'Currently driving' : owned ? 'Drive this tractor' : 'Buy ' + esc(base.name)}</button><p>${esc(reason)}</p>`;
    host
      .querySelector('#tractor-specs')!
      .insertAdjacentHTML(
        'beforeend',
        owned
          ? vehiclePaintShop(w, p, b, slot)
          : '<p>Buy this machine to choose its own paint colour.</p>',
      );
    preview?.show(slot, owned ? tractorPaint(vehiclePaint(p, slot))?.color : undefined);
    refreshActionVisibility(host, w, p);
  };
  select.addEventListener('change', update);
  update();
  return () => {
    select.removeEventListener('change', update);
    preview?.dispose();
  };
}
