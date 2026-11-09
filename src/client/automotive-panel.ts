import { automotiveExportQuote } from '../shared/automotive-exports';
import { automotivePrice } from '../shared/automotive-sales';
import { HIGHWAY_TRACTOR } from '../shared/highway-definitions';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { Action, Building, Player, Stock, World } from '../shared/types';
import {
  automotiveConfig,
  automotiveProducts,
  type AutomotiveProduct,
} from '../shared/automotive-config';
import { worldItems, worldSkills } from '../shared/world-catalogue';
import { factoryIdealEmployees } from '../shared/staffing';
import { money } from '../shared/simulation';
const esc = (v: unknown) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const hidden = (name: string, value: string) =>
  `<input type="hidden" name="${name}" value="${esc(value)}">`;
const field = (
  label: string,
  name: string,
  value: number,
  min: number,
  max: number,
  step: number | 'any' = 1,
) =>
  `<label>${label}<input type="number" name="${name}" value="${value}" min="${min}" max="${max}" step="${step}" required></label>`;
export function manufacturingPanel(w: World, p: Player, b: Building) {
  const r = automotiveConfig(w),
    state = b.manufacturing,
    defs = worldItems(w),
    owner = b.owner === p.id;
  const cash = (n: number) => money(n, w.settings.denariiPerSheckle);
  const reserved = (state?.orders ?? []).reduce((n, o) => n + o.payroll, 0);
  const full = (state?.orders.length ?? 0) + (state?.ready.length ?? 0) >= r.factory.readyCapacity;
  const near = Math.hypot(p.x - b.x, p.z - b.z) < r.delivery.range;
  const stock = (input: Stock) =>
    Object.entries(input)
      .map(([id, n]) => `${n} ${esc(defs[id]?.name ?? id)}`)
      .join(', ');
  return `<h3>Vehicle assembly</h3><p>One assembly line; ${state?.ready.length ?? 0} ready and ${state?.orders.length ?? 0} reserved out of ${r.factory.readyCapacity} vehicle places. Reserved payroll: ${cash(reserved)}. Inputs and maximum crew payroll leave the available stockroom/till when you queue an order. Qualified staff must do the work; unattended time does not count.</p>${!r.enabled ? '<p class="notice">Manufacturing is disabled in this world. Reserved work is paused.</p>' : ''}<h4>Assembly orders</h4>${state?.orders.length ? `<ul>${state.orders.map((o, i) => `<li>${esc(r.products[o.product].name)} · ${Math.floor((o.worked / o.seconds) * 100)}% · ${i ? 'Waiting for assembly line' : (b.staffing?.active ?? 0) > 0 ? 'Qualified crew working' : 'Waiting for qualified staff'}${owner && o.worked === 0 ? `<form data-action="manufacturing">${hidden('building', b.id)}${hidden('op', 'cancel')}${hidden('order', o.id)}<button>Cancel untouched order</button></form>` : ''}</li>`).join('')}</ul>` : '<p>No assembly orders.</p>'}<h4>Completed vehicles</h4>${
    state?.ready.length
      ? `<ul>${state.ready
          .map((v) => {
            const price = automotivePrice(w, b, v.product);
            const reason = !near
              ? 'Move closer'
              : !r.enabled
                ? 'Manufacturing disabled'
                : b.construction
                  ? 'Finish construction'
                  : price === null
                    ? 'Closed for sale'
                    : p.cash < price
                      ? 'Not enough cash'
                      : v.product === 'tractor' && p.fleet?.includes(HIGHWAY_TRACTOR)
                        ? 'Already owned'
                        : '';
            return `<li>Ready: ${esc(r.products[v.product].name)} · ${price === null ? 'Sales closed' : cash(price)}<form data-action="manufacturing">${hidden('building', b.id)}${hidden('op', 'buy')}${hidden('unit', v.id)}${hidden('expectedPrice', String(price ?? 0))}<button ${reason ? 'disabled' : ''}>Buy ${esc(r.products[v.product].name)}</button><span class="note">${esc(reason || 'Delivered to a clear place outside; no free fuel.')}</span></form></li>`;
          })
          .join('')}</ul>`
      : '<p>No completed vehicles. Every unit must be manufactured.</p>'
  }${owner ? exportPanel(w, b, near) : ''}<div class="menu-grid">${automotiveProducts
    .map((id) => {
      const product = r.products[id];
      const missing = Object.entries(product.inputs).filter(
        ([item, n]) => (b.stock[item] ?? 0) < n,
      );
      const reason = !near
        ? 'Move closer'
        : !r.enabled
          ? 'Manufacturing disabled'
          : full
            ? 'Vehicle storage full'
            : b.condition <= 0
              ? 'Repair the factory'
              : missing.length
                ? 'Needs ' + stock(Object.fromEntries(missing))
                : b.investment < b.wage * factoryIdealEmployees(w, b)
                  ? 'Fund payroll: ' + cash(b.wage * factoryIdealEmployees(w, b))
                  : '';
      return `<section><h4>${esc(product.name)}</h4><p>${stock(product.inputs)} · ${product.seconds / 60} fully staffed minutes · sale price ${cash(product.price)}</p>${owner ? `<form data-action="manufacturing">${hidden('building', b.id)}${hidden('op', 'queue')}${hidden('product', id)}<button ${reason ? 'disabled' : ''}>Queue ${esc(product.name)}</button><p class="note">${esc(reason || 'Inputs and payroll available')}</p></form>` : ''}</section>`;
    })
    .join('')}</div>${
    owner
      ? `<details><summary>Factory vehicle sale prices</summary><p>These are this business’s posted prices, including sales tax. Owners also pay into the business when collecting a unit.</p>${automotiveProducts
          .map((id) => {
            const price = automotivePrice(w, b, id);
            return `<form data-action="manufacturing" data-assembly-price>${hidden('building', b.id)}${hidden('op', 'price')}${hidden('product', id)}<h4>${esc(r.products[id].name)}</h4>${field('Price in denarii', 'priceDenarii', (price ?? r.products[id].price) / 100, 0, 1_000_000, 0.01)}<label>Sales<select name="open"><option value="true" ${price !== null ? 'selected' : ''}>Open</option><option value="false" ${price === null ? 'selected' : ''}>Closed</option></select></label><button>Save sale price</button></form>`;
          })
          .join('')}</details>`
      : ''
  }`;
}
const rendered = new WeakMap<HTMLElement, string>();
export function refreshManufacturing(root: HTMLElement, w: World, p: Player, b: Building) {
  if (
    root.contains(document.activeElement) &&
    document.activeElement?.closest('[data-assembly-price]')
  )
    return;
  const html = manufacturingPanel(w, p, b);
  if (rendered.get(root) === html) return;
  // No draft inputs in this status panel; the editing forms live in separate tabs.
  root.innerHTML = html;
  rendered.set(root, html);
}
function stockRows(w: World, stock: Stock, prefix: string, prices = false) {
  const defs = worldItems(w),
    entries = Object.entries(stock);
  return Array.from({ length: Math.max(8, entries.length) }, (_, i) => {
    const [id, n] = entries[i] ?? ['', 0];
    return `<div class="settings-grid"><label>${prices ? 'Purchase bid' : 'Material'} ${i + 1}<select name="${prefix}Item${i}"><option value="">Unused</option>${Object.entries(
      defs,
    )
      .map(
        ([key, d]) =>
          `<option value="${esc(key)}" ${key === id ? 'selected' : ''}>${esc(d.name)}</option>`,
      )
      .join(
        '',
      )}</select></label>${field(prices ? 'Denarii each' : 'Quantity', `${prefix}Qty${i}`, prices ? n / 100 : n, 0, 1_000_000, prices ? 0.01 : 1)}</div>`;
  }).join('');
}
function exportPanel(w: World, b: Building, near: boolean) {
  const r = automotiveConfig(w),
    q = automotiveExportQuote(w, 'tractor');
  return `<details open><summary>External vehicle buyers</summary><p>${r.exports.enabled && r.enabled ? `${q.available} collection places available across this world. ${q.nextIn ? `Next place returns in ${Math.ceil(q.nextIn / 60)} minutes.` : ''}` : 'Vehicle exports disabled.'} External buyers pay ${Math.round(r.exports.priceFraction * 100)}% of the world product price before sales tax; each collection uses a place for ${r.exports.interval / 3600} real hours. Unsold demand does not accumulate. Collection removes the completed unit and pays the factory investment till.</p>${(
    b.manufacturing?.ready ?? []
  )
    .map((u) => {
      const quote = automotiveExportQuote(w, u.product);
      return `<form data-action="manufacturing">${hidden('building', b.id)}${hidden('op', 'export')}${hidden('unit', u.id)}${hidden('expectedPrice', String(quote.price))}<button ${!near || b.construction || !quote.available ? 'disabled' : ''}>Export ${esc(r.products[u.product].name)}</button> ${money(quote.price, w.settings.denariiPerSheckle)} before sales tax</form>`;
    })
    .join('')}</details>`;
}
function exportForm(w: World) {
  const r = automotiveConfig(w).exports;
  return `<form id="creator-automotive-exports-form"><h3>External vehicle demand</h3><label class="check"><input type="checkbox" name="enabled" ${r.enabled ? 'checked' : ''}>Enable vehicle exports</label>${field('Seconds per external collection place', 'interval', r.interval, 3600, 604800)}${field('World-wide external collection places', 'units', r.units, 1, 16)}${field('External price fraction of world catalogue', 'priceFraction', r.priceFraction, 0, 1, 'any')}<p>Each completed-unit sale occupies a place for this interval. Already occupied places retain their expiry after rule edits. No accumulated demand or private sales history is copied into designs.</p><button>Save export rules</button></form>`;
}
export function automotiveEditor(w: World) {
  const r = automotiveConfig(w),
    f = r.factory;
  return `<p>These world rules define new factories and new assembly orders. Existing premises keep their owned trading prices and wages. Queued orders keep their reserved recipe, crew requirement, time and pay. Ready vehicles and paid work are never copied into a reusable world design.</p><form id="creator-automotive-factory-form"><h3>Factory investment and operation</h3><label class="check"><input type="checkbox" name="enabled" ${r.enabled ? 'checked' : ''}>Enable automotive manufacturing</label><div class="settings-grid">${field('World development tier', 'tier', f.tier, 0, 10)}${field('Construction cash in denarii', 'price', f.price / 100, 0, 1_000_000, 0.01)}${field('Input stockroom capacity per item', 'capacity', f.capacity, 1, 1_000_000)}${field('Ideal crew places', 'idealEmployees', f.idealEmployees, 1, 16)}${field('Gross wage per completed unit in denarii', 'wage', f.wage / 100, 0, 1_000_000, 0.01)}${field('Ready and reserved vehicle limit', 'readyCapacity', f.readyCapacity, 1, 64)}<label>Manufacturing profession<select name="skill">${worldSkills(
    w,
  )
    .map(
      (id) => `<option value="${esc(id)}" ${id === f.skill ? 'selected' : ''}>${esc(id)}</option>`,
    )
    .join(
      '',
    )}</select></label></div><details><summary>Construction materials</summary>${stockRows(w, f.materials, 'materials')}</details><details><summary>New factory purchase bids</summary>${stockRows(w, f.buy, 'buy', true)}</details><button>Save factory rules</button></form><form id="creator-automotive-delivery-form"><h3>Collection and ownership</h3>${field('Collection reach (metres)', 'range', r.delivery.range, 1, 100, 0.1)}${field('Owned semitrailer limit per player', 'maxOwnedSemitrailers', r.delivery.maxOwnedSemitrailers, 1, 100)}<button>Save delivery rules</button></form>${exportForm(w)}${refrigerationForm(w)}${highwayRuleForms(w)}${(
    ['box', 'refrigerated', 'stake'] as const
  )
    .map((id) => {
      const t = r.semitrailers[id];
      return `<form id="creator-automotive-semi-${id}-form" data-automotive-semi="${id}"><h3>${esc(r.products[id].name)} dimensions and capacity</h3>${field('Length (metres)', 'length', t.length, 6, 25, 0.1)}${field('Width (metres)', 'width', t.width, 1.5, 4, 0.05)}${field('Height (metres)', 'height', t.height, 2, 6, 0.1)}${field('Cargo weight capacity', 'capacity', t.capacity, 1, 100000)}<button>Save trailer dimensions</button></form>`;
    })
    .join('')}${automotiveProducts
    .map((id) => {
      const p = r.products[id];
      return `<details open><summary>${esc(p.name)}</summary><form id="creator-automotive-${id}-form" data-automotive-product="${id}"><label>Product name<input name="name" value="${esc(p.name)}" maxlength="64" required></label>${field('Fully staffed assembly seconds', 'seconds', p.seconds, 10, 86400)}${field('Sale price in denarii', 'price', p.price / 100, 0, 1_000_000, 0.01)}<details><summary>Assembly inputs</summary>${stockRows(w, p.inputs, 'inputs')}</details><button>Save ${esc(p.name)}</button></form></details>`;
    })
    .join('')}`;
}
function refrigerationForm(w: World) {
  const r = automotiveConfig(w).refrigeration;
  return `<form id="creator-automotive-refrigeration-form"><h3>Refrigerated semitrailers</h3><label class="check"><input type="checkbox" name="enabled" ${r.enabled ? 'checked' : ''}>Enable powered refrigeration</label>${field('Separate fuel capacity (tank units)', 'fuelCapacity', r.fuelCapacity, 0.1, 1000, 'any')}${field('Cooling fuel per real hour', 'fuelPerHour', r.fuelPerHour, 0, 100, 'any')}${field('Powered raw-meat ageing fraction', 'ageingMultiplier', r.ageingMultiplier, 0, 1, 'any')}<p>Zero fuel consumption permits free power after filling the tank. Zero ageing fraction pauses the existing raw-meat clock while powered; one gives no freshness benefit. These rules do not add a fish expiry timer.</p><button>Save refrigeration rules</button></form>`;
}
const highwayFields = {
  coupling: [
    ['fifthWheelZ', 'Fifth wheel Z (metres)', -5, 0],
    ['kingpinInset', 'Kingpin distance behind trailer front (metres)', 0.3, 2.5],
    ['axleRearInset', 'Bogie distance ahead of trailer rear (metres)', 0.5, 3],
  ],
  driving: [
    ['dirtSpeed', 'Dirt-road maximum speed (m/s)', 0.5, 60],
    ['offRoadSpeed', 'Off-road maximum speed (m/s)', 0.1, 30],
    ['reverseSpeed', 'Reverse maximum speed (m/s)', 0.1, 15],
    ['braking', 'Braking deceleration (m/s²)', 0.1, 20],
    ['coasting', 'Coasting deceleration (m/s²)', 0, 10],
    ['rollingDrag', 'Rolling drag per second', 0, 1],
    ['loadedAcceleration', 'Full-load acceleration fraction', 0.05, 1],
    ['minimumTurnRadius', 'Minimum turning radius (metres)', 3, 40],
    ['lateralAcceleration', 'Lateral acceleration limit (m/s²)', 0.2, 10],
    ['hitchRange', 'Fifth-wheel pickup reach (metres)', 0.1, 3],
    ['hitchAlignment', 'Pickup alignment tolerance (degrees)', 1, 45],
    ['maximumArticulation', 'Maximum articulation (degrees)', 15, 85],
    ['maximumTerrainGrade', 'Maximum terrain rise per horizontal metre', 0, 2],
    ['suspensionTravel', 'Additional suspension clearance (metres)', 0, 3],
  ],
} as const;
function highwayRuleForms(w: World) {
  const rules = automotiveConfig(w);
  return (['coupling', 'driving'] as const)
    .map(
      (group) =>
        `<form id="creator-automotive-${group}-form"><h3>${group === 'coupling' ? 'Fifth-wheel geometry' : 'Highway driving'}
    </h3><div class="settings-grid">${highwayFields[group].map(([key, label, min, max]) => field(label, key, (rules[group] as unknown as Record<string, number>)[key], min, max, 'any')).join('')}</div>
    ${group === 'driving' ? '<p>The paved-road top speed, engine, fuel consumption, dimensions and cockpit are configured in Vehicles. These rules apply to the entire highway rig; weather, condition and slopes can lower its speed.</p>' : ''}
    <button>${group === 'coupling' ? 'Save coupling dimensions' : 'Save highway driving rules'}</button></form>`,
    )
    .join('');
}
export function automotiveForm(form: HTMLFormElement): Action {
  const d = new FormData(form),
    n = (key: string) => Number(d.get(key));
  const stock = (prefix: string, prices = false) => {
    const result: Stock = {};
    for (const [key, value] of d)
      if (key.startsWith(prefix + 'Item') && value) {
        const id = String(value),
          quantity = n(prefix + 'Qty' + key.slice((prefix + 'Item').length));
        if (Object.hasOwn(result, id)) throw Error('Choose each material only once');
        result[id] = prices ? Math.round(quantity * 100) : quantity;
      }
    return result;
  };
  if (form.id === 'creator-automotive-factory-form')
    return {
      type: 'automotiveConfig',
      patch: {
        enabled: d.has('enabled'),
        factory: {
          tier: n('tier'),
          price: Math.round(n('price') * 100),
          capacity: n('capacity'),
          idealEmployees: n('idealEmployees'),
          wage: Math.round(n('wage') * 100),
          readyCapacity: n('readyCapacity'),
          skill: String(d.get('skill')),
          materials: stock('materials'),
          buy: stock('buy', true),
        },
      },
    };
  if (form.id === 'creator-automotive-refrigeration-form')
    return {
      type: 'automotiveConfig',
      patch: {
        refrigeration: {
          enabled: d.has('enabled'),
          fuelCapacity: n('fuelCapacity'),
          fuelPerHour: n('fuelPerHour'),
          ageingMultiplier: n('ageingMultiplier'),
        },
      },
    };
  if (form.id === 'creator-automotive-exports-form')
    return {
      type: 'automotiveConfig',
      patch: {
        exports: {
          enabled: d.has('enabled'),
          interval: n('interval'),
          units: n('units'),
          priceFraction: n('priceFraction'),
        },
      },
    };
  if (form.id === 'creator-automotive-delivery-form')
    return {
      type: 'automotiveConfig',
      patch: { delivery: { range: n('range'), maxOwnedSemitrailers: n('maxOwnedSemitrailers') } },
    };
  for (const group of ['coupling', 'driving'] as const)
    if (form.id === `creator-automotive-${group}-form`)
      return {
        type: 'automotiveConfig',
        patch: { [group]: Object.fromEntries(highwayFields[group].map(([key]) => [key, n(key)])) },
      };
  if (form.dataset.automotiveSemi)
    return {
      type: 'automotiveConfig',
      patch: {
        semitrailers: {
          [form.dataset.automotiveSemi]: {
            length: n('length'),
            width: n('width'),
            height: n('height'),
            capacity: n('capacity'),
          },
        },
      },
    };
  const product = form.dataset.automotiveProduct as AutomotiveProduct;
  if (!automotiveProducts.includes(product)) throw Error('Unknown automotive product');
  return {
    type: 'automotiveConfig',
    patch: {
      products: {
        [product]: {
          name: String(d.get('name')),
          seconds: n('seconds'),
          price: Math.round(n('price') * 100),
          inputs: stock('inputs'),
        },
      },
    },
  };
}
