import { itemEntries } from './item-order';
import { trailerStorage } from '../shared/stored-trailers';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player, Action } from '../shared/types';
import { constructionRules } from '../shared/construction-rules';
import {
  earthworkGuidance,
  earthworkSurveyReach,
  surveyEarthwork,
  type EarthworkInput,
} from '../shared/earthworks-work';
import { terrainHeight } from '../shared/terrain';
import { worldItems } from '../shared/world-catalogue';
import { stockWeight } from '../shared/fishing-expedition';
import type { Earthwork } from '../shared/earthworks-ground';
import { earthworkPropertyOwners, earthworkOperatorAllowed } from '../shared/earthworks-contracts';
import { economyRules } from '../shared/economy-rules';
import { taxTown } from '../shared/town-charter';
const esc = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const number = (n: number) => n.toLocaleString('en-GB', { maximumFractionDigits: 2 });
const input = (label: string, name: string, value: number, extra = '') =>
  `<label>${label}<input type="number" name="${name}" value="${value}" step="any" required ${extra}></label>`;
function contractPanel(w: World, p: Player, pad: Earthwork) {
  const work = pad.work!,
    c = work.contract,
    name = (id: string) => esc(w.players[id]?.name ?? id),
    button = (operation: string, label: string) =>
      `<button type="button" data-earthwork-op="${operation}">${label}</button>`;
  let html = `<p>Client: ${name(pad.owner)} · ${number(Math.hypot(p.x - pad.x, p.z - pad.z))} m away. ${number(pad.width)} × ${number(pad.depth)} m; target ${number(pad.target)} m; rotation ${number((pad.rotation * 180) / Math.PI)}°; shoulder ${number(pad.shoulder)} m.</p>`;
  if (work.pendingApproval) {
    const owners = earthworkPropertyOwners(w, pad);
    html += `<p>Awaiting property confirmation: ${
      owners
        .filter((id) => !work.approvedBy?.includes(id))
        .map(name)
        .join(', ') || 'site now clear'
    }. No land is reserved or graded yet.</p>`;
    if (
      (owners.includes(p.id) && !work.approvedBy?.includes(p.id)) ||
      (!owners.length && pad.owner === p.id)
    )
      html += button('approve', 'Confirm property permission');
    if (pad.owner === p.id || owners.includes(p.id))
      html += button('withdrawSurvey', pad.owner === p.id ? 'Withdraw survey' : 'Decline survey');
    return html;
  }
  if (c) {
    const tax =
      c.state === 'offered' ? Math.round(c.fee * (taxTown(w, pad.x, pad.z)?.tax ?? 0)) : c.tax;
    html += `<p><b>${number(c.fee / 100)}d fee</b> + ${number(tax / 100)}d town tax · ${c.fillBy === 'client' ? 'Client supplies fill' : 'Operator supplies fill'}. ${c.state === 'complete' ? 'Paid' : c.state === 'cancelled' ? 'Cancelled and refunded' : c.state === 'accepted' ? `Accepted by ${name(c.operator!)}` : 'Open offer'}. Held: ${number(c.escrow / 100)}d.</p>`;
    if (Object.keys(c.contributions).length)
      html += `<p>Work credited: ${Object.entries(c.contributions)
        .map(([id, volume]) => `${name(id)} ${number(volume)} m³`)
        .join(' · ')}.</p>`;
    if (Object.keys(c.payouts).length)
      html += `<p>Paid: ${Object.entries(c.payouts)
        .map(([id, amount]) => `${name(id)} ${number(amount / 100)}d`)
        .join(' · ')}.</p>`;
    if (c.state === 'offered' && pad.owner !== p.id) html += button('accept', 'Accept contract');
    if (pad.owner === p.id && ['offered', 'accepted'].includes(c.state))
      html += button('cancelOffer', 'Cancel contract and refund');
  }
  if (
    pad.owner === p.id &&
    pad.progress < 1 &&
    constructionRules(w.settings).earthworksContracts &&
    (!c ||
      ((c.state === 'offered' || c.state === 'cancelled') && !Object.keys(c.contributions).length))
  )
    html += `<form data-earthwork-offer>${input('Offered fee (denarii)', 'feeDenarii', (c?.fee ?? 0) / 100, `min="0" max="${economyRules(w.settings).cashTransferLimit / 100}"`)}<label>Fill supplied by<select name="fillBy"><option value="client">Client</option><option value="operator" ${c?.fillBy === 'operator' ? 'selected' : ''}>Operator</option></select></label><p>Posting spends nothing. Acceptance holds the fee plus town tax; completion pays for credited work. Abandonment refunds the hold; a replacement re-funds the same offer and splits payment with prior contributors.</p><button>Post contract</button></form>`;
  return html;
}
export function earthworksPanel(w: World, p: Player) {
  const r = constructionRules(w.settings);
  return `<div data-earthworks-panel>
 <p>Make a level area for a yard, a field or a future building. You do not need a building plan.</p>
 <ol class="earthwork-steps"><li><b>Choose your area.</b> Start where you are, choose its size and the height you want.</li><li><b>Check and confirm.</b> Amber ground is cut down; blue ground needs filling. Previewing costs nothing.</li><li><b>Drive the work.</b> In a backhoe or bulldozer, follow the outline, lower the implement and make slow passes. The driver guide explains what to do.</li></ol>
 <section data-earthwork-sites></section>
 <details ${(w.earthworks ?? []).some((e) => e.work && e.owner === p.id) ? '' : 'open'} data-earthwork-new><summary>Survey a new pad</summary><form data-earthwork-draft>
 <div class="button-row"><button type="button" data-earthwork-centre>Centre on me</button><button type="button" data-earthwork-level>Use ground level here</button></div>
 <div class="build-designer"><div><h3>1. Size and level</h3><div class="settings-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">${input('Width (m)', 'width', Math.min(r.earthworksSurveySide, r.earthworksMaximumSide), `min="1" max="${r.earthworksMaximumSide}"`)}${input('Depth (m)', 'depth', Math.min(r.earthworksSurveySide, r.earthworksMaximumSide), `min="1" max="${r.earthworksMaximumSide}"`)}${input('Target level (m)', 'target', Math.round(terrainHeight(w, p.x, p.z) * 100) / 100)}</div>
 <p>Lower the target to dig down; raise it to fill up. Cut ground supplies fill first. Extra fill needs Topsoil or Gravel.</p>
 <details data-earthwork-precise><summary>Precise position and shoulder</summary><div class="settings-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">${input('Centre X (m)', 'x', p.x)}${input('Centre Z (m)', 'z', p.z)}${input('Rotation (degrees)', 'rotation', 0)}${input('Shoulder (m)', 'shoulder', Math.min(r.earthworksSurveyShoulder, r.earthworksMaximumShoulder), `min="1" max="${r.earthworksMaximumShoulder}"`)}</div><p>The shoulder is the sloping edge that blends the level area into the surrounding land. It is not part of the area you drive over to work.</p></details></div>
 <div><h3>2. Check the plan</h3><canvas data-earthwork-map class="build-site" width="600" height="300" style="touch-action:none;max-height:none" aria-label="Earthwork site plan; drag to draw a pad"></canvas><p class="note">North is up. You are the white dot. Drag to draw an area. Solid outline: work area. Dashed outline: shoulder. Amber: cut down. Blue: fill up. Green: already level.</p><div data-earthwork-survey aria-live="polite"></div></div></div>
 <div class="earthwork-confirm"><p data-earthwork-reach role="status"></p><button class="primary" type="submit" data-confirm-earthwork>Confirm pad</button></div></form></details></div>`;
}
export function mountEarthworksPanel(
  root: HTMLElement,
  getState: () => { w: World; p: Player },
  send: (a: Action) => void,
  guide: (id: string) => void = () => {},
) {
  const form = root.querySelector<HTMLFormElement>('[data-earthwork-draft]')!,
    canvas = root.querySelector<HTMLCanvasElement>('canvas')!,
    ctx = canvas.getContext('2d')!,
    summary = root.querySelector<HTMLElement>('[data-earthwork-survey]')!,
    confirm = root.querySelector<HTMLButtonElement>('[data-confirm-earthwork]')!,
    sites = root.querySelector<HTMLElement>('[data-earthwork-sites]')!,
    reachStatus = root.querySelector<HTMLElement>('[data-earthwork-reach]')!;
  const origin = { x: getState().p.x, z: getState().p.z },
    r = constructionRules(getState().w.settings),
    span = r.earthworksMaximumSide + r.earthworksMaximumShoulder * 2;
  let scale = canvas.height / span;
  const field = (key: string) => form.elements.namedItem(key) as HTMLInputElement;
  const draft = () =>
    Object.fromEntries(
      ['x', 'z', 'width', 'depth', 'rotation', 'target', 'shoulder'].map((k) => [
        k,
        Number(field(k).value) * (k === 'rotation' ? Math.PI / 180 : 1),
      ]),
    ) as unknown as EarthworkInput;
  let valid: EarthworkInput | undefined,
    key = '',
    previewKey = '';
  let confirming = false;
  const initialIds = new Set(getState().w.earthworks?.map((e) => e.id));
  const screen = (x: number, z: number) => ({
    x: canvas.width / 2 + (x - origin.x) * scale,
    y: canvas.height / 2 + (z - origin.z) * scale,
  });
  function preview() {
    const { w, p } = getState();
    valid = undefined;
    const shape = draft();
    if (!start && Object.values(shape).every(Number.isFinite)) {
      const c = Math.abs(Math.cos(shape.rotation)),
        s = Math.abs(Math.sin(shape.rotation));
      const halfX = (shape.width / 2 + shape.shoulder) * c + (shape.depth / 2 + shape.shoulder) * s;
      const halfZ = (shape.width / 2 + shape.shoulder) * s + (shape.depth / 2 + shape.shoulder) * c;
      const minX = Math.min(p.x, shape.x - halfX),
        maxX = Math.max(p.x, shape.x + halfX);
      const minZ = Math.min(p.z, shape.z - halfZ),
        maxZ = Math.max(p.z, shape.z + halfZ);
      origin.x = (minX + maxX) / 2;
      origin.z = (minZ + maxZ) / 2;
      scale =
        Math.min(
          canvas.width / Math.max(1, maxX - minX),
          canvas.height / Math.max(1, maxZ - minZ),
        ) / 1.3;
    }
    reachStatus.textContent = '';
    ctx.fillStyle = '#243c2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const b of w.buildings) {
      const at = screen(b.x, b.z);
      ctx.fillStyle = '#ddcc9a';
      ctx.fillRect(at.x - 4, at.y - 4, 8, 8);
    }
    try {
      const d = draft(),
        s = surveyEarthwork(w, p, d),
        pad = s.pad;
      const reach = earthworkSurveyReach(w, p, d);
      valid =
        s.reason || !reach.allowed || p.task || p.game || p.hitch || p.atHome || p.inside
          ? undefined
          : { ...d, target: pad.target };
      reachStatus.textContent = reach.allowed
        ? `Centre ${number(reach.distance)} m away — within this world's ${number(reach.reach)} m survey reach. Confirm reserves the area; it does not do the work.`
        : `Centre ${number(reach.distance)} m away. Move within ${number(reach.reach)} m of the centre, or choose Centre on me.`;
      if (p.task || p.game || p.hitch || p.atHome || p.inside)
        reachStatus.textContent = 'Finish your activity and go outside to confirm a survey.';
      const c = Math.cos(pad.rotation),
        sn = Math.sin(pad.rotation),
        nx = Math.ceil(pad.width / 2),
        nz = Math.ceil(pad.depth / 2);
      for (let i = 0; i < nx; i++)
        for (let j = 0; j < nz; j++) {
          const a = ((i + 0.5) / nx - 0.5) * pad.width,
            b = ((j + 0.5) / nz - 0.5) * pad.depth,
            x = pad.x + a * c + b * sn,
            z = pad.z - a * sn + b * c,
            delta = terrainHeight(w, x, z) - pad.target,
            at = screen(x, z);
          ctx.save();
          ctx.translate(at.x, at.y);
          ctx.rotate(-pad.rotation);
          ctx.fillStyle = delta > 0.02 ? '#d3a65e' : delta < -0.02 ? '#76b2c8' : '#91b783';
          ctx.fillRect(
            ((-pad.width / nx) * scale) / 2,
            ((-pad.depth / nz) * scale) / 2,
            (pad.width / nx) * scale + 0.2,
            (pad.depth / nz) * scale + 0.2,
          );
          ctx.restore();
        }
      const at = screen(pad.x, pad.z);
      ctx.save();
      ctx.translate(at.x, at.y);
      ctx.rotate(-pad.rotation);
      ctx.strokeStyle = '#eee3bc';
      ctx.strokeRect(
        (-pad.width / 2) * scale,
        (-pad.depth / 2) * scale,
        pad.width * scale,
        pad.depth * scale,
      );
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(
        -(pad.width / 2 + pad.shoulder) * scale,
        -(pad.depth / 2 + pad.shoulder) * scale,
        (pad.width + pad.shoulder * 2) * scale,
        (pad.depth + pad.shoulder * 2) * scale,
      );
      ctx.restore();
      ctx.setLineDash([]);
      summary.innerHTML = `<p><b>Cut ${number(s.cut)} m³ · Fill ${number(s.fill)} m³</b><br>${s.cut >= s.fill ? `Net surplus ${number(s.cut - s.fill)} m³` : `Deliver ${number(s.shortfall)} m³ of fill`} · ${esc(worldItems(w)[s.material].name)} · effort ×${number(s.effort)}<br>About ${s.passes} passes (${number(s.travel)} m) and ${number(s.fuel)} tank units at full health.<br>Natural level ${number(s.minimum)}–${number(s.maximum)} m; permitted target ${number(s.minTarget)}–${number(s.maxTarget)} m. Target ${number(pad.target)} m; shoulder ${number(pad.shoulder)} m.</p>${s.reason ? `<p role="alert">${esc(s.reason)}</p>` : ''}`;
    } catch (e) {
      summary.textContent = (e as Error).message;
    }
    const at = screen(p.x, p.z);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(at.x, at.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText('You', at.x + 7, at.y - 7);
    ctx.fillText('N ↑', 8, 16);
    confirm.disabled = !valid;
  }
  function refresh() {
    const { w, p } = getState(),
      jobs = (w.earthworks ?? []).filter(
        (e) =>
          e.work &&
          (e.owner === p.id ||
            e.work.operators.includes(p.id) ||
            (e.work.pendingApproval && earthworkPropertyOwners(w, e).includes(p.id)) ||
            ['offered', 'accepted'].includes(e.work.contract?.state ?? '')),
      );
    const positionKey = JSON.stringify([
      p.x,
      p.z,
      p.vehicle,
      p.task,
      p.game,
      p.hitch,
      p.atHome,
      p.inside,
      w.settings,
      w.earthworks,
    ]);
    if (positionKey !== previewKey) {
      previewKey = positionKey;
      preview();
    }
    if (confirming && jobs.some((e) => e.owner === p.id && !initialIds.has(e.id))) {
      confirming = false;
      (root.querySelector('[data-earthwork-new]') as HTMLDetailsElement).open = false;
      sites.scrollIntoView({ block: 'nearest' });
    }
    const next = JSON.stringify([
      jobs,
      p.x,
      p.z,
      p.vehicle,
      p.engine,
      p.earthmovingImplement,
      p.fuel,
      p.speed,

      p.earthmovingCargo,
      p.inventory,
      Object.values(w.trailers ?? {})
        .filter((t) => t.owner === p.id)
        .map((t) => [t.id, t.cargo]),
    ]);
    if (
      next === key ||
      (sites.contains(document.activeElement) &&
        document.activeElement?.matches('input,select,textarea'))
    )
      return;
    key = next;
    // Refresh the amounts without discarding the player's next transfer choice.
    const choices = new Map<string, string>();
    const expanded = new Set<string>();
    for (const article of sites.querySelectorAll<HTMLElement>('[data-earthwork-site]'))
      [...article.querySelectorAll('details')].forEach((detail, i) => {
        if (detail.open) expanded.add(`${article.dataset.id}:${i}`);
      });
    for (const article of sites.querySelectorAll<HTMLElement>('[data-earthwork-site]'))
      for (const field of article.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        'input[name],select[name]',
      ))
        choices.set(`${article.dataset.id}:${field.name}`, field.value);
    sites.innerHTML = jobs.length
      ? jobs
          .map((pad) => {
            const work = pad.work!,
              remaining = Math.max(0, work.fill - work.cut - work.delivered),
              id = esc(pad.id),
              allowed =
                !work.pendingApproval &&
                (pad.owner === p.id || work.operators.includes(p.id)) &&
                earthworkOperatorAllowed(pad, p.id);
            const trailers = Object.values(w.trailers ?? {}).filter(
              (t) => !trailerStorage(w, t) && t.kind === 'dump' && t.owner === p.id,
            );
            const store = `<label>Transfer with<select name="trailer"><option value="">Carried inventory / site heap</option>${trailers.map((t) => `<option value="${esc(t.id)}">Tipping trailer ${esc(t.id)}</option>`).join('')}</select></label>`;
            const guidance = earthworkGuidance(w, p, pad.id);
            return `<article data-earthwork-site data-id="${id}"><h3>Pad at ${number(pad.x)}, ${number(pad.z)} — ${Math.floor(pad.progress * 100)}%</h3>${allowed ? `<button type="button" data-earthwork-guide="${id}">Guide me here</button><p>${guidance?.pad?.id === pad.id ? esc(guidance.message) : 'Board a backhoe or bulldozer to see this work area and driving instructions.'}</p>` : ''}<details><summary>Site details and contracts</summary>${contractPanel(w, p, pad)}</details><p>${work.pendingApproval ? 'Awaiting permission' : pad.progress === 1 ? 'Complete — leave as level ground or build here' : work.active ? 'Reserved — drive slowly inside with the implement down' : 'Abandoned — the partial ground remains'}. Cut ${number(work.cut)} m³; fill ${number(work.fill)} m³. <b>${remaining > 0 ? `Deliver ${number(remaining)} m³ more fill` : 'Fill supplied'}</b>.<br>Site spoil: ${
              itemEntries(work.spoil, worldItems(w), work.spoil)
                .map(([k, n]) => `${n} ${esc(worldItems(w)[k].name)}`)
                .join(', ') || 'empty'
            }. Bucket: ${number(stockWeight(w, p.earthmovingCargo?.[p.vehicle] ?? {}))} weight. Finish: ${pad.finish}.</p>
   ${allowed && pad.progress < 1 ? `<button type="button" data-earthwork-op="${work.active ? 'abandon' : 'resume'}">${work.active ? 'Abandon work' : 'Resume work'}</button>` : ''}
   ${allowed ? `<details data-earthwork-materials><summary>Materials and spoil${remaining > 0 ? ` — fill needed` : ''}</summary><p>Choose a store and material, then the quantity to move. Deliver fill supplies this site; Unload bucket empties your backhoe; Collect site spoil takes material from the site heap.</p><form data-earthwork-transfer>${store}<label>Material<select name="item"><option value="dirt">Topsoil</option><option value="gravel">Gravel</option><option value="stone">Stone</option></select></label>${input('Quantity', 'quantity', 1, 'min="1" step="1"')}<div class="button-row"><button type="submit" name="operation" value="deliver" ${remaining <= 0 ? 'disabled' : ''}>Deliver fill</button><button type="submit" name="operation" value="unload">Unload bucket</button><button type="submit" name="operation" value="collect">Collect site spoil</button>${pad.progress === 1 ? '<button type="submit" name="operation" value="gravel">Spread gravel</button>' : ''}</div></form></details>` : ''}
   ${
     pad.owner === p.id && !work.pendingApproval
       ? `<details><summary>Operator permissions</summary><form data-earthwork-consent><label>Allow an operator<select name="operator">${Object.values(
           w.players,
         )
           .filter((q) => q.id !== p.id)
           .map((q) => `<option value="${esc(q.id)}">${esc(q.name)}</option>`)
           .join('')}</select></label><button>Give permission</button></form></details>`
       : ''
   }</article>`;
          })
          .join('')
      : '<p>No earthwork sites. Start with Survey a new pad below.</p>';
    for (const article of sites.querySelectorAll<HTMLElement>('[data-earthwork-site]'))
      [...article.querySelectorAll('details')].forEach((detail, i) => {
        detail.open = expanded.has(`${article.dataset.id}:${i}`);
      });
    for (const article of sites.querySelectorAll<HTMLElement>('[data-earthwork-site]'))
      for (const field of article.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        'input[name],select[name]',
      )) {
        const value = choices.get(`${article.dataset.id}:${field.name}`);
        if (
          value !== undefined &&
          (!(field instanceof HTMLSelectElement) ||
            [...field.options].some((o) => o.value === value))
        )
          field.value = value;
      }
    preview();
  }
  const submit = (e: SubmitEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.target as HTMLFormElement;
    if (target === form) {
      preview();
      if (valid) {
        initialIds.clear();
        for (const pad of getState().w.earthworks ?? []) initialIds.add(pad.id);
        confirming = true;
        send({ type: 'earthwork', operation: 'confirm', ...valid });
      }
      return;
    }
    const values = Object.fromEntries(new FormData(target).entries()),
      id = target.closest<HTMLElement>('[data-earthwork-site]')?.dataset.id;
    const operation = target.hasAttribute('data-earthwork-consent')
      ? 'consent'
      : target.hasAttribute('data-earthwork-offer')
        ? 'offer'
        : (e.submitter as HTMLButtonElement)?.value;
    send({
      type: 'earthwork',
      id,
      ...values,
      fee: Math.round(Number(values.feeDenarii) * 100),
      quantity: Number(values.quantity),
      operation,
    });
    (document.activeElement as HTMLElement)?.blur();
  };
  const click = (e: MouseEvent) => {
    const target = e.target as Element;
    if (target.closest('[data-earthwork-centre]')) {
      const { p } = getState();
      origin.x = p.x;
      origin.z = p.z;
      field('x').value = String(p.x);
      field('z').value = String(p.z);
      preview();
    }
    if (target.closest('[data-earthwork-level]')) {
      const { w } = getState();
      field('target').value = String(
        Math.round(terrainHeight(w, Number(field('x').value), Number(field('z').value)) * 100) /
          100,
      );
      preview();
    }
    const selected = target.closest<HTMLElement>('[data-earthwork-guide]');
    if (selected) guide(selected.dataset.earthworkGuide!);
    const b = (e.target as Element).closest<HTMLElement>('[data-earthwork-op]');
    if (b)
      send({
        type: 'earthwork',
        operation: b.dataset.earthworkOp,
        id: b.closest<HTMLElement>('[data-earthwork-site]')!.dataset.id,
      });
  };
  let start: { x: number; z: number } | undefined;
  const point = (e: PointerEvent) => {
    const bounds = canvas.getBoundingClientRect();
    return {
      x:
        origin.x +
        (((e.clientX - bounds.left) / bounds.width) * canvas.width - canvas.width / 2) / scale,
      z:
        origin.z +
        (((e.clientY - bounds.top) / bounds.height) * canvas.height - canvas.height / 2) / scale,
    };
  };
  const down = (e: PointerEvent) => {
    start = point(e);
    canvas.setPointerCapture(e.pointerId);
  };
  const drag = (e: PointerEvent) => {
    if (!start) return;
    const end = point(e);
    for (const [k, n] of Object.entries({
      x: (start.x + end.x) / 2,
      z: (start.z + end.z) / 2,
      width: Math.max(1, Math.min(r.earthworksMaximumSide, Math.abs(end.x - start.x))),
      depth: Math.max(1, Math.min(r.earthworksMaximumSide, Math.abs(end.z - start.z))),
      rotation: 0,
    }))
      field(k).value = String(Math.round(n * 10) / 10);
    preview();
  };
  const up = () => {
    start = undefined;
    preview();
  };
  form.addEventListener('input', preview);
  root.addEventListener('submit', submit);
  root.addEventListener('click', click);
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', drag);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  preview();
  refresh();
  const timer = setInterval(refresh, 500);
  return () => {
    clearInterval(timer);
    form.removeEventListener('input', preview);
    root.removeEventListener('submit', submit);
    root.removeEventListener('click', click);
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', drag);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', up);
  };
}
