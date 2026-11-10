import { marineSafetyPanel } from './marine-safety-panel';
import { canoeLanding, canoeWater } from '../shared/canoe-shore';
import { cargoFitReason } from '../shared/cargo-fit';
import { boatLandings, withinBoatLanding } from '../shared/boathouse';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player, Building } from '../shared/types';
import { CANOE, canoeRules } from '../shared/canoe-rules';
import { canCarry, money, withinBuildingRange } from '../shared/simulation';
const hidden = (key: string, value: string) =>
  `<input type="hidden" name="${key}" value="${value.replace(/[&<>"']/g, '')}">`;
export function canoePanel(w: World, p: Player, contextual = false) {
  const r = canoeRules(w.settings),
    c = p.carrying && w.smallCraft?.[p.carrying];
  const nearby = Object.values(w.smallCraft ?? {}).filter(
    (c) =>
      ['setDown', 'moored'].includes(c.state) &&
      (c.landing
        ? boatLandings(w).some((d) => d.id === c.landing && withinBoatLanding(w, p, d, false))
        : Math.hypot((c.land?.x ?? c.x) - p.x, (c.land?.z ?? c.z) - p.z) <= r.canoeRange),
  );
  const services = w.buildings.filter((b) => !b.construction && withinBuildingRange(w, p, b));
  if (
    contextual &&
    p.vehicle !== CANOE &&
    !c &&
    !p.inventory.canoe &&
    !nearby.length &&
    !services.some(
      (b) =>
        ['carpenter', 'boathouse'].includes(b.kind) ||
        (b.kind === 'home' && b.owner === p.id && (b.stock.canoe ?? 0) > 0),
    )
  )
    return '<section class="canoe-panel" hidden></section>';
  const stopped =
    p.vehicle === 5 &&
    !p.task &&
    !p.hitch &&
    !p.game &&
    !p.crowBody &&
    Math.abs(p.speed) <= r.canoeStoppedSpeed;
  const form = (op: string, label: string, disabled = false, b?: Building, id?: string) =>
    `<form data-action="canoe">${hidden('operation', op)}${b ? hidden('building', b.id) : ''}${id ? hidden('id', id) : ''}<button ${disabled ? 'disabled' : ''}>${label}</button></form>`;
  let html = '<section class="canoe-panel"><h3>Portable canoes</h3>';
  if (p.vehicle === CANOE) {
    const landing = canoeLanding(w, p, true),
      ready = !p.task && !p.hitch && !p.game && Math.abs(p.speed) <= r.canoeStoppedSpeed;
    return (
      html +
      marineSafetyPanel(w, p) +
      `<p>Paddle with W/S or the arrows. One occupant · ${r.canoeCapacity} weight hold · no fuel. Maximum paddling speed ${r.canoeSpeed}m/s; Shift does not run.</p>` +
      form('beach', 'Beach canoe', !ready || !landing) +
      (!ready
        ? '<p>Stop paddling before stepping out.</p>'
        : !landing
          ? `<p>Find a clear dry bank within ${r.canoeBankRange}m and water ${r.canoeMinDepth}–${r.canoeStepOutDepth}m deep, or a dock.</p>`
          : '<p>Clear bank or dock available.</p>') +
      '</section>'
    );
  }
  const launch = (id?: string) => {
    const reason =
      cargoFitReason(w, p, CANOE) ??
      (!canoeLanding(w, p, false) ? 'No clear water beside this shore or bank' : undefined);
    return (
      form('launch', 'Launch canoe', !stopped || p.atHome || !!reason, undefined, id) +
      (reason ? `<p>${reason}</p>` : '')
    );
  };
  html += `<p>${c ? 'Carrying a canoe overhead' : 'No canoe overhead'} · hull ${r.canoeWeight} weight · walk at ${Math.round(r.canoeCarrySpeed * 100)}% pace. Set it down before running, gathering, building or changing vehicles.</p>`;
  if (!stopped) html += '<p>Stop on foot and finish your activity to handle a canoe.</p>';
  if (c) html += form('setDown', 'Set canoe down', !stopped || p.atHome) + launch();
  else if (p.inventory.canoe) html += form('carry', 'Lift inventory canoe', !stopped || p.atHome);
  if (!nearby.length && !c) html += '<p>No set-down canoe within reach.</p>';
  for (const hull of nearby) {
    html +=
      `<p>${hull.owner === p.id ? 'Your canoe' : 'Another player’s canoe'} · ${hull.state === 'moored' ? 'moored at bank' : 'set down'}</p>` +
      form(
        'pickup',
        hull.owner === p.id || r.canoePublicPickup ? 'Pick up canoe' : 'Owner-only pickup',
        !!c || !stopped || p.atHome || (hull.owner !== p.id && !r.canoePublicPickup),
        undefined,
        hull.id,
      );
    if (hull.owner === p.id && !c) {
      if (hull.state === 'moored') {
        const reason =
          cargoFitReason(w, p, CANOE) ??
          (!canoeWater(w, hull.x, hull.z, hull.heading) && !canoeLanding(w, p, false)
            ? 'No clear water beside this bank'
            : undefined);
        html +=
          form('board', 'Board canoe', !stopped || p.atHome || !!reason, undefined, hull.id) +
          (reason ? `<p>${reason}</p>` : '');
      } else html += launch(hull.id);
    }
  }
  for (const b of services) {
    if (['carpenter', 'boathouse'].includes(b.kind)) {
      html += form(
        'buy',
        `Buy canoe · ${money(r.canoePrice, w.settings.denariiPerSheckle)}`,
        !!c || !stopped || p.atHome || p.cash < r.canoePrice || !canCarry(p, 'canoe', 1, w),
        b,
      );
      if (p.cash < r.canoePrice) html += '<p>Not enough cash to buy a canoe.</p>';
      if (b.kind === 'carpenter')
        html += form(
          'craft',
          `Craft canoe · ${r.canoeWood} Wood`,
          !!c || !stopped || p.atHome || (p.inventory.wood ?? 0) < r.canoeWood,
          b,
        );
      if (b.kind === 'carpenter' && (p.inventory.wood ?? 0) < r.canoeWood)
        html += '<p>Bring more Wood to craft a canoe.</p>';
    }
    if (b.kind === 'home' && b.owner === p.id) {
      html += `<p>Home canoes: ${b.stock.canoe ?? 0} / ${r.canoeHomeLimit}${(b.stock.canoe ?? 0) >= r.canoeHomeLimit ? ' · Home canoe limit is full' : ''}</p>`;
      html += c
        ? form(
            'store',
            'Store canoe at home',
            !stopped || (b.stock.canoe ?? 0) >= r.canoeHomeLimit,
            b,
          )
        : form(
            'retrieve',
            'Take canoe out at the door',
            !stopped || p.atHome || !(b.stock.canoe ?? 0) || !canCarry(p, 'canoe', 1, w),
            b,
          );
    }
  }
  return html + '</section>';
}
