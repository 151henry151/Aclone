// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player, Building, Stock } from '../shared/types';
import {
  herdSpec,
  herdNeeds,
  herdRation,
  herdShares,
  acceptsHay,
  youngAnimals,
} from '../shared/livestock';
import { livestockRules } from '../shared/livestock-rules';
import { pastureCapacity, pastureCost, pastureParcelSize } from '../shared/pasture-land';
import { meatRules } from '../shared/meat-rules';
import { meatAnimals, meatMenus, slaughterOutputs } from '../shared/meat-recipes';
import { slaughterFee, butcherRamp } from '../shared/butcher';
import { shelter } from '../shared/lodging';
import { worldItems } from '../shared/world-catalogue';
import { money } from '../shared/simulation';
const esc = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const hidden = (k: string, v: unknown) => `<input type="hidden" name="${k}" value="${esc(v)}">`;
const form = (
  action: string,
  values: Record<string, unknown>,
  label: string,
  content = '',
  disabled = false,
) =>
  `<form data-action="${action}">${Object.entries(values)
    .map(([k, v]) => hidden(k, v))
    .join('')}${content}<button ${disabled ? 'disabled' : ''}>${esc(label)}</button></form>`;
const stockText = (w: World, stock: Stock) =>
  Object.entries(stock)
    .map(([id, n]) => `${n} ${esc(worldItems(w)[id]?.name ?? id)}`)
    .join(' + ');
