// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player, Building } from '../shared/types';
import { storageGarage, landStorageVehicle } from '../shared/garage-storage';
import { vehicleDef } from '../shared/vehicle-config';
import { trailerDef } from '../shared/trailers';
import { trailerStorage } from '../shared/stored-trailers';
import { parkingRules } from '../shared/parking-rules';
import { GARAGE_STORAGE } from '../shared/parked-vehicles';
const esc = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function garageStoragePanel(w: World, p: Player, b: Building) {
  if (!storageGarage(b)) return '';
  const r = parkingRules(w.settings),
    nearby = Math.hypot(p.x - b.x, p.z - b.z) <= r.garageStorageRange;
  const items = [
    ...Object.values(w.parkedVehicles ?? {})
      .filter((v) => v.owner === p.id && landStorageVehicle(w, v.slot))
      .map((v) => ({
        id: String(v.slot),
        field: 'slot',
        type: 'Vehicle',
        name: vehicleDef(w, v.slot).name,
        stored: v.inside,
        x: v.x,
        z: v.z,
        rig: false,
      })),
    ...Object.values(w.trailers ?? {})
      .filter((t) => t.owner === p.id)
      .map((t) => ({
        id: t.id,
        field: 'id',
        type: 'Trailer',
        name: trailerDef(w, t.kind).name,
        stored: trailerStorage(w, t),
        x: t.x,
        z: t.z,
        rig: !!t.parkedWith || !!t.attached,
      })),
  ];
  const atThis = (stored: string | undefined) =>
    stored === b.id || (stored === GARAGE_STORAGE && b.kind === 'garage' && !b.aircraftHangar);
  const row = (item: (typeof items)[number]) => {
    const retrieval = !!item.stored,
      here = atThis(item.stored),
      distance = Math.hypot(item.x - b.x, item.z - b.z);
    const reason = !nearby
      ? 'Visit this garage to use storage.'
      : retrieval && !here
        ? 'Retrieve at the garage shown above.'
        : item.rig
          ? 'Unhitch first, or handle the complete vehicle and trailer rig.'
          : !retrieval && !r.garageStorageEnabled
            ? 'New garage storage is disabled.'
            : !retrieval && b.kind === 'vehicleStorage' && b.owner !== p.id
              ? 'Only the garage owner may store here.'
              : !retrieval &&
                  (distance > r.garageStorageRange ||
                    Math.hypot(p.x - item.x, p.z - item.z) > r.garageStorageRange)
                ? `Bring it within ${r.garageStorageRange} m of this garage and yourself.`
                : '';
    return `<article data-garage-unit="${esc(item.type + ':' + item.id)}"><h4>${esc(item.name)}</h4><p>${item.stored ? 'Stored: ' + esc(w.buildings.find((b) => b.id === item.stored)?.name ?? 'tractor garage storage') : `Parked outside · ${Math.round(distance)} m from garage`}</p><form data-action="garageStorage"><input type="hidden" name="building" value="${esc(b.id)}"><input type="hidden" name="operation" value="${retrieval ? 'retrieve' : 'store'}${item.type}"><input type="hidden" name="${item.field}" value="${esc(item.id)}"><button ${reason ? 'disabled' : ''}>${retrieval ? 'Retrieve outside' : 'Store in garage'}</button></form>${reason ? `<p class="note">${esc(reason)}</p>` : ''}</article>`;
  };
  return `<section data-garage-storage><details data-fleet-disclosure="garage-storage"><summary>Vehicle storage (${items.length})</summary><p>${r.garageStorageLimit ? `Up to ${r.garageStorageLimit} vehicles and trailers per player here.` : 'Unlimited vehicle and trailer storage.'} Store your parked land vehicles and trailers here, or leave them outside where you park. Fuel, paint, condition and cargo stay with them. Retrieval needs clear space outside. Boats and aircraft use their own facilities.</p>${b.kind === 'vehicleStorage' ? '<p>Private storage garage. It offers storage, not vehicle sales or repairs. Existing depositors keep access to their own vehicles if the garage changes hands.</p>' : ''}${landStorageVehicle(w, p.vehicle) ? '<p>Park and step out of your vehicle before storing it.</p>' : ''}<h4>Stored here</h4><div class="cards">${
    items
      .filter((i) => atThis(i.stored))
      .map(row)
      .join('') || '<p>No vehicles or trailers stored here.</p>'
  }</div><h4>Other owned vehicles and trailers</h4><div class="cards">${
    items
      .filter((i) => !atThis(i.stored))
      .map(row)
      .join('') || '<p>No other parked vehicles or trailers.</p>'
  }</div></details></section>`;
}
