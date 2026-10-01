// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player } from '../shared/types';
import { townRoads } from '../shared/town';
import { resourceNodes } from '../shared/resources';
import { checkpoints } from '../shared/catalog';
import { mapBounds, placeMapLabels, type MapBounds } from './map-layout';

const ns = 'http://www.w3.org/2000/svg';
function svg(tag: string, attrs: Record<string, string | number> = {}) {
  const node = document.createElementNS(ns, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}
/** A persistent DOM surface: snapshots update markers without replacing focused
 * controls, resetting the zoom, or interrupting a mouse/touch gesture. */
export class ParishMap {
  private viewport: HTMLDivElement;
  private sheet: HTMLDivElement;
  private players = svg('g');
  private observer: ResizeObserver;
  private world: World;
  private me: Player;
  private bounds: MapBounds;
  private signature = '';
  private zoom = 1;
  private width = 900;
  private height = 600;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private baseWidth = 900;
  private abort = new AbortController();
  constructor(
    private host: HTMLElement,
    w: World,
    me: Player,
    openBuilding: (id: string) => void,
  ) {
    this.world = w;
    this.me = me;
    this.bounds = mapBounds(w, me);
    host.innerHTML = `<div class="parish-map-tools"><div class="button-row"><button type="button" data-map="out" aria-label="Zoom out">−</button><output class="parish-map-zoom" aria-label="Map zoom">100%</output><button type="button" data-map="in" aria-label="Zoom in">+</button><button type="button" data-map="fit">Fit parish</button><button type="button" data-map="you">Find me</button></div><button type="button" data-do="directory" aria-label="Parish directory">Parish directory ↗</button></div><div class="parish-map-viewport" tabindex="0" role="region" aria-label="Parish map; drag, scroll or use arrow keys to pan"><div class="parish-map-sheet"></div></div><div class="parish-map-key"><span><i class="map-symbol you"></i>You</span><span><i class="map-symbol building"></i>Building · click name to inspect</span><span><i class="map-symbol resource"></i>Gathering ground</span><span><i class="map-symbol player"></i>Other players</span><strong>N ↑</strong></div><p class="parish-map-help">Drag or scroll to explore · zoom for crowded labels · M or Esc to close. Travel to buildings to use them.</p>`;
    this.viewport = host.querySelector('.parish-map-viewport')!;
    this.sheet = host.querySelector('.parish-map-sheet')!;
    host.addEventListener(
      'click',
      (e) => {
        const button = (e.target as Element).closest<HTMLButtonElement>('button');
        if (!button) return;
        if (button.dataset.site) {
          openBuilding(button.dataset.site);
          return;
        }
        const action = button.dataset.map;
        if (!action) return;
        const centre = this.centre();
        if (action === 'in') this.zoom = Math.min(3, this.zoom + 0.5);
        if (action === 'out') this.zoom = Math.max(1, this.zoom - 0.5);
        if (action === 'fit' || action === 'you') this.bounds = mapBounds(this.world, this.me);
        if (action === 'fit') this.zoom = 1;
        this.draw();
        this.updatePlayers();
        if (action === 'you') this.panTo(this.me.x, this.me.z);
        else if (action === 'fit')
          this.panTo(this.bounds.x + this.bounds.width / 2, this.bounds.z + this.bounds.depth / 2);
        else this.panTo(centre.x, centre.z);
      },
      { signal: this.abort.signal },
    );
    this.viewport.addEventListener('keydown', (e) => {
      if (
        e.target !== this.viewport ||
        !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)
      )
        return;
      e.preventDefault();
      e.stopPropagation();
      this.viewport.scrollBy({
        left: e.key === 'ArrowLeft' ? -80 : e.key === 'ArrowRight' ? 80 : 0,
        top: e.key === 'ArrowUp' ? -80 : e.key === 'ArrowDown' ? 80 : 0,
      });
    });
    let drag: { x: number; y: number; left: number; top: number } | undefined;
    this.viewport.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || (e.target as Element).closest('button'))
        return;
      drag = {
        x: e.clientX,
        y: e.clientY,
        left: this.viewport.scrollLeft,
        top: this.viewport.scrollTop,
      };
      this.viewport.setPointerCapture(e.pointerId);
      this.viewport.focus({ preventScroll: true });
      e.preventDefault();
    });
    this.viewport.addEventListener('pointermove', (e) => {
      if (!drag) return;
      this.viewport.scrollLeft = drag.left + drag.x - e.clientX;
      this.viewport.scrollTop = drag.top + drag.y - e.clientY;
    });
    this.viewport.addEventListener('lostpointercapture', () => {
      drag = undefined;
    });
    this.baseWidth = Math.max(900, this.viewport.clientWidth);
    this.update(w, me);
    this.observer = new ResizeObserver(() => {
      const width = Math.max(900, this.viewport.clientWidth);
      if (width === this.baseWidth) return;
      const centre = this.centre();
      this.baseWidth = width;
      this.draw();
      this.updatePlayers();
      this.panTo(centre.x, centre.z);
    });
    this.observer.observe(this.viewport);
    this.panTo(me.x, me.z);
  }
  dispose() {
    this.observer.disconnect();
    this.abort.abort();
  }
  update(w: World, me: Player) {
    this.world = w;
    this.me = me;
    const signature = JSON.stringify([
      w.id,
      w.townLayout,
      w.buildings.map((b) => [b.id, b.name, b.kind, b.x, b.z]),
    ]);
    if (signature !== this.signature) {
      this.signature = signature;
      const centre = this.centre();
      this.bounds = mapBounds(w, me);
      this.draw();
      this.panTo(centre.x, centre.z);
    }
    this.updatePlayers();
  }
  private x(x: number) {
    return this.offsetX + (x - this.bounds.x) * this.scale;
  }
  private y(z: number) {
    return this.offsetY + (z - this.bounds.z) * this.scale;
  }
  private centre() {
    return {
      x:
        this.bounds.x +
        (this.viewport.scrollLeft + this.viewport.clientWidth / 2 - this.offsetX) / this.scale,
      z:
        this.bounds.z +
        (this.viewport.scrollTop + this.viewport.clientHeight / 2 - this.offsetY) / this.scale,
    };
  }
  private panTo(x: number, z: number) {
    this.viewport.scrollLeft = this.x(x) - this.viewport.clientWidth / 2;
    this.viewport.scrollTop = this.y(z) - this.viewport.clientHeight / 2;
  }
  private draw() {
    const focusedSite = (document.activeElement as HTMLElement | null)?.dataset.site;
    this.width = this.baseWidth * this.zoom;
    this.height = Math.max(500, Math.min(620, window.innerHeight * 0.57 - 2)) * this.zoom;
    this.scale = Math.min(
      (this.width - 120) / this.bounds.width,
      (this.height - 90) / this.bounds.depth,
    );
    this.offsetX = (this.width - this.bounds.width * this.scale) / 2;
    this.offsetY = (this.height - this.bounds.depth * this.scale) / 2;
    this.sheet.style.width = `${this.width}px`;
    this.sheet.style.height = `${this.height}px`;
    const drawing = svg('svg', { width: this.width, height: this.height, 'aria-hidden': 'true' });
    drawing.append(svg('rect', { width: this.width, height: this.height, fill: '#4e6247' }));
    for (
      let x = Math.ceil(this.bounds.x / 50) * 50;
      x <= this.bounds.x + this.bounds.width;
      x += 50
    )
      drawing.append(
        svg('path', {
          d: `M${this.x(x)} 0V${this.height}`,
          stroke: '#718160',
          'stroke-opacity': 0.45,
        }),
      );
    for (
      let z = Math.ceil(this.bounds.z / 50) * 50;
      z <= this.bounds.z + this.bounds.depth;
      z += 50
    )
      drawing.append(
        svg('path', {
          d: `M0 ${this.y(z)}H${this.width}`,
          stroke: '#718160',
          'stroke-opacity': 0.45,
        }),
      );
    const coast = Math.max(0, Math.min(this.height, this.y(150)));
    drawing.append(
      svg('rect', {
        x: 0,
        y: coast,
        width: this.width,
        height: this.height - coast,
        fill: '#758e86',
      }),
    );
    drawing.append(
      svg('path', { d: `M0 ${coast}H${this.width}`, stroke: '#afbd9b', 'stroke-width': 3 }),
    );
    const roads = townRoads(this.world);
    for (const outline of [true, false])
      for (const road of roads)
        drawing.append(
          svg('path', {
            d: `M${this.x(road.a.x)} ${this.y(road.a.z)}L${this.x(road.b.x)} ${this.y(road.b.z)}`,
            stroke: outline ? '#344b39' : '#c5b88e',
            'stroke-width': Math.max(2, road.width * this.scale) + (outline ? 3 : 0),
            'stroke-linecap': 'round',
          }),
        );
    drawing.append(
      svg('rect', {
        x: this.x(60),
        y: this.y(20),
        width: 60 * this.scale,
        height: 50 * this.scale,
        fill: '#658058',
        stroke: '#c8d29e',
        'stroke-width': 2,
      }),
    );
    const available = resourceNodes.filter(
      (n) => !this.world.buildings.some((b) => Math.hypot(b.x - n.x, b.z - n.z) < 12),
    );
    for (const n of available)
      drawing.append(
        svg('circle', {
          cx: this.x(n.x),
          cy: this.y(n.z),
          r: 3,
          fill: '#a9cf86',
          stroke: '#243b27',
        }),
      );
    const sites = this.world.buildings.map((b) => ({
      id: b.id,
      name: b.name,
      x: b.x,
      z: b.z,
      kind: b.kind,
      category: 'building',
    }));
    for (const item of ['logs', 'stone', 'gravel', 'dirt']) {
      const nodes = available.filter((n) => n.item === item);
      if (nodes.length)
        sites.push({
          id: `resource-${item}`,
          name: nodes[0].name,
          x: nodes.reduce((s, n) => s + n.x, 0) / nodes.length,
          z: nodes.reduce((s, n) => s + n.z, 0) / nodes.length,
          kind: item === 'logs' ? 'Wood / logs' : item === 'dirt' ? 'Dirt' : item,
          category: 'resource',
        });
    }
    sites.push(
      {
        id: 'hornball',
        name: 'Hornball',
        x: 90,
        z: 45,
        kind: 'Playing field',
        category: 'landmark',
      },
      {
        id: 'circuit',
        name: 'Circuit',
        x: -105,
        z: 30,
        kind: 'Race checkpoints',
        category: 'landmark',
      },
    );
    drawing.append(
      svg('path', {
        d:
          checkpoints.map((p, i) => `${i ? 'L' : 'M'}${this.x(p.x)} ${this.y(p.z)}`).join('') + 'Z',
        fill: 'none',
        stroke: '#d0d9a7',
        'stroke-width': 1.5,
        'stroke-dasharray': '4 5',
      }),
    );
    for (const b of this.world.buildings)
      drawing.append(
        svg('rect', {
          x: this.x(b.x) - 5,
          y: this.y(b.z) - 5,
          width: 10,
          height: 10,
          fill: '#f0ddb0',
          stroke: '#273c2d',
          'stroke-width': 2,
          transform: `rotate(45 ${this.x(b.x)} ${this.y(b.z)})`,
        }),
      );
    const labels = document.createElement('div');
    labels.className = 'parish-map-labels';
    const boxes = placeMapLabels(
      sites.map((s) => ({
        id: s.id,
        x: this.x(s.x),
        y: this.y(s.z),
        width: Math.max(65, Math.min(320, 20 + s.name.length * 7.4)),
      })),
      this.width,
      this.height,
    );
    for (let i = 0; i < sites.length; i++) {
      const site = sites[i],
        box = boxes[i];
      drawing.append(
        svg('path', {
          d: `M${box.x} ${box.y}L${Math.max(box.left, Math.min(box.left + box.width, box.x))} ${Math.max(box.top, Math.min(box.top + box.height, box.y))}`,
          stroke: site.category === 'resource' ? '#b7d391' : '#ebddba',
          'stroke-opacity': 0.75,
        }),
      );
      const label = document.createElement(site.category === 'building' ? 'button' : 'span');
      label.className = `parish-map-${site.category}-label`;
      label.textContent = site.name;
      label.title = `${site.name} · ${site.kind} · (${Math.round(site.x)}, ${Math.round(site.z)})`;
      if (label instanceof HTMLButtonElement) {
        label.type = 'button';
        label.dataset.site = site.id;
      }
      Object.assign(label.style, {
        left: `${box.left}px`,
        top: `${box.top}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
      });
      labels.append(label);
    }
    const scale = svg('g', {
      transform: `translate(24 ${this.height - 30})`,
      fill: '#f4edd6',
      stroke: '#f4edd6',
    });
    scale.append(
      svg('path', { d: `M0 -6V0H${50 * this.scale}V-6`, fill: 'none', 'stroke-width': 2 }),
    );
    const caption = svg('text', { x: 0, y: -12, stroke: 'none', 'font-size': 11 });
    caption.textContent = '50 m';
    scale.append(caption);
    drawing.append(scale);
    // Markers sit above the base map; labels remain native, keyboard-focusable buttons.
    const markers = svg('svg', {
      width: this.width,
      height: this.height,
      class: 'parish-map-players',
      'aria-hidden': 'true',
    });
    this.players = svg('g');
    markers.append(this.players);
    this.sheet.replaceChildren(drawing, labels, markers);
    if (focusedSite)
      [...labels.querySelectorAll<HTMLButtonElement>('button')]
        .find((b) => b.dataset.site === focusedSite)
        ?.focus({ preventScroll: true });
    this.host.querySelector('.parish-map-zoom')!.textContent = `${this.zoom * 100}%`;
    (this.host.querySelector('[data-map="out"]') as HTMLButtonElement).disabled = this.zoom <= 1;
    (this.host.querySelector('[data-map="in"]') as HTMLButtonElement).disabled = this.zoom >= 3;
  }
  private updatePlayers() {
    this.players.replaceChildren();
    for (const p of Object.values(this.world.players)) {
      const self = p.id === this.me.id;
      if (!self && !p.online) continue;
      const marker = svg('g', {
        'data-player-id': p.id,
        transform: `translate(${this.x(p.x)} ${this.y(p.z)})`,
      });
      const title = svg('title');
      title.textContent = self ? 'You' : p.name + (p.npc ? ' · AI' : '');
      marker.append(title);
      marker.append(
        svg('circle', {
          r: self ? 7 : 4,
          fill: self ? '#f5bd77' : '#b9ded7',
          stroke: '#243c32',
          'stroke-width': 2,
        }),
      );
      if (self)
        marker.append(
          svg('path', {
            d: 'M-4 9L0 17L4 9Z',
            fill: '#f5bd77',
            stroke: '#243c32',
            transform: `rotate(${(-p.heading * 180) / Math.PI})`,
          }),
        );
      this.players.append(marker);
    }
  }
}
