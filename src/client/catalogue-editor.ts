// SPDX-License-Identifier: GPL-3.0-or-later
import {
  catalogueSchema,
  worldItems,
  worldSkills,
  productionDiagnostics,
} from '../shared/world-catalogue';
import type { World, Building, Action } from '../shared/types';
import { recipes } from '../shared/catalog';
import { money } from '../shared/simulation';
const esc = (v: unknown) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const input = (label: string, name: string, value: unknown, type = 'text', extra = '') =>
  `<label>${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
export function catalogueEditor(w: World, itemId: string, skillId: string) {
  const c = w.catalogue ?? catalogueSchema.parse({}),
    item = c.items[itemId],
    skill = c.skills[skillId];
  return `<p>World-local definitions use IDs such as <code>custom:herbal_tea</code>. Standard goods and professions are unchanged. Prices use denarii here. Definitions in use cannot be removed. Changing weight or benefits affects existing stock.</p><h3>Goods</h3><div class="button-row"><button data-do="creator:catalogueItem" data-id="">New item</button>${Object.entries(
    c.items,
  )
    .map(
      ([id, i]) =>
        `<button data-do="creator:catalogueItem" data-id="${esc(id)}">${esc(i.icon)} ${esc(i.name)}</button>`,
    )
    .join(
      '',
    )}</div><form id="creator-catalogue-item-form">${input('Stable ID', 'definitionId', itemId || 'custom:herbal_tea', 'text', item ? 'readonly' : '')}${input('Name', 'name', item?.name ?? 'Herbal tea')}${input('Icon (short text or emoji)', 'icon', item?.icon ?? '🍵', 'text', 'maxlength="8"')}${input('Cargo weight', 'weight', item?.weight ?? 1, 'number', 'min="1" max="1000"')}${input('Reference price in denarii', 'price', (item?.price ?? 1000) / 100, 'number', 'min="0.01" max="10000" step="0.01"')}${input('Food relief', 'food', item?.food ?? 0, 'number', 'min="0" max="50000"')}${input('Thirst relief', 'drink', item?.drink ?? 0, 'number', 'min="0" max="50000"')}${input('Fuel units', 'fuel', item?.fuel ?? 0, 'number', 'min="0" max="64"')}<button>Save item</button></form>${item ? `<button data-do="creator:deleteCatalogueItem" data-id="${esc(itemId)}">Remove item</button>` : ''}<h3>Professions</h3><div class="button-row"><button data-do="creator:catalogueSkill" data-id="">New profession</button>${Object.entries(
    c.skills,
  )
    .map(
      ([id, s]) =>
        `<button data-do="creator:catalogueSkill" data-id="${esc(id)}">${esc(s.name)}</button>`,
    )
    .join(
      '',
    )}</div><form id="creator-catalogue-skill-form">${input('Stable ID', 'definitionId', skillId || 'custom:tea_blender', 'text', skill ? 'readonly' : '')}${input('Profession name', 'name', skill?.name ?? 'Tea blender')}${input('Tuition in denarii', 'price', (skill?.price ?? 10000) / 100, 'number', 'min="0" max="10000" step="0.01"')}${input('Lesson seconds', 'seconds', skill?.seconds ?? 300, 'number', 'min="1" max="86400"')}<details><summary>Prerequisite qualifications (up to eight)</summary>${worldSkills(
    w,
  )
    .filter((id) => id !== skillId)
    .map(
      (id) =>
        `<label class="check"><input type="checkbox" name="prerequisite" value="${esc(id)}" ${skill?.prerequisites.includes(id) ? 'checked' : ''}>${esc(c.skills[id]?.name ?? id)}</label>`,
    )
    .join(
      '',
    )}</details><button>Save profession</button></form>${skill ? `<button data-do="creator:deleteCatalogueSkill" data-id="${esc(skillId)}">Remove profession</button>` : ''}`;
}
export function catalogueForm(w: World, form: HTMLFormElement): Action {
  const c = structuredClone(w.catalogue ?? catalogueSchema.parse({})),
    d = new FormData(form),
    str = (k: string) => String(d.get(k) ?? ''),
    num = (k: string) => Number(d.get(k));
  if (form.id === 'creator-catalogue-template-form') {
    const b = w.buildings.find((b) => b.id === str('source')),
      prior = c.templates[str('definitionId')];
    if (!b && !prior) throw Error('Select a source building');
    const source = b
      ? {
          base: b.kind,
          buy: { ...b.buy },
          sell: { ...b.sell },
          production: b.production ?? (b.recipe ? recipes[b.recipe] : undefined),
          creatorModel: b.creatorModel,
        }
      : prior;
    c.templates[str('definitionId')] = {
      ...source,
      name: str('name'),
      base: source.base,
      price: Math.round(num('price') * 100),
      wage: Math.round(num('wage') * 100),
      materials: Object.fromEntries(
        Array.from({ length: 8 }, (_, i) => [str(`material${i}`), num(`quantity${i}`)]).filter(
          ([id]) => id,
        ),
      ),
    };
  } else if (form.id === 'creator-catalogue-item-form')
    c.items[str('definitionId')] = {
      name: str('name'),
      icon: str('icon'),
      weight: num('weight'),
      price: Math.round(num('price') * 100),
      food: num('food'),
      drink: num('drink'),
      fuel: num('fuel'),
    };
  else
    c.skills[str('definitionId')] = {
      name: str('name'),
      price: Math.round(num('price') * 100),
      seconds: num('seconds'),
      prerequisites: d.getAll('prerequisite').map(String),
    };
  return { type: 'catalogue', catalogue: c };
}
export function diagnosticsHtml(w: World, b: Building) {
  const d = productionDiagnostics(w, b),
    defs = worldItems(w);
  const signed = (n: number) =>
    (n < 0 ? '−' : '') + money(Math.abs(n), w.settings.denariiPerSheckle);
  return `<section class="notice"><h3>Production chain check</h3><p>One batch: output sales ${signed(d.outputValue)} − materials ${signed(d.materials)} − wages ${signed(d.wages)} − sales tax ${signed(d.tax)} = <strong>${signed(d.margin)}</strong>.</p><p>Uses current input bids, output asks and at least one worker. Travel, idle time, repairs and unsold goods still cost money. Missing bids use reference values.</p>${d.margin <= 0 ? '<p>⚠ This recipe does not cover the listed batch costs.</p>' : ''}${d.inputs
    .map(
      (i) =>
        `<p><strong>${i.quantity} ${esc(defs[i.item]?.name ?? i.item)}</strong> · ${i.bid === undefined ? '⚠ No buying price is set.' : 'Your bid: ' + signed(i.bid)}<br>${
          i.suppliers.length
            ? i.suppliers
                .slice(0, 8)
                .map(
                  (s) =>
                    `${esc(s.name)}: ${signed(s.price)} (${s.stock} stocked)${i.bid !== undefined && s.price > i.bid ? ' · above your bid' : ''}`,
                )
                .join('<br>')
            : '⚠ No local supplier sells this input.'
        }</p>`,
    )
    .join('')}</section>`;
}

export function templatesEditor(w: World, id: string) {
  const c = w.catalogue ?? catalogueSchema.parse({}),
    t = c.templates[id],
    defs = worldItems(w);

  return `<p>Save an economic building design for players to construct. A source building supplies its base type, recipe, shop quotes and visual model. Set the price, wages and construction materials below. Updates affect future buildings; existing buildings keep their settings.</p><div class="button-row"><button data-do="creator:template" data-id="">New template</button>${Object.entries(
    c.templates,
  )
    .map(
      ([id, t]) =>
        `<button data-do="creator:template" data-id="${esc(id)}">${esc(t.name)}</button>`,
    )
    .join(
      '',
    )}</div><form id="creator-catalogue-template-form">${input('Stable ID', 'definitionId', id || 'custom:tea_house', 'text', t ? 'readonly' : '')}${input('Name', 'name', t?.name ?? 'Tea house')}<label>Copy from building<select name="source">${t ? '<option value="">Keep current template recipe and quotes</option>' : ''}${w.buildings.map((b) => `<option value="${esc(b.id)}">${esc(b.name)}</option>`).join('')}</select></label>${input('Construction price in denarii', 'price', (t?.price ?? 100000) / 100, 'number', 'min="0.01" max="1000000" step="0.01"')}${input('Wage in denarii', 'wage', (t?.wage ?? 1000) / 100, 'number', 'min="0" max="10000" step="0.01"')}<h3>Construction materials</h3>${Array.from(
    { length: 8 },
    (_, i) => {
      const entry = Object.entries(t?.materials ?? { wood: 10 })[i];
      return `<div class="settings-grid"><label>Material ${i + 1}<select name="material${i}"><option value="">Unused</option>${Object.entries(
        defs,
      )
        .map(
          ([id, d]) =>
            `<option value="${esc(id)}" ${id === entry?.[0] ? 'selected' : ''}>${esc(d.name)}</option>`,
        )
        .join(
          '',
        )}</select></label>${input('Quantity', `quantity${i}`, entry?.[1] ?? 1, 'number', 'min="1" max="1000000"')}</div>`;
    },
  ).join(
    '',
  )}<button>Save building template</button></form>${t ? `<button data-do="creator:deleteTemplate" data-id="${esc(id)}">Remove template</button>` : ''}`;
}
