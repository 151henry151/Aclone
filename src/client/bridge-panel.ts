// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player, Action } from '../shared/types';
import type { Point } from '../shared/town';
import { bridgeRules } from '../shared/bridge-rules';
import { bridgeAccessReason } from '../shared/bridge-geometry';
import { bridgeRepairBill } from '../shared/bridges';
import { riverBanks } from '../shared/inland-water';
import { money } from '../shared/simulation';
export interface BridgeDraft {
  world: string;
  a: Point;
  b: Point;
  design: 'narrow' | 'wide';
}
const esc = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const materialNames = { steel: 'Steel', wood: 'Wood', gravel: 'Gravel', stone: 'Stone' } as const;
const button = (op: string, label: string, fields = '', disabled = false) =>
  `<button type="button" data-bridge-op="${op}" ${fields} ${disabled ? 'disabled' : ''}>${label}</button>`;
export function bridgePanel(w: World, p: Player, draft: BridgeDraft) {
  const rules = bridgeRules(w.settings),
    cash = (n: number) => money(n, w.settings.denariiPerSheckle),
    size = rules.bridgeMaximumSpan * 2;
  const path = (points: Point[]) =>
    points.map((q) => `${q.x - draft.a.x},${q.z - draft.a.z}`).join(' ');
  const water = (w.northernIsland?.rivers ?? [])
    .flatMap((r) => {
      const points = r.points.filter(
        (q) =>
          Math.abs(q.x - draft.a.x) <= size / 2 + q.width &&
          Math.abs(q.z - draft.a.z) <= size / 2 + q.width,
      );
      if (points.length < 2) return [];
      const banks = riverBanks(points);
      return [
        `<polygon points="${path([...banks.map((b) => b.left), ...banks.map((b) => b.right).reverse()])}" fill="#527f91"/>`,
      ];
    })
    .join('');
  const survey = p.bridgeSurvey;
  const old = survey?.status === 'ready' ? survey : undefined;
  const same =
    old &&
    old.plan.a.x === draft.a.x &&
    old.plan.a.z === draft.a.z &&
    old.plan.b.x === draft.b.x &&
    old.plan.b.z === draft.b.z &&
    old.plan.width === (draft.design === 'wide' ? rules.bridgeWidth : rules.bridgeNarrowWidth);
  const ready = same ? old : undefined;
  const preview = ready?.plan;
  const approved = preview
    ? `<polyline points="${path([preview.approachA, preview.a, preview.b, preview.approachB])}" fill="none" stroke="#c7b885" stroke-width="${preview.width}"/>`
    : '';
  const map = `<svg data-bridge-map data-size="${size}" viewBox="${-size / 2} ${-size / 2} ${size} ${size}" style="display:block;width:100%;max-height:320px;background:#506247;cursor:crosshair" role="img" aria-label="Choose the opposite river bank on this local map">${water}${approved}<line x1="0" y1="0" x2="${draft.b.x - draft.a.x}" y2="${draft.b.z - draft.a.z}" stroke="#f5d576" stroke-width="1.5" stroke-dasharray="4 3"/><circle cx="0" cy="0" r="3" fill="#fff3b5"/><circle cx="${draft.b.x - draft.a.x}" cy="${draft.b.z - draft.a.z}" r="3" fill="#edc470"/><text x="${-size / 2 + 6}" y="${-size / 2 + 13}" fill="white" font-size="8">N ↑ · local river survey</text></svg>`;
  let quote =
    survey?.status === 'pending'
      ? '<p role="status">Surveying both banks, the deck and approaches…</p>'
      : survey?.status === 'failed'
        ? `<p role="alert">${esc(survey.reason)}</p>`
        : '';
  if (old && !same)
    quote =
      '<p role="status">The selected span or design changed; survey again for a fresh quote.</p>';
  if (preview) {
    const span = Math.hypot(preview.a.x - preview.b.x, preview.a.z - preview.b.z),
      approaches =
        Math.hypot(preview.a.x - preview.approachA.x, preview.a.z - preview.approachA.z) +
        Math.hypot(preview.b.x - preview.approachB.x, preview.b.z - preview.approachB.z);
    const deposit = Math.ceil(preview.bill.cash * rules.bridgeDepositFraction);
    quote += `<section data-bridge-quote><h3>Survey approved</h3><p>${span.toFixed(1)} m span · ${preview.width} m clear lane · ${approaches.toFixed(0)} m of dry approaches · ${(preview.deckY - preview.thickness - preview.highWater).toFixed(1)} m river clearance.</p><p>Total: <strong>${cash(preview.bill.cash)}</strong> plus ${Object.entries(
      preview.bill.materials,
    )
      .map(([k, n]) => `${n.toLocaleString()} ${materialNames[k as keyof typeof materialNames]}`)
      .join(
        ', ',
      )}.</p><p>Founding deposit: ${cash(deposit)}. All cash and material contributions are final and not refundable. The full site is reserved when you found the project.</p>${p.cash < deposit ? '<p role="alert">Not enough cash for the founding deposit.</p>' : ''}${button('found', `Pay ${cash(deposit)} and found bridge`, `data-quote="${esc(ready!.id)}"`, p.cash < deposit || !rules.bridgeBuilding)}</section>`;
  }
  const projects = (w.bridges ?? [])
    .slice()
    .sort((a, b) => Math.hypot(p.x - a.a.x, p.z - a.a.z) - Math.hypot(p.x - b.a.x, p.z - b.a.z))
    .map((b) => {
      const distance = Math.min(
          ...[b.a, b.b, b.approachA, b.approachB].map((q) => Math.hypot(p.x - q.x, p.z - q.z)),
        ),
        near = distance <= rules.bridgeServiceReach;
      const attrs = `data-id="${esc(b.id)}" data-revision="${b.revision}"`,
        complete = b.completedAt !== undefined;
      let content = `<article data-bridge-project="${esc(b.id)}"><h3>${complete ? 'Bridge complete' : 'Bridge project'} · ${esc(b.id)}</h3><p>Owner: ${esc(w.players[b.owner]?.name ?? b.owner)} · ${distance.toFixed(0)} m from the nearest office${near ? '' : ` · move within ${rules.bridgeServiceReach} m to contribute or manage`}.</p>`;
      if (b.closure) content += `<p role="alert">${esc(b.closure)}</p>`;
      if (!complete) {
        const remaining = b.bill.cash - b.paid.cash;
        content += `<p>${cash(remaining)} cash still needed. Bring materials in your vehicle inventory; contributions are final.</p><form data-bridge-contribute ${attrs}><label>Cash contribution (denarii)<input name="cash" type="number" min="0" step="0.01" value="0" max="${Math.min(remaining, p.cash) / 100}"></label>`;
        for (const [k, label] of Object.entries(materialNames)) {
          const need =
              b.bill.materials[k as keyof typeof materialNames] -
              b.paid.materials[k as keyof typeof materialNames],
            owned = p.inventory[k] ?? 0;
          content += `<label>${label}: ${need} needed; ${owned} carried<input name="${k}" type="number" min="0" step="1" value="0" max="${Math.min(need, owned)}"></label>`;
        }
        if (!Object.keys(materialNames).some((k) => (p.inventory[k] ?? 0) > 0))
          content +=
            '<p>No bridge materials carried. Collect supplies before donating materials.</p>';
        content += `<button ${near && !b.closure ? '' : 'disabled'}>Contribute selected amounts</button></form>`;
      } else {
        const reason = bridgeAccessReason(w, p, b),
          repair = bridgeRepairBill(w.settings, b);
        content += `<p>Condition ${b.condition.toFixed(1)}% · ${reason ? esc(reason) : rules.bridgeToll ? `Passage ${cash(rules.bridgeToll)}` : 'Public and toll-free'}.</p>${button('passage', p.bridgePasses?.[b.id] ? 'Passage already held' : `Buy passage · ${cash(b.owner === p.id ? 0 : rules.bridgeToll)}`, attrs, !near || !!reason || !!p.bridgePasses?.[b.id])}<p>Repair: ${cash(repair.cash)} and ${repair.materials.steel} Steel; restore up to ${rules.bridgeRepairCondition} condition.</p>${button('repair', 'Pay for repair', attrs, !near || b.condition >= 100)}`;
      }
      content += `<details><summary>Contributions</summary>${Object.entries(b.contributors)
        .map(
          ([id, total]) =>
            `<p>${esc(w.players[id]?.name ?? id)}: ${cash(total.cash)}; ${Object.entries(
              total.materials,
            )
              .map(([k, n]) => `${n} ${materialNames[k as keyof typeof materialNames]}`)
              .join(', ')}.</p>`,
        )
        .join('')}</details>`;
      if (b.owner === p.id || p.authority >= 20)
        content += `<p>Removal requires an empty crossing and returns no contributions.</p>${button('remove', 'Remove empty bridge without refund', attrs, !near)}`;
      return content + '</article>';
    })
    .join('');
  return `<section data-bridge-builder><p>Stand on a dry river bank, then click the opposite bank on the local map. Surveying checks foundations, protected land, approaches and boat clearance before any payment.</p>${!rules.bridgeBuilding ? '<p role="status">New bridge construction is disabled in this world.</p>' : ''}${button('bank', 'Use my current bank')}${map}<label>Bridge design<select data-bridge-design><option value="narrow" ${draft.design === 'narrow' ? 'selected' : ''}>Single lane · ${rules.bridgeNarrowWidth} m</option><option value="wide" ${draft.design === 'wide' ? 'selected' : ''}>Two lanes · ${rules.bridgeWidth} m</option></select></label>${button('survey', 'Survey selected span', '', !rules.bridgeBuilding || survey?.status === 'pending')}${quote}<h2>Shared bridge projects</h2>${projects || '<p>No bridge projects in this world yet.</p>'}</section>`;
}
export function mountBridgePanel(
  root: HTMLElement,
  w: World,
  p: Player,
  draft: BridgeDraft,
  change: (draft: BridgeDraft) => void,
  send: (action: Action) => void,
) {
  const click = (event: MouseEvent) => {
    const target = event.target as Element,
      svg = target.closest<SVGSVGElement>('[data-bridge-map]');
    if (svg) {
      const at = new DOMPoint(event.clientX, event.clientY).matrixTransform(
        svg.getScreenCTM()!.inverse(),
      );
      change({ ...draft, b: { x: draft.a.x + at.x, z: draft.a.z + at.y } });
      return;
    }
    const button = target.closest<HTMLButtonElement>('[data-bridge-op]');
    if (!button || button.disabled) return;
    const op = button.dataset.bridgeOp;
    if (op === 'bank') {
      change({
        ...draft,
        a: { x: p.x, z: p.z },
        b: { x: p.x + Math.sin(p.heading) * 30, z: p.z + Math.cos(p.heading) * 30 },
      });
      return;
    }
    if (op === 'survey') {
      send({ type: 'bridge', op, a: draft.a, b: draft.b, design: draft.design });
      return;
    }
    send({
      type: 'bridge',
      op,
      bridge: button.dataset.id,
      revision: Number(button.dataset.revision),
      quote: button.dataset.quote,
    });
  };
  const select = (event: Event) => {
    const target = event.target as HTMLSelectElement;
    if (target.hasAttribute('data-bridge-design'))
      change({ ...draft, design: target.value as 'wide' | 'narrow' });
  };
  const submit = (event: SubmitEvent) => {
    const form = event.target as HTMLFormElement;
    if (!form.hasAttribute('data-bridge-contribute')) return;
    event.preventDefault();
    event.stopPropagation();
    const data = new FormData(form);
    send({
      type: 'bridge',
      op: 'contribute',
      bridge: form.dataset.id,
      revision: Number(form.dataset.revision),
      cash: Math.round(Number(data.get('cash')) * 100),
      materials: Object.fromEntries(
        Object.keys(materialNames).map((k) => [k, Number(data.get(k))]),
      ),
    });
    (document.activeElement as HTMLElement)?.blur();
  };
  root.addEventListener('click', click);
  root.addEventListener('change', select);
  root.addEventListener('submit', submit);
  return () => {
    root.removeEventListener('click', click);
    root.removeEventListener('change', select);
    root.removeEventListener('submit', submit);
  };
}