export function livestockPanel(w: World, p: Player, b: Building) {
  const s = herdSpec(b, w.settings);
  if (!s) return '';
  const r = livestockRules(w.settings),
    n = herdNeeds(b, w.settings),
    owned = b.owner === p.id;
  let html = `<section data-livestock-panel><h3>Grazing pasture</h3><p>${b.pasture ? `${b.pasture.parcels} parcels · ${b.pasture.parcels * pastureParcelSize(b.pasture) ** 2} m² · ${herdShares(b, w.settings)} / ${pastureCapacity(b, w.settings.pastureCapacityMultiplier ?? 1)} adult shares occupied` : 'No clear grazing area available near this barn.'}${b.breedingEnd ? ' · space reserved for offspring' : ''}.</p>`;
  if (owned && b.pasture && b.pasture.parcels < 4)
    html += form(
      'livestock',
      { building: b.id, operation: 'expand' },
      `Buy adjoining pasture · ${pastureParcelSize(b.pasture) ** 2} m² · ${money(pastureCost(b, w.settings.pasturePriceMultiplier ?? 1))}`,
    );
  html += `<p>Deliver animals and supplies through Stockroom or funded purchase bids. Pasture expansion uses personal cash and must clear roads, buildings, water and other plots.</p><h3>${b.kind === 'dairy' ? 'Dairy herd' : 'Livestock'}</h3><p>${b.stock[s.animal] ?? 0} ${s.animal} · ${b.herdCondition ?? 100}% condition. Production needs ${s.minimum} adults and ${r.livestockGrowthCondition}% condition. Whole-herd care uses ${n.feed} ${acceptsHay(b) ? 'hay or feed' : 'feed'} and ${n.water} water per production check, even when output is full. Fractional young rations carry between checks.</p><p>Next charge: ${stockText(w, herdRation(b, undefined, undefined, w.settings))}. Hay does not replace water. Qualified care restores condition; neglect can kill animals.</p><h3>Young animals</h3><p>${b.stock[s.youngItem] ?? 0} ${s.youngItem}. Maturity: ${s.maturityDays} healthy game days · growth multiplier ${r.livestockGrowthMultiplier}. Each young animal uses ${r.livestockYoungPastureShare} adult pasture shares and ${r.livestockYoungRationShare} of its ration. Young produce no goods and do not count as breeding adults.</p>`;
  html += (b.young ?? [])
    .filter((c) => c.item === s.youngItem && c.count > 0)
    .map(
      (c) =>
        `<p>${c.count} ${s.youngItem}: ${c.grownDays.toFixed(1)} / ${s.maturityDays} growth days · ${Math.max(0, s.maturityDays - c.grownDays).toFixed(1)} remaining.</p>`,
    )
    .join('');
  html += `<p>Growth pauses without feed, water or ${r.livestockGrowthCondition}% condition. Young are lost first below ${r.livestockYoungLossCondition}% condition. Healthy growth also needs room for the adult. Visible herds include smaller young animals; the stockroom shows the full count.</p>`;
  if (b.breedingEnd)
    html += `<p>${esc(s.young)} due in ${Math.max(0, Math.ceil((b.breedingEnd - w.time) / 60))} minutes. Keep condition at least ${r.livestockBirthCondition}%.</p>`;
  else if (owned || p.job === b.id)
    html += form(
      'livestock',
      { building: b.id, operation: 'breed' },
      `Arrange breeding · ${r.livestockBreedingFeed} feed/hay + ${r.livestockBreedingWater} water + ${money(s.fee)} · ${(s.seconds / 60).toFixed(1)} minutes`,
    );
  html += `<p>Breeding needs ${s.minimum} adults, ${r.livestockBreedingCondition}% condition, supplies, investment and pasture room. Continuous breeding: ${b.continuousBreeding ? 'enabled' : 'off'}${r.livestockContinuousAllowed ? '' : ' (disabled by this world)'}.</p>`;
  if (owned)
    html += form(
      'livestock',
      { building: b.id, operation: 'continuous', enabled: !b.continuousBreeding },
      `${b.continuousBreeding ? 'Disable' : 'Enable'} continuous breeding`,
      '',
      !r.livestockContinuousAllowed && !b.continuousBreeding,
    );
  return html + '</section>';
}
export function meatMenuPanel(w: World, p: Player, b: Building) {
  const menus = Object.entries(meatMenus).filter(([, m]) => m.kitchens.includes(b.kind));
  if (!menus.length) return '';
  let html =
    '<section data-meat-menu><h3>Meat kitchen</h3><p>Keep raw meat here in cold storage and employ qualified cooks. Choose a menu, stock its ingredients and fund wages.</p>';
  if (b.owner === p.id && !b.production)
    html += form(
      'meatMenu',
      { building: b.id },
      'Set meat menu',
      `<label>Meat menu <select name="menu">${menus.map(([id]) => `<option value="${id}" ${b.recipe === `meat_${id}` ? 'selected' : ''}>${esc(worldItems(w)[id].name)}</option>`).join('')}</select></label>`,
    );
  else if (b.production) html += '<p>This building uses a custom world recipe.</p>';
  return html + '</section>';
}
export function butcherPanel(w: World, p: Player, b: Building) {
  if (b.kind !== 'butcher') return '';
  const r = meatRules(w.settings),
    ramp = butcherRamp(b);
  let html = `<section data-butcher-panel><h3>Butcher service</h3><p>Stop within ${r.slaughterRange}m of the loading ramp (${Math.hypot(p.x - ramp.x, p.z - ramp.z).toFixed(1)}m away). A qualified butcher must be working. Pay per adult; your animals and cash stay yours until completion. Walking: one animal weighing up to ${r.slaughterWalkingWeight}. Larger deliveries need your livestock wagon.</p>`;
  if (p.task?.kind === 'slaughter')
    return (
      html +
      `<p>Service in progress · ${Math.max(0, Math.ceil(p.task.end - w.time))} seconds remaining.</p>` +
      form('butcher', { operation: 'cancel' }, 'Cancel slaughter') +
      '</section>'
    );
  if (!r.butchersEnabled) return html + '<p>Butchers are disabled in this world.</p></section>';
  const sources = [
    { label: 'Inventory', stock: p.inventory, values: {} as Record<string, unknown> },
    ...Object.values(w.trailers ?? {})
      .filter(
        (t) =>
          t.owner === p.id &&
          t.kind === 'livestock' &&
          Math.hypot(t.x - ramp.x, t.z - ramp.z) <= r.slaughterRange,
      )
      .map((t) => ({
        label: 'Livestock wagon',
        stock: p.trailerCargo?.[t.id] ?? t.cargo,
        values: { storage: 'trailer', trailer: t.id },
      })),
  ];
  let count = 0;
  for (const source of sources)
    for (const [id, n] of Object.entries(source.stock))
      if (n > 0 && (id in meatAnimals || id in youngAnimals)) {
        count++;
        const adult = Object.hasOwn(meatAnimals, id);
        html += `<article><h4>${esc(worldItems(w)[id].name)} · ${source.label} · ${n} available</h4>${adult ? `<p>Fee ${money(slaughterFee(w, b, id))} per animal · ${r.slaughterSeconds} seconds · returns ${stockText(w, slaughterOutputs(id as keyof typeof meatAnimals, w.settings))}.</p>` : '<p>Young animals cannot be slaughtered. Check eligibility to see remaining healthy growth days.</p>'}${form('butcher', { building: b.id, operation: 'slaughter', item: id, ...source.values }, adult ? `Slaughter ${worldItems(w)[id].name}` : 'Check young animal eligibility', `<label>Quantity <input name="quantity" type="number" value="1" min="1" max="${n}"></label>`)}</article>`;
      }
  if (!count)
    html +=
      '<p>No animals in your inventory or a nearby livestock wagon. Bring an adult, or buy raw meat from the counter.</p>';
  html += `<p>${r.rawMeatEdible ? 'This world permits eating raw meat.' : 'Raw meat must be cooked.'} ${r.rawMeatSpoilageDays ? `Spoils after ${r.rawMeatSpoilageDays} unchilled game days; butcher and kitchen stockrooms and chilled freight keep it cold.` : 'Raw-meat spoilage is disabled in this world.'}</p>`;
  if (b.owner === p.id) {
    html += '<h3>Run the butcher</h3>';
    const animals = `<label>Adult animal <select name="item">${Object.keys(meatAnimals)
      .map(
        (id) =>
          `<option value="${id}" ${b.recipe === `butcher_${id}` ? 'selected' : ''}>${esc(worldItems(w)[id].name)} · service ${money(slaughterFee(w, b, id))}</option>`,
      )
      .join('')}</select></label>`;
    html += form(
      'butcher',
      { building: b.id, operation: 'fee' },
      'Set slaughter fee',
      animals +
        '<label>Fee in denarii <input name="feeDenarii" type="number" min="0" max="1000000" step="0.01" required></label>',
    );
    if (!b.production)
      html += form('butcher', { building: b.id, operation: 'menu' }, 'Set counter menu', animals);
  }
  return html + '</section>';
}
export function homeCookingPanel(w: World, p: Player, b: Building) {
  if (
    !(b.kind === 'home' && b.owner === p.id) &&
    !(['hotel', 'bnb'].includes(b.kind) && (b.lodging?.guests[p.id]?.until ?? 0) > w.time)
  )
    return '';
  const r = meatRules(w.settings),
    here = shelter(w, p);
  let html = '<section data-home-cooking><h3>Home cooking</h3>';
  if (!r.homeCookingEnabled)
    return html + '<p>Home cooking is disabled in this world.</p></section>';
  if (!here || here.b.id !== b.id)
    return html + '<p>Go inside your home or booked inn room to cook.</p></section>';
  if (p.task?.kind === 'homeCook')
    return (
      html +
      `<p>Cooking ${esc(worldItems(w)[p.task.item!].name)} · ${Math.max(0, Math.ceil(p.task.end - w.time))} seconds remaining. Stay inside.</p>` +
      form('cook', { operation: 'cancel' }, 'Cancel cooking') +
      '</section>'
    );
  html += `<p>Cook without a qualification. Each dish takes ${r.homeCookingSeconds} seconds and makes ${r.homeCookingYield} meal(s) in your pantry. Ingredients come from your pantry first, then inventory. Leaving cancels cooking and keeps the ingredients.</p>`;
  const pantry = p.roomPantries?.[b.id] ?? here.stock;
  for (const [id, m] of Object.entries(meatMenus)) {
    const missing = Object.entries(m.inputs).filter(
        ([item, n]) => (pantry[item] ?? 0) + (p.inventory[item] ?? 0) < n,
      ),
      full = (pantry[id] ?? 0) + r.homeCookingYield > b.capacity;
    html += `<article><h4>${esc(worldItems(w)[id].name)}</h4><p>${stockText(w, m.inputs)}</p>${missing.length ? `<p>Missing ingredients: ${stockText(w, Object.fromEntries(missing))}.</p>` : full ? '<p>The home pantry is full.</p>' : '<p>Ingredients ready.</p>'}${form('cook', { menu: id }, `Cook ${worldItems(w)[id].name}`, '', !!missing.length || full || !!p.task)}</article>`;
  }
  return html + '</section>';
}
