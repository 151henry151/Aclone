// SPDX-License-Identifier: GPL-3.0-or-later
import { landscapeSchema, type Landscape } from '../shared/landscape';
import { terrainHeight } from '../shared/terrain';
import { townRoads, type Point } from '../shared/town';
import type { World, Player, Action } from '../shared/types';
const esc = (s: unknown) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const field = (label: string, name: string, value: unknown, extra = '') =>
  `<label>${label}<input type="number" name="${name}" value="${esc(value)}" ${extra}></label>`;
let points: Point[] = [],
  draftMap: number[] | undefined,
  context = '';
export function landscapeEditor(w: World, p: Player) {
  if (context !== w.id) {
    context = w.id;
    points = [];
    draftMap = undefined;
  }
  const l = w.landscape ?? landscapeSchema.parse({});
  return `<p>Changes apply live. Click or tap the map to mark a path or fence; its first point also centres brushes. North is up. Map points can also be entered as X,Z pairs below.</p>
  <canvas id="landscape-map" width="500" height="500" style="width:100%;max-width:500px;aspect-ratio:1;touch-action:none" aria-label="Landscape layout preview"></canvas>
  <label>Map points<textarea id="landscape-points" rows="3" placeholder="-50,-50; 0,-30; 40,-50">${points.map((p) => `${p.x},${p.z}`).join('; ')}</textarea></label><button type="button" id="landscape-clear">Clear points</button>
  <h3>Paths and barriers</h3><form id="landscape-line-form"><label>Feature<select name="kind"><option value="path">Curved gravel path</option><option value="straight">Straight gravel path</option><option value="fence">Timber fence</option><option value="wall">Stone wall</option></select></label><div class="settings-grid">${field('Width in metres', 'width', 3, 'min="0.2" max="20" step="0.1"')}${field('Barrier height', 'height', 1.5, 'min="0.5" max="8" step="0.1"')}</div><button>Add path or barrier</button></form>
  <h3>Surface brush</h3><form id="landscape-surface-form"><label>Surface<select name="material"><option>grass</option><option>gravel</option><option>soil</option><option>sand</option></select></label><div class="settings-grid">${field('Centre X', 'x', Math.round(p.x), 'min="-250" max="250"')}${field('Centre Z', 'z', Math.round(p.z), 'min="-250" max="250"')}${field('Radius', 'radius', 15, 'min="1" max="100"')}</div><button>Paint surface</button></form>
  <h3>Scatter Workshop models</h3><p>Repeat a tree or rock model with varied rotations and sizes. Avoids roads, buildings, water and overlaps; crowded brushes may place fewer objects. Optional solids block vehicles and shots.</p><form id="landscape-scatter-form"><label>Model<select name="model">${(w.creator?.models ?? []).map((m) => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('')}</select></label><div class="settings-grid">${field('Centre X', 'x', Math.round(p.x), 'min="-250" max="250"')}${field('Centre Z', 'z', Math.round(p.z), 'min="-250" max="250"')}${field('Radius', 'radius', 25, 'min="2" max="100"')}${field('Count', 'count', 12, 'min="1" max="64"')}${field('Seed', 'seed', 1, 'min="0" max="1000000000"')}${field('Scale', 'scale', 1, 'min="0.2" max="3" step="0.1"')}</div><label><input type="checkbox" name="solid">Solid obstacles</label><button ${w.creator?.models.length ? '' : 'disabled'}>Scatter models</button></form>
  <h3>Heightmap import</h3><p>PNG/JPEG brightness becomes absolute ground height, sampled to 33 × 33 across the world. Black maps to the low value; white to the high value. Blue in the preview is submerged. Preview first; applying replaces the base terrain, retaining existing height brushes.</p><form id="landscape-heightmap-form"><label>Heightmap image<input type="file" name="file" accept="image/png,image/jpeg" required></label><div class="settings-grid">${field('Black height', 'low', -10, 'min="-40" max="40"')}${field('White height', 'high', 25, 'min="-40" max="40"')}</div><button>Preview heightmap</button><button type="button" id="landscape-apply-map" ${draftMap ? '' : 'disabled'}>Apply previewed heightmap</button><p id="landscape-feedback" role="status"></p></form>
  <h3>Raise or lower ground</h3><form data-action="terrain"><div class="settings-grid">${field('X', 'x', Math.round(p.x))}${field('Z', 'z', Math.round(p.z))}${field('Brush radius', 'radius', 20, 'min="1" max="100"')}${field('Height change', 'height', 5, 'min="-30" max="30"')}</div><button>Apply terrain brush</button></form>
  <h3>Saved landscape edits</h3><button type="button" id="landscape-undo" ${w.landscapeUndo ? '' : 'disabled'}>Undo last landscape edit</button><p>Undo retains the last four path, surface, scatter or heightmap changes. Remove individual height brushes in Layout.</p>${(['paths', 'surfaces', 'barriers', 'scatter'] as const).flatMap((key) => l[key].map((v) => `<p>${key}: ${esc(v.id)} <button type="button" data-landscape-remove="${key}" data-landscape-id="${esc(v.id)}">Remove</button></p>`)).join('')}${l.heightmap ? '<button type="button" data-landscape-remove="heightmap">Restore procedural terrain</button>' : ''}`;
}
export function landscapeControls(w: World, send: (a: Action) => void) {
  const canvas = document.querySelector<HTMLCanvasElement>('#landscape-map');
  if (!canvas) return;
  const l = () => structuredClone(w.landscape ?? landscapeSchema.parse({}));
  const save = (next: Landscape) => send({ type: 'landscape', landscape: next });
  const ctx = canvas.getContext('2d')!;
  const draw = () => {
    const preview = { ...w, landscape: { ...l(), ...(draftMap ? { heightmap: draftMap } : {}) } };
    for (let z = 0; z < 500; z += 5)
      for (let x = 0; x < 500; x += 5) {
        const h = terrainHeight(preview, x - 250, z - 250);
        ctx.fillStyle =
          h < w.settings.seaLevel
            ? '#386775'
            : `hsl(86 22% ${Math.max(18, Math.min(70, 36 + h / 2))}%)`;
        ctx.fillRect(x, z, 5, 5);
      }
    for (const s of w.landscape?.surfaces ?? []) {
      ctx.fillStyle = { grass: '#719354', gravel: '#9a9484', soil: '#6d4d36', sand: '#c0ab77' }[
        s.material
      ];
      ctx.beginPath();
      ctx.arc(s.x + 250, s.z + 250, s.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#c5b58c';
    for (const r of townRoads(w)) {
      ctx.lineWidth = r.width;
      ctx.beginPath();
      ctx.moveTo(r.a.x + 250, r.a.z + 250);
      ctx.lineTo(r.b.x + 250, r.b.z + 250);
      ctx.stroke();
    }
    ctx.strokeStyle = '#f4d9ac';
    ctx.lineWidth = 2;
    for (const b of w.landscape?.barriers ?? []) {
      ctx.beginPath();
      b.points.forEach((p, i) =>
        i ? ctx.lineTo(p.x + 250, p.z + 250) : ctx.moveTo(p.x + 250, p.z + 250),
      );
      ctx.stroke();
    }
    ctx.fillStyle = '#efe0b4';
    for (const b of w.buildings) ctx.fillRect(b.x + 246, b.z + 246, 8, 8);
    ctx.strokeStyle = '#f6ae58';
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((p, i) =>
      i ? ctx.lineTo(p.x + 250, p.z + 250) : ctx.moveTo(p.x + 250, p.z + 250),
    );
    ctx.stroke();
    ctx.fillStyle = '#fff';
    points.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x + 250, p.z + 250, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  };
  const pointInput = document.querySelector<HTMLTextAreaElement>('#landscape-points')!;
  const feedback = (text: string) => {
    document.querySelector('#landscape-feedback')!.textContent = text;
  };
  canvas.onclick = (e) => {
    if (points.length >= 16) {
      feedback('Limit: 16 points per line. Clear the points to start again.');
      return;
    }
    const b = canvas.getBoundingClientRect();
    points.push({
      x: Math.round(((e.clientX - b.left) / b.width) * 500 - 250),
      z: Math.round(((e.clientY - b.top) / b.height) * 500 - 250),
    });
    pointInput.value = points.map((p) => `${p.x},${p.z}`).join('; ');
    if (points.length === 1)
      for (const id of ['surface', 'scatter'])
        for (const k of ['x', 'z'] as const)
          (document.querySelector(`#landscape-${id}-form [name=${k}]`) as HTMLInputElement).value =
            String(points[0][k]);
    draw();
  };
  document.querySelector<HTMLButtonElement>('#landscape-clear')!.onclick = () => {
    points = [];
    pointInput.value = '';
    draw();
  };
  pointInput.onchange = () => {
    const parsed = pointInput.value
      .split(';')
      .filter((s) => s.trim())
      .map((s) => {
        const [x, z] = s.trim().split(',').map(Number);
        return { x, z };
      });
    if (
      parsed.length > 16 ||
      parsed.some(
        (p) =>
          !Number.isFinite(p.x) ||
          !Number.isFinite(p.z) ||
          Math.abs(p.x) > 250 ||
          Math.abs(p.z) > 250,
      )
    ) {
      feedback('Use up to 16 X,Z pairs within −250…250.');
      return;
    }
    points = parsed;
    draw();
  };
  const bind = (id: string, handler: (data: FormData) => void | Promise<void>) => {
    document.querySelector<HTMLFormElement>(`#landscape-${id}-form`)!.onsubmit = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        await handler(new FormData(e.currentTarget as HTMLFormElement));
      } catch (err) {
        feedback((err as Error).message);
      }
    };
  };
  const nextId = () => 'land-' + crypto.randomUUID().slice(0, 8);
  bind('line', (d) => {
    const next = l(),
      kind = String(d.get('kind')),
      width = Number(d.get('width'));
    if (kind === 'path' || kind === 'straight')
      next.paths.push({ id: nextId(), points: [...points], width, curved: kind === 'path' });
    else
      next.barriers.push({
        id: nextId(),
        points: [...points],
        width,
        height: Number(d.get('height')),
        kind: kind as 'fence' | 'wall',
      });
    save(landscapeSchema.parse(next));
  });
  bind('surface', (d) => {
    const next = l();
    next.surfaces.push({
      id: nextId(),
      x: Number(d.get('x')),
      z: Number(d.get('z')),
      radius: Number(d.get('radius')),
      material: String(d.get('material')) as Landscape['surfaces'][number]['material'],
    });
    save(landscapeSchema.parse(next));
  });
  bind('scatter', (d) => {
    const next = l();
    next.scatter.push({
      id: nextId(),
      model: String(d.get('model')),
      x: Number(d.get('x')),
      z: Number(d.get('z')),
      radius: Number(d.get('radius')),
      count: Number(d.get('count')),
      seed: Number(d.get('seed')),
      scale: Number(d.get('scale')),
      solid: d.has('solid'),
    });
    save(landscapeSchema.parse(next));
  });
  let previewVersion = 0;
  const mapForm = document.querySelector<HTMLFormElement>('#landscape-heightmap-form')!;
  mapForm.oninput = () => {
    previewVersion++;
    draftMap = undefined;
    document.querySelector<HTMLButtonElement>('#landscape-apply-map')!.disabled = true;
    draw();
  };
  bind('heightmap', async (d) => {
    const version = ++previewVersion,
      file = d.get('file') as File,
      low = Number(d.get('low')),
      high = Number(d.get('high'));
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 2 * 1024 * 1024)
      throw Error('Choose a PNG/JPEG no larger than 2 MiB.');
    if (low >= high || low < -40 || high > 40)
      throw Error('Choose increasing heights within −40…40 metres.');
    const bitmap = await createImageBitmap(file);
    try {
      if (bitmap.width > 2048 || bitmap.height > 2048)
        throw Error('Maximum image dimensions: 2048 × 2048.');
      const small = document.createElement('canvas');
      small.width = small.height = 33;
      const context = small.getContext('2d')!;
      context.drawImage(bitmap, 0, 0, 33, 33);
      const pixels = context.getImageData(0, 0, 33, 33).data;
      if (version !== previewVersion) return;
      draftMap = Array.from(
        { length: 1089 },
        (_, i) =>
          Math.round(
            (low +
              ((high - low) *
                (pixels[i * 4] * 0.2126 +
                  pixels[i * 4 + 1] * 0.7152 +
                  pixels[i * 4 + 2] * 0.0722)) /
                255) *
              100,
          ) / 100,
      );
      document.querySelector<HTMLButtonElement>('#landscape-apply-map')!.disabled = false;
      feedback(
        `Preview ready: ${low} to ${high} metres. This will move buildings and ground; check shoreline and roads before applying.`,
      );
      draw();
    } finally {
      bitmap.close();
    }
  });
  document.querySelector<HTMLButtonElement>('#landscape-apply-map')!.onclick = () => {
    if (draftMap) {
      const next = l();
      next.heightmap = draftMap;
      save(next);
      draftMap = undefined;
    }
  };
  document.querySelector<HTMLButtonElement>('#landscape-undo')!.onclick = () =>
    send({ type: 'landscape', operation: 'undo' });
  document.querySelectorAll<HTMLButtonElement>('[data-landscape-remove]').forEach(
    (b) =>
      (b.onclick = () => {
        const next = l(),
          key = b.dataset.landscapeRemove!;
        if (key === 'heightmap') delete next.heightmap;
        else {
          const k = key as 'paths' | 'surfaces' | 'barriers' | 'scatter';
          (next[k] as { id: string }[]) = next[k].filter((v) => v.id !== b.dataset.landscapeId);
        }
        save(next);
      }),
  );
  draw();
}
