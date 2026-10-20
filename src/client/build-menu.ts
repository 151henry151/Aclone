// SPDX-License-Identifier: GPL-3.0-or-later
import { buildingArchitectures } from '../shared/building-architecture';
import {
  buildingStyles,
  buildingDesignQuote,
  sizesForBuilding,
  type BuildingSize,
} from '../shared/building-designs';
import { worldBuildings, worldItems, applyBuildingTemplate } from '../shared/world-catalogue';
import { constructionTerms } from '../shared/civics';
import { constructionSiteReason, foundationProfile } from '../shared/construction-site';
import { buildingBounds, buildingPlan } from '../shared/building-shapes';
import { waterworksSite } from '../shared/shoreline';
import { onFarmLand } from '../shared/farm-land';
import { makeBuilding, money } from '../shared/simulation';
import { roomCount } from '../shared/lodging';
import type { World, Player, Action } from '../shared/types';
import { BuildPreview } from './build-preview';
const esc = (s: unknown) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
interface Draft {
  kind: string;
  style: string;
  architecture: string;
  size: string;
  rotation: number;
}
const drafts = new Map<string, Draft>();
export function buildMenuHtml() {
  return `<p>Choose a design, review its materials and turn it before placing the foundation at your current position. Deliver materials afterwards; cancel an unfinished site for 75% of its base cash cost.</p>
  <div class="build-designer" data-build-designer>
    <div class="build-controls"><label>Building<select data-design="kind" aria-label="Building type"></select></label>
    <label>Architectural model<select data-design="architecture" aria-label="Architectural model"></select></label>
    <label><span data-finish-label>Surface finish</span><select data-design="style" aria-label="Surface finish"></select></label>
    <label>Building size<select data-design="size" aria-label="Building size"></select></label>
    <p data-design-description></p>
    <label>Rotation <output data-bearing></output><input data-design="rotation" aria-label="Building rotation" type="range" min="0" max="345" step="15"></label>
    <div class="button-row"><button type="button" data-turn="-15">↶ Rotate left</button><button type="button" data-turn="15">Rotate right ↷</button></div>
    <p class="note">0° faces south; 90° east; 180° north; 270° west. Rotation turns the building, not the camera.</p></div>
    <div><div class="build-preview" data-build-preview></div><canvas class="build-site" data-build-site width="440" height="190" aria-label="Site plan, north up"></canvas></div>
    <div class="build-estimate" data-build-estimate aria-live="polite"></div>
    <button type="button" class="primary" data-place-design>Place foundation</button>
  </div>`;
}
export function mountBuildMenu(
  host: HTMLElement,
  getState: () => { w: World; p: Player },
  place: (action: Action) => void,
) {
  const { w, p } = getState(),
    catalogue = worldBuildings(w);
  const key = w.id + ':' + p.id;
  const draft = drafts.get(key) ?? {
    kind: 'home',
    style: 'stone-gable',
    architecture: 'model-1',
    size: 'standard',
    rotation: 0,
  };
  drafts.set(key, draft);
  if (drafts.size > 32) drafts.delete(drafts.keys().next().value!);
  const control = (name: string) =>
    host.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-design="${name}"]`)!;
  const options = (name: string, values: { id: string; name: string }[]) => {
    control(name).innerHTML = values
      .map((v) => `<option value="${esc(v.id)}">${esc(v.name)}</option>`)
      .join('');
  };
  const available = Object.entries(catalogue).filter(([, d]) => d.tier <= w.tier);
  options(
    'kind',
    available.map(([id, d]) => ({ id, name: d.name })),
  );
  if (!available.some(([id]) => id === draft.kind)) draft.kind = available[0]?.[0] ?? '';
  control('kind').value = draft.kind;
  let preview: BuildPreview | undefined;
  try {
    preview = new BuildPreview(host.querySelector<HTMLElement>('[data-build-preview]')!);
  } catch {
    host.querySelector('[data-build-preview]')!.textContent =
      '3D preview unavailable on this device. Dimensions and site plan remain available below.';
  }
  let action: Action | undefined;
  function update(rebuild = true) {
    const { w, p } = getState(),
      def = worldBuildings(w)[draft.kind];
    const button = host.querySelector<HTMLButtonElement>('[data-place-design]')!;
    if (!def) {
      button.disabled = true;
      return;
    }
    const template = w.catalogue?.templates[draft.kind],
      kind = template?.base ?? draft.kind;
    const custom = !!template?.creatorModel;
    const models = buildingArchitectures(kind);
    if (!models.some((m) => m.id === draft.architecture)) draft.architecture = models[0]?.id ?? '';
    options('architecture', models);
    control('architecture').value = draft.architecture;
    control('architecture').disabled = custom;
    const styles = buildingStyles(kind, draft.architecture),
      sizes = sizesForBuilding(kind);
    if (!styles.some((s) => s.id === draft.style)) draft.style = styles[0].id;
    if (!sizes.some((s) => s.id === draft.size) || custom) draft.size = 'standard';
    host.querySelector('[data-finish-label]')!.textContent =
      kind === 'pickup' ? 'Container colour' : 'Surface finish';
    control('style').setAttribute(
      'aria-label',
      kind === 'pickup' ? 'Container colour' : 'Surface finish',
    );
    options('style', styles);
    options('size', [...sizes]);
    control('style').value = draft.style;
    control('size').value = draft.size;
    control('style').disabled = custom;
    control('size').disabled = custom || sizes.length === 1;
    control('rotation').value = String(draft.rotation);
    host.querySelector('[data-bearing]')!.textContent = `${draft.rotation}°`;
    host.querySelector('[data-design-description]')!.textContent = custom
      ? 'This world-created model uses its original design and material list.'
      : models.find((m) => m.id === draft.architecture)!.description +
        ' ' +
        styles.find((s) => s.id === draft.style)!.description;
    const q = buildingDesignQuote(
      kind,
      def,
      custom ? undefined : draft.style,
      draft.size,
      custom ? undefined : draft.architecture,
    );
    const b = makeBuilding('construction', kind, p.x, p.z);
    applyBuildingTemplate(w, b, draft.kind);
    b.architecture = custom ? undefined : draft.architecture;
    b.style = custom ? undefined : draft.style;
    b.size = draft.size as BuildingSize;
    b.rotation = (draft.rotation * Math.PI) / 180;
    b.capacity = q.capacity;
    const bounds = buildingBounds(buildingPlan(b));
    let refusal = '',
      tax = 0,
      taxName = 'No town tax';
    try {
      const terms = constructionTerms(w, p, draft.kind, p, q.price);
      tax = terms.tax;
      taxName = terms.town ? `${terms.town.name} construction tax` : taxName;
    } catch (error) {
      refusal = (error as Error).message;
    }
    refusal ||= constructionSiteReason(w, b) ?? '';
    b.foundationY = foundationProfile(w, b).level;
    if (w.buildings.some((o) => Math.hypot(o.x - p.x, o.z - p.z) <= 12))
      refusal ||= 'Too close to another building';
    if (onFarmLand(w, p.x, p.z, Math.max(bounds.width, bounds.depth) / 2))
      refusal ||= 'Construction would cover farmland';
    if (kind === 'waterworks' && !waterworksSite(w, p, b.rotation))
      refusal ||=
        'Rotate the intake toward water; the pump house needs dry shoreline ground with water within 10 metres behind it.';
    const home = ['home', 'warehouse'].includes(kind);
    const owned = w.buildings.filter(
      (o) => o.owner === p.id && ['home', 'warehouse'].includes(o.kind) === home,
    ).length;
    if (owned >= (home ? w.settings.maxHomes : w.settings.maxBuildings))
      refusal ||= 'Property limit reached';
    if (p.cash < q.price + tax) refusal ||= 'Not enough cash for the foundation and town tax';
    const currency = (n: number) => money(n, w.settings.denariiPerSheckle);
    host.querySelector('[data-build-estimate]')!.innerHTML =
      `<h3>${esc(def.name)}</h3><p>${bounds.width.toFixed(1)} × ${bounds.depth.toFixed(1)} m footprint · ${bounds.height.toFixed(1)} m high · <b>${q.capacity.toLocaleString()} storage per good</b>${roomCount(b) ? ` · ${roomCount(b)} guest rooms` : ''}</p>
    <p>Ground variation ${foundationProfile(w, b).rise.toFixed(2)}m; level plinth and entrance steps shown. Maximum accepted variation 2m.</p><p>Foundation: <b>${currency(q.price)}</b> + ${esc(taxName)}: ${currency(tax)} = <b>${currency(q.price + tax)}</b>. Materials are additional.</p>
    <ul class="build-materials">${Object.entries(q.materials)
      .map(
        ([item, n]) =>
          `<li><b>${n}</b> ${esc(worldItems(w)[item]?.name ?? item)} <small>(${p.inventory[item] ?? 0} carried)</small></li>`,
      )
      .join('')}</ul>
    <p class="note">Larger premises increase storage${roomCount(b) ? ' and guest rooms' : ''}; recipes and production speed stay the same. Farm fields are expanded separately. Doors and windows remain human-sized. Preview scale stays fixed for this building type across models, finishes and sizes.</p>
    <p role="status" class="${refusal ? 'build-refusal' : ''}">${esc(refusal || 'Site clear. Ready to place this design.')}</p>`;
    button.disabled = !!refusal;
    action = {
      type: 'construct',
      kind: draft.kind,
      rotation: b.rotation,
      ...(!custom
        ? { style: draft.style, size: draft.size, architecture: draft.architecture }
        : {}),
    };
    if (rebuild) preview?.show(b, w);
    const canvas = host.querySelector<HTMLCanvasElement>('[data-build-site]')!,
      ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#253c35';
    ctx.fillRect(0, 0, 440, 190);
    const range = Math.max(45, Math.max(bounds.width, bounds.depth) * 1.3),
      scale = 150 / range;
    const draw = (o: typeof b, color: string) => {
      ctx.save();
      ctx.translate(220 + (o.x - p.x) * scale, 95 + (o.z - p.z) * scale);
      ctx.rotate(-o.rotation);
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      const plan = buildingPlan(o);
      if (plan.apron) {
        ctx.globalAlpha = 0.18;
        ctx.fillRect(
          (plan.apron.x - plan.apron.radius) * scale,
          (plan.apron.z - plan.apron.radius) * scale,
          plan.apron.radius * 2 * scale,
          plan.apron.radius * 2 * scale,
        );
      }
      for (const v of [...plan.volumes, ...(plan.fixtures ?? [])]) {
        ctx.globalAlpha = 0.45;
        ctx.fillRect(
          (v.x - v.width / 2) * scale,
          (v.z - v.depth / 2) * scale,
          v.width * scale,
          v.depth * scale,
        );
        ctx.globalAlpha = 1;
        ctx.strokeRect(
          (v.x - v.width / 2) * scale,
          (v.z - v.depth / 2) * scale,
          v.width * scale,
          v.depth * scale,
        );
      }
      ctx.restore();
    };
    for (const o of w.buildings)
      if (Math.hypot(o.x - p.x, o.z - p.z) < range * 2) draw(o, '#a5b5a2');
    draw(b, refusal ? '#e49c78' : '#e5d088');
    ctx.strokeStyle = '#fff0ad';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(220, 95);
    ctx.lineTo(220 + Math.sin(b.rotation) * 26, 95 + Math.cos(b.rotation) * 26);
    ctx.stroke();
    ctx.fillStyle = '#e8e4cd';
    ctx.font = '13px sans-serif';
    ctx.fillText('N ↑ · site plan', 12, 20);
    ctx.fillText(
      `Foundation at ${Math.round(p.x)}, ${Math.round(p.z)} · ${draft.rotation}°`,
      12,
      178,
    );
  }
  const change = (event: Event) => {
    const el = event.target as HTMLInputElement,
      field = el.dataset.design;
    if (!field) return;
    if (field === 'rotation') draft.rotation = Number(el.value);
    else if (field === 'kind' || field === 'architecture' || field === 'style' || field === 'size')
      draft[field] = el.value;
    update();
  };
  const click = (event: Event) => {
    const el = (event.target as HTMLElement).closest<HTMLElement>('button');
    if (!el) return;
    if (el.dataset.turn) {
      draft.rotation = (draft.rotation + Number(el.dataset.turn) + 360) % 360;
      update();
    }
    if (el.hasAttribute('data-place-design')) {
      update(false);
      if (action && !(el as HTMLButtonElement).disabled) place(action);
    }
  };
  const input = (event: Event) => {
    if ((event.target as HTMLElement).dataset.design === 'rotation') change(event);
  };
  host.addEventListener('input', input);
  host.addEventListener('change', change);
  host.addEventListener('click', click);
  update();
  return () => {
    host.removeEventListener('input', input);
    host.removeEventListener('change', change);
    host.removeEventListener('click', click);
    preview?.dispose();
  };
}
