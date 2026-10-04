import { bookSchema, townEventSchema } from '../shared/world-stories';
import { booksEditor, eventsEditor } from './story-editor';
import { ambientSchema } from '../shared/ambient';
import { rulesets } from '../shared/rulesets';
import {
  catalogueEditor,
  catalogueForm,
  diagnosticsHtml,
  templatesEditor,
} from './catalogue-editor';
import { catalogueSchema } from '../shared/world-catalogue';
import { worldItems, worldSkills } from '../shared/world-catalogue';
import { questEditor, questForm, guardsEditor } from './quests';
// SPDX-License-Identifier: GPL-3.0-or-later
import { defaults, items, vehicles, recipes, skills } from '../shared/catalog';
import { defaultCreator, blueprintSchema, partSchema, type Blueprint } from '../shared/creator';
import type { World, Player, Action, Settings } from '../shared/types';
import { previewCreator } from './creator-model';
const esc = (s: unknown) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const field = (label: string, key: string, value: unknown, type = 'text', extra = '') =>
  `<label>${esc(label)}<input name="${key}" type="${type}" value="${esc(value)}" ${extra}></label>`;
const select = (label: string, key: string, options: [string, string][], value = '') =>
  `<label>${esc(label)}<select name="${key}">${options.map(([id, name]) => `<option value="${esc(id)}" ${id === value ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select></label>`;
const button = (label: string, action: string, value = '') =>
  `<button type="button" data-do="creator:${action}" data-id="${esc(value)}">${esc(label)}</button>`;
const coord = (key: string, value = 0) =>
  field(key.toUpperCase(), key, value, 'number', 'min="-240" max="240" step="0.1"');
export const creatorTabs = [
  'Start here',
  'Arena',
  'Workshop',
  'Resource visuals',
  'Terrain textures',
  'Audio zones',
  'Objects',
  'Behaviors',
  'Quests',
  'Books',
  'Town events',
  'Access rules',
  'Layout',
  'Production',
  'Catalogue',
  'Building templates',
  'Vehicles',
  'Transfer',
];
let draft: Blueprint | undefined,
  contextWorld = '',
  audioId = '',
  bookId = '',
  eventId = '',
  objectId = '',
  ruleId = '',
  questId = '',
  catalogueItemId = '',
  catalogueSkillId = '',
  templateId = '',
  guardId = '',
  buildingId = '',
  recipeId = '',
  vehicleSlot = 0,
  disposal: (() => void) | undefined;
export function closeCreatorPreview() {
  disposal?.();
  disposal = undefined;
}
const friendly = (key: string) =>
  key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
export function settingsFields(settings: Settings = defaults) {
  return Object.entries(settings)
    .map(([key, value]) =>
      typeof value === 'boolean'
        ? `<label class="check"><input name="${key}" type="checkbox" ${value ? 'checked' : ''}>${friendly(key)}</label>`
        : key === 'weaponMode'
          ? select(
              'Weapon supply',
              key,
              [
                ['energy', 'Regenerating energy'],
                ['ammo', 'Ammo per life'],
              ],
              String(value),
            )
          : field(friendly(key), key, value, 'number', 'step="any"'),
    )
    .join('');
}
export function creationFields() {
  return `<p>Choose a starting layout, then expand the options to customize all world rules before creation. You can change them later in the owner editor.</p>${select(
    'Starting world',
    'template',
    [
      ['economy', 'Living economy village'],
      ...Object.entries(rulesets).map(([id, p]) => [id, p.name] as [string, string]),
      ['combat', 'Team deathmatch arena'],
      ['ctf', 'Capture the flag arena'],
      ['capture', 'Capture point arena'],
      ['playground', 'Vehicle playground'],
      ['blank', 'Blank creator canvas'],
    ],
  )}<p>${Object.values(rulesets)
    .map((p) => `<b>${esc(p.name)}</b>: ${esc(p.description)}`)
    .join(
      '<br>',
    )}</p><details><summary>Customize economy, survival, time and combat</summary><p>These values override the preset. Currency uses hundredths of a denarius; hunger/thirst rates are units per real second. Preset arenas otherwise disable hunger and thirst.</p><label class="check"><input name="customSettings" type="checkbox">Use these custom rules</label><div class="settings-grid">${settingsFields()}</div></details>`;
}
export function settingsData(form: HTMLFormElement, base: Settings = defaults) {
  const data = new FormData(form);
  return Object.fromEntries(
    Object.entries(base).map(([key, value]) => [
      key,
      typeof value === 'boolean'
        ? data.has(key)
        : typeof value === 'number'
          ? Number(data.get(key))
          : String(data.get(key)),
    ]),
  );
}
function starters(kind: string): Blueprint {
  const parts =
    kind === 'tree'
      ? [
          { shape: 'cylinder', color: '#69523a', y: 2, sx: 0.7, sy: 4, sz: 0.7 },
          { shape: 'cone', color: '#355d3b', y: 5, sx: 5, sy: 7, sz: 5 },
        ]
      : kind === 'rover'
        ? [
            { shape: 'box', color: '#9b633e', y: 1.5, sx: 3, sy: 1.2, sz: 5 },
            ...[-1, 1].flatMap((x) =>
              [-1.6, 1.6].map((z) => ({
                shape: 'sphere',
                color: '#292f2e',
                x: x * 1.5,
                y: 0.7,
                z,
                sx: 1.2,
                sy: 1.4,
                sz: 1.4,
              })),
            ),
          ]
        : [
            { shape: 'box', color: '#a7916b', y: 2, sx: 6, sy: 4, sz: 5 },
            { shape: 'cone', color: '#4e5654', y: 5, sx: 8, sy: 3, sz: 7 },
          ];
  return blueprintSchema.parse({
    id: crypto.randomUUID(),
    name: kind === 'tree' ? 'My tree' : kind === 'rover' ? 'My rover' : 'My building',
    width: kind === 'tree' ? 5 : 6,
    height: kind === 'tree' ? 9 : kind === 'rover' ? 3 : 7,
    depth: kind === 'rover' ? 5 : 6,
    parts,
  });
}
function readDraft(host: ParentNode = document) {
  const form = host.querySelector<HTMLFormElement>('#creator-model-form');
  if (!form || !draft) return;
  const d = new FormData(form),
    get = (key: string) => String(d.get(key) ?? ''),
    num = (key: string) => Number(d.get(key));
  draft = {
    id: draft.id,
    name: get('name'),
    width: num('width'),
    height: num('height'),
    depth: num('depth'),
    asset: get('asset') || undefined,
    texture: get('texture') || undefined,
    animation: num('animation'),
    animationSpeed: num('animationSpeed'),
    parts: draft.parts.map((p, i) => ({
      ...p,
      shape: get(`shape${i}`) as typeof p.shape,
      color: get(`color${i}`),
      ...Object.fromEntries(['x', 'y', 'z', 'sx', 'sy', 'sz', 'yaw'].map((k) => [k, num(k + i)])),
    })),
  };
}
export function refreshCreatorPreview(w: World) {
  const host = document.getElementById('creator-preview');
  if (!host || !draft) return;
  readDraft();
  const parsed = blueprintSchema.safeParse(draft);
  if (!parsed.success) return;
  closeCreatorPreview();
  try {
    disposal = previewCreator(host, parsed.data, w);
  } catch {
    host.textContent = '3D preview unavailable; save and inspect the model in the world.';
  }
}
export function creatorPanel(w: World, p: Player, tab: string) {
  const items = worldItems(w),
    skills = worldSkills(w);
  if (contextWorld !== w.id) {
    draft = undefined;
    audioId = '';
    bookId = '';
    eventId = '';
    objectId = '';
    ruleId = '';
    questId = '';
    catalogueItemId = '';
    catalogueSkillId = '';
    templateId = '';
    guardId = '';
    buildingId = '';
    recipeId = '';
    vehicleSlot = 0;
    contextWorld = w.id;
  }
  const c = w.creator ?? defaultCreator();
  const building = w.buildings.find((b) => b.id === buildingId) ?? w.buildings[0];
  const modelOptions: [string, string][] = c.models.map((m) => [m.id, m.name]);
  if (tab === 'Start here')
    return `<div class="guide-grid"><section><h3>Build a world in six steps</h3><ol><li><b>Rules</b>: set survival, economy, sea level and day length.</li><li><b>Arena</b>: choose CTF, capture point or deathmatch; move bases and set victory rules.</li><li><b>Workshop</b>: assemble reusable models or bind uploaded visuals.</li><li><b>Objects</b>: place trees, scenery, triggers, props or obstacles.</li><li><b>Behaviors</b>: add interact, zone-entry and timer actions without code.</li><li><b>Script</b>: add Lua for advanced conditions using the same effects.</li></ol></section><section><h3>Creator tools</h3><p>Changes are live for everyone in this world. Prototype in a separate world first. Saved designs survive server restarts.</p><p>Upload your own PNG/JPEG, OBJ or animated GLB in <b>Assets</b>, then select it in Workshop. Bind MP3 uploads or original woodland/shore/storm ambience in Audio zones.</p><p>Use <b>Layout</b> to rename, move and reskin existing functional buildings. <b>Vehicles</b> tunes physics; <b>Workshop</b> assigns custom appearances to vehicle slots.</p><p>Export a world design in Transfer and create a new world from it. Exports contain design data, not player accounts or money.</p></section></div>`;
  if (tab === 'Books') return booksEditor(w, bookId);
  if (tab === 'Town events') return eventsEditor(w, eventId);
  if (tab === 'Audio zones') {
    const zones = c.ambience ?? [],
      a = zones.find((a) => a.id === audioId);
    return `<p>Up to four nearby zones play at once. Use original synthesized ambience or an uploaded mono/stereo MP3 (maximum 30 seconds). Start/end hours follow the world clock; equal hours mean all day. A non-looping sound plays once per entry. Upload properly licensed audio in Assets.</p><div class="button-row">${button('New audio zone', 'audio', '')}${zones.map((a) => button(a.name, 'audio', a.id)).join('')}</div><form id="creator-audio-form">${field('Zone name', 'name', a?.name ?? 'Woodland')}${select(
      'Sound',
      'source',
      ['woodland', 'shore', 'storm', 'asset'].map((s) => [s, s]),
      a?.source ?? 'woodland',
    )}${select('MP3 asset', 'asset', [['', 'None'], ...w.assets.filter((a) => a.type === 'audio/mpeg').map((a) => [a.id, a.name] as [string, string])], a?.asset)}${select('Attach to object', 'object', [['', 'Fixed coordinates'], ...c.objects.map((o) => [o.id, o.name] as [string, string])], a?.object)}${coord('x', a?.x)}${coord('z', a?.z)}${field('Radius metres', 'radius', a?.radius ?? 40, 'number', 'min="2" max="250"')}${field('Volume', 'volume', a?.volume ?? 0.35, 'number', 'min="0" max="1" step=".05"')}<label><input type="checkbox" name="loop" ${a?.loop !== false ? 'checked' : ''}>Loop sound</label>${field('Start hour', 'startHour', a?.startHour ?? 0, 'number', 'min="0" max="24"')}${field('End hour', 'endHour', a?.endHour ?? 24, 'number', 'min="0" max="24"')}${select(
      'Weather condition',
      'weather',
      ['any', 'clear', 'rain', 'snow', 'storm'].map((s) => [s, s]),
      a?.weather ?? 'any',
    )}<button>Save audio zone</button></form>${a ? button('Delete audio zone', 'deleteAudio', a.id) : ''}`;
  }
  if (tab === 'Arena')
    return `<p>Match rules apply to the existing Activities combat games. Fixed modes prevent players switching to another mode. Saving changed arena rules ends any current match. Coordinates are metres.</p><form id="creator-arena-form"><div class="settings-grid">${select(
      'Game mode',
      'mode',
      [
        ['open', 'Players choose'],
        ['ctf', 'Capture the flag'],
        ['capture', 'Hold the capture point'],
        ['deathmatch', 'Team deathmatch'],
      ],
      c.arena.mode,
    )}${field('Round length (seconds)', 'roundSeconds', c.arena.roundSeconds, 'number', 'min="30" max="3600"')}${field('Winning score / capture seconds', 'scoreLimit', c.arena.scoreLimit, 'number', 'min="1" max="1000"')}${field('Dropped flag return (seconds)', 'flagReturnSeconds', c.arena.flagReturnSeconds, 'number', 'min="5" max="300"')}${field('Spawn protection (seconds)', 'protectionSeconds', c.arena.protectionSeconds, 'number', 'min="0" max="30"')}${c.arena.bases.map((b, i) => `${field(`Team ${i + 1} name`, 'team' + i, c.arena.teams[i])}${coord('baseX' + i, b.x)}${coord('baseZ' + i, b.z)}`).join('')}${coord('captureX', c.arena.capture.x)}${coord('captureZ', c.arena.capture.z)}${field('Capture radius', 'captureRadius', c.arena.capture.radius, 'number', 'min="3" max="50"')}</div><fieldset><legend>Allowed weapons</legend>${['machine', 'grenade', 'plasma', 'rocket', 'javelin', 'mine'].map((key) => `<label class="check"><input type="checkbox" name="weapon" value="${key}" ${c.arena.weapons.includes(key as any) ? 'checked' : ''}>${friendly(key)}</label>`).join('')}</fieldset><button>Save arena rules</button></form>`;
  if (tab === 'Terrain textures')
    return `<p>Use uploaded or painted PNG/JPEG tiles for the four terrain brushes. Grass repeats every five metres; other surfaces every six metres. Snow still covers these surfaces.</p><form id="creator-terrain-textures-form">${['grass', 'gravel', 'soil', 'sand'].map((id) => select(id, id, [['', 'Original texture'], ...w.assets.filter((a) => a.type.startsWith('image/')).map((a) => [a.id, a.name] as [string, string])], c.terrainTextures?.[id as 'grass'])).join('')}<button>Save terrain textures</button></form>`;
  if (tab === 'Resource visuals')
    return `<p>Replace gathering-ground visuals while keeping their resource identities, amounts and interaction locations. Use a tree/grove model for wood, or sculpt a quarry outcrop. Models also bind to buildings, vehicles and landscape scatter in their respective tabs.</p><form id="creator-resource-form">${['logs', 'stone', 'gravel', 'dirt'].map((id) => select(id, id, [['', 'Original appearance'], ...c.models.map((m) => [m.id, m.name] as [string, string])], c.resourceModels?.[id as 'logs'])).join('')}<button>Save resource appearances</button></form>`;
  if (tab === 'Workshop') {
    draft ??= c.models[0] ? structuredClone(c.models[0]) : starters('tree');
    return `<p>Reusable visual models: assemble shapes, adjust metre dimensions and colors, then drag the preview to rotate. Upload images/OBJ/GLB in Assets first. OBJ uses an optional PNG/JPEG UV atlas; export normals and triangulate in your modelling app. Collision bounds are explicit; match them to the design.</p><div class="button-row">${button('New tree', 'starter', 'tree')}${button('New building', 'starter', 'building')}${button('New rover', 'starter', 'rover')}${c.models.map((m) => button('Edit ' + m.name, 'model', m.id)).join('')}</div><form id="creator-model-form"><div class="settings-grid">${field('Model name', 'name', draft.name)}${select('Uploaded visual (optional)', 'asset', [['', 'Shapes only'], ...w.assets.filter((a) => a.type.startsWith('image/') || ['model/gltf-binary', 'model/obj'].includes(a.type)).map((a) => [a.id, a.name] as [string, string])], draft.asset)}${select('Primitive/OBJ texture (PNG/JPEG, optional)', 'texture', [['', 'No texture'], ...w.assets.filter((a) => a.type.startsWith('image/')).map((a) => [a.id, a.name] as [string, string])], draft.texture)}${field('Animation clip (-1 for static, 0 for first)', 'animation', draft.animation, 'number', 'min="-1" max="7"')}${field('Animation speed', 'animationSpeed', draft.animationSpeed, 'number', 'min="0.1" max="3" step="0.1"')}${field('Collision / imported width', 'width', draft.width, 'number', 'min="0.2" max="60" step="0.1"')}${field('Height', 'height', draft.height, 'number', 'min="0.2" max="60" step="0.1"')}${field('Depth', 'depth', draft.depth, 'number', 'min="0.2" max="60" step="0.1"')}</div><div id="creator-preview" aria-label="Model preview"></div><div class="creator-parts">${draft.parts
      .map(
        (part, i) =>
          `<details class="creator-part"><summary>Part ${i + 1} · ${friendly(part.shape)}</summary><div class="settings-grid">${select(
            'Shape',
            'shape' + i,
            ['box', 'sphere', 'cone', 'cylinder'].map((v) => [v, friendly(v)]),
            part.shape,
          )}${field('Color', 'color' + i, part.color, 'color')}${['x', 'y', 'z', 'sx', 'sy', 'sz', 'yaw'].map((k) => field(({ sx: 'Width', sy: 'Height', sz: 'Depth', yaw: 'Rotation (degrees)' } as Record<string, string>)[k] ?? k.toUpperCase(), k + i, part[k as keyof typeof part], 'number', 'step="0.1"')).join('')}</div>${button('Remove part', 'removePart', String(i))}</details>`,
      )
      .join(
        '',
      )}</div>${button('Add shape', 'addPart')}${c.models.some((m) => m.id === draft?.id) ? button('Delete model', 'deleteModel', draft.id) : ''}<button class="primary">Save model</button></form><h3>Use as a vehicle</h3><form id="creator-vehicle-form">${select(
      'Vehicle slot',
      'slot',
      vehicles.map((v, i) => [String(i), v.name]),
    )}${select('Appearance', 'model', [['', 'Original appearance'], ...modelOptions])}<button>Assign vehicle appearance</button></form>`;
  }
  if (tab === 'Objects') {
    const o = c.objects.find((o) => o.id === objectId);
    return `<p>Place reusable models as trees, obstacles, signs or interactive objects. Buildings that trade/produce goods belong in Buildings/Layout. Solid objects use the collision radius and model height.</p><div class="button-row">${button('New object', 'object', '')}${c.objects.map((o) => button(o.name, 'object', o.id)).join('')}</div><form id="creator-object-form">${field('Name', 'name', o?.name ?? 'My object')}${select('Model', 'model', modelOptions, o?.model)}<div class="settings-grid">${coord('x', o?.x ?? Math.round(p.x + 8))}${coord('z', o?.z ?? Math.round(p.z))}${field('Height above terrain', 'y', o?.y ?? 0, 'number', 'step="0.1"')}${field('Rotation degrees', 'yaw', o?.yaw ?? 0, 'number')}${field('Scale', 'scale', o?.scale ?? 1, 'number', 'min="0.1" max="4" step="0.1"')}${field('Collision / trigger radius', 'radius', o?.radius ?? 2, 'number', 'min="0.2" max="30" step="0.1"')}</div>${field('Interaction button text', 'prompt', o?.prompt ?? 'Interact')}<label class="check"><input type="checkbox" name="solid" ${o?.solid ? 'checked' : ''}>Solid obstacle</label><label class="check"><input type="checkbox" name="visible" ${o?.visible !== false ? 'checked' : ''}>Visible</label><button>${o ? 'Update' : 'Place'} object</button>${o ? button('Duplicate nearby', 'duplicateObject', o.id) + button('Delete object', 'deleteObject', o.id) : ''}</form>`;
  }
  if (tab === 'Quests') return questEditor(w, questId);
  if (tab === 'Access rules') return guardsEditor(w, guardId);
  if (tab === 'Behaviors') {
    const r = c.rules.find((r) => r.id === ruleId),
      e = r?.effects[0];
    return `<p>Rules run on the server. Combine rules for richer behavior; Lua adds conditions and multiple effects. Enter fires on crossing into a region; timers apply to online players. Cooldowns are per player. Changes are saved live.</p><div class="button-row">${button('New rule', 'rule', '')}${c.rules.map((r) => button(r.name, 'rule', r.id)).join('')}</div><form id="creator-rule-form">${field('Rule name', 'name', r?.name ?? 'Welcome checkpoint')}${select(
      'When',
      'event',
      ['interact', 'enter', 'timer', 'login', 'task'].map((v) => [
        v,
        (
          {
            interact: 'Player interacts',
            enter: 'Player enters region',
            timer: 'Repeat timer',
            login: 'Player arrives',
            task: 'Player finishes a task',
          } as any
        )[v],
      ]),
      r?.event ?? 'interact',
    )}${select('Target object, zone or building', 'target', [['', 'All (login/task/timer)'], ...[...c.objects, ...w.zones.map((z) => ({ ...z, name: z.kind + ' ' + z.id })), ...w.buildings].map((v) => [v.id, v.name] as [string, string])], r?.target)}${field('Cooldown / timer seconds', 'cooldown', r?.cooldown ?? 30, 'number', 'min="1" max="86400"')}${select(
      'Team condition',
      'team',
      [
        ['-1', 'Any player'],
        ['0', c.arena.teams[0]],
        ['1', c.arena.teams[1]],
      ],
      String(r?.team ?? -1),
    )}${select('Require carried item', 'requiredItem', [['', 'No item required'], ...Object.entries(items).map(([id, d]) => [id, d.name] as [string, string])], r?.requiredItem)}${select(
      'Effect',
      'effect',
      ['message', 'heal', 'needs', 'item', 'teleport', 'score', 'visibility'].map((v) => [
        v,
        (
          {
            message: 'Show a message',
            heal: 'Adjust health',
            needs: 'Adjust hunger and thirst',
            item: 'Give / remove item',
            teleport: 'Teleport',
            score: 'Adjust team score',
            visibility: 'Show / hide an object',
          } as any
        )[v],
      ]),
      e?.type ?? 'message',
    )}${field('Message', 'text', e?.type === 'message' ? e.text : 'Welcome!')}${field('Amount (negative removes / reduces)', 'amount', e && 'amount' in e ? e.amount : 1000, 'number')}${select(
      'Item',
      'item',
      Object.entries(items).map(([id, d]) => [id, d.name]),
      e?.type === 'item' ? e.item : 'water',
    )}${field('Item quantity', 'quantity', e?.type === 'item' ? e.quantity : 1, 'number', 'min="-100" max="100"')}${coord('x', e?.type === 'teleport' ? e.x : Math.round(p.x))}${coord('z', e?.type === 'teleport' ? e.z : Math.round(p.z))}${select(
      'Score team',
      'scoreTeam',
      [
        ['-1', 'Triggering player’s team'],
        ['0', c.arena.teams[0]],
        ['1', c.arena.teams[1]],
      ],
      String(e?.type === 'score' ? e.team : -1),
    )}${select(
      'Visibility object',
      'object',
      c.objects.map((o) => [o.id, o.name]),
      e?.type === 'visibility' ? e.object : '',
    )}<label class="check"><input name="visible" type="checkbox" ${e?.type !== 'visibility' || e.visible ? 'checked' : ''}>Show object</label><label class="check"><input name="enabled" type="checkbox" ${r?.enabled !== false ? 'checked' : ''}>Rule enabled</label>${r && r.effects.length > 1 ? '<p>Additional effects from an imported design are preserved when editing the first effect.</p>' : ''}<button>Save behavior</button>${r ? button('Delete rule', 'deleteRule', r.id) : ''}</form>`;
  }
  if (tab === 'Layout')
    return `<p>Move and rename buildings remotely. Custom visual dimensions also define their physical footprint. Existing business settings and ownership are preserved.</p><form id="creator-building-form">${select(
      'Building',
      'building',
      w.buildings.map((b) => [b.id, b.name]),
      building?.id,
    )}${field('Name', 'name', building?.name ?? '')}${coord('x', building?.x ?? 0)}${coord('z', building?.z ?? 0)}${field('Rotation degrees', 'rotation', ((building?.rotation ?? 0) * 180) / Math.PI, 'number', 'step="any"')}${select('Visual model', 'model', [['', 'Original building'], ...modelOptions], building?.creatorModel)}<button>Update building</button></form><h3>Scenery</h3><form id="creator-scenery-form"><label class="check"><input type="checkbox" name="scenery" ${c.scenery ? 'checked' : ''}>Generated countryside trees and plants</label><label class="check"><input type="checkbox" name="roads" ${c.roads ? 'checked' : ''}>Generated roads and streetlights</label>${select(
      'Weather',
      'weather',
      ['natural', 'clear', 'rain', 'snow', 'thunderstorm', 'snowstorm'].map((v) => [
        v,
        friendly(v),
      ]),
      c.weather,
    )}<button>Save scenery</button></form><h3>Remove individual landscape edits</h3><p>Removing a zone also removes behavior rules targeting that zone.</p>${w.zones.map((z) => `<p>${esc(z.kind)} · ${z.x}, ${z.z} ${button('Remove', 'deleteZone', z.id)}</p>`).join('')}${w.terrain.map((t, i) => `<p>Brush ${i + 1}: ${t.x}, ${t.z}, height ${t.height} ${button('Undo brush', 'deleteTerrain', String(i))}</p>`).join('')}`;
  if (tab === 'Building templates') return templatesEditor(w, templateId);
  if (tab === 'Catalogue') return catalogueEditor(w, catalogueItemId, catalogueSkillId);
  if (tab === 'Production') {
    const b =
      w.buildings.find((b) => b.id === recipeId && b.kind !== 'farm') ??
      w.buildings.find((b) => b.kind !== 'farm' && (b.production || recipes[b.recipe ?? '']));
    const recipe = b?.production ?? recipes[b?.recipe ?? ''];
    const rows = (side: 'inputs' | 'outputs') =>
      Array.from({ length: 8 }, (_, i) => {
        const entry = Object.entries(recipe?.[side] ?? {})[i];
        return `<div class="settings-grid">${select(`${side === 'inputs' ? 'Consume' : 'Produce'} ${i + 1}`, side + i, [['', 'Unused'], ...Object.entries(items).map(([id, d]) => [id, d.name] as [string, string])], entry?.[0])}${field('Quantity', side + 'Qty' + i, entry?.[1] ?? 1, 'number', 'min="1" max="1000"')}</div>`;
      }).join('');
    return `<p>Design a production chain without writing JSON. Each completed batch consumes the inputs and creates the outputs from this building’s stockroom. Workers need the selected profession. Changing a recipe restarts its production cycle.</p><form id="creator-recipe-form">${select(
      'Building',
      'recipeBuilding',
      w.buildings.filter((b) => b.kind !== 'farm').map((b) => [b.id, b.name]),
      b?.id,
    )}${field('Cycle seconds', 'seconds', recipe?.seconds ?? 600, 'number', 'min="10" max="86400"')}${select(
      'Profession',
      'skill',
      skills.map((s) => [s, s]),
      recipe?.skill,
    )}<details open><summary>Inputs</summary>${rows('inputs')}</details><details open><summary>Outputs</summary>${rows('outputs')}</details><button>Save production recipe</button></form>${b ? diagnosticsHtml(w, b) : ''}`;
  }
  if (tab === 'Vehicles') {
    const v = { ...vehicles[vehicleSlot], ...w.vehicleTuning?.[vehicleSlot] };
    return `<p>Changes apply to everyone using this slot in this world. Appearance is configured separately in Workshop.</p><form data-action="vehicleTuning">${select(
      'Vehicle slot',
      'slot',
      vehicles.map((v, i) => [String(i), v.name]),
      String(vehicleSlot),
    )}${field('Speed (m/s)', 'speed', v.speed, 'number', 'min="1" max="100" step="any"')}${field('Acceleration', 'acceleration', v.acceleration, 'number', 'min="1" max="50" step="any"')}${field('Turn rate', 'turn', v.turn, 'number', 'min="0.1" max="6" step="any"')}${field('Armour percent', 'armour', v.armour, 'number', 'min="10" max="1000" step="any"')}${field('Fuel per second', 'fuel', v.fuel, 'number', 'min="0" max="1" step="any"')}<button>Save vehicle physics</button></form>`;
  }
  if (tab === 'Transfer')
    return `<p>Export a reusable world design without players, accounts, cash or inventories. Imported designs create a new world; they never overwrite an occupied world. A media bundle carries up to 8 MiB of images, models and audio, retaining source/author/licence metadata. Only redistribute media you have permission to share; design-only exports use placeholder visuals.</p>${button('Download world design', 'export')}${button('Download design + media bundle', 'exportBundle')}<form id="creator-import-form">${field('New world name', 'name', 'Imported world')}<label>World design JSON<input type="file" name="file" accept="application/json,.json" required></label><button>Create world from design</button></form>`;
  return '';
}
export function creatorClick(action: string, value: string, w: World, send: (a: Action) => void) {
  const c = structuredClone({ ...defaultCreator(), ...w.creator });
  readDraft();
  if (action === 'starter') draft = starters(value);
  if (action === 'model') draft = structuredClone(c.models.find((m) => m.id === value));
  if (action === 'addPart' && draft && draft.parts.length < 32)
    draft.parts.push(partSchema.parse({ shape: 'box' }));
  if (action === 'removePart' && draft) draft.parts.splice(Number(value), 1);
  if (action === 'object') objectId = value;
  if (action === 'template') templateId = value;
  if (action === 'deleteTemplate') {
    const catalogue = structuredClone(w.catalogue ?? catalogueSchema.parse({}));
    delete catalogue.templates[value];
    send({ type: 'catalogue', catalogue });
  }
  if (action === 'catalogueItem') catalogueItemId = value;
  if (action === 'catalogueSkill') catalogueSkillId = value;
  if (action === 'deleteCatalogueItem' || action === 'deleteCatalogueSkill') {
    const catalogue = structuredClone(w.catalogue ?? catalogueSchema.parse({}));
    delete (action === 'deleteCatalogueItem' ? catalogue.items : catalogue.skills)[value];
    send({ type: 'catalogue', catalogue });
  }
  if (action === 'quest') questId = value;
  if (action === 'book') bookId = value;
  if (action === 'townEvent') eventId = value;
  if (action === 'deleteBook') {
    c.books = c.books.filter((b) => b.id !== value);
    bookId = '';
    send({ type: 'creator', creator: c });
  }
  if (action === 'deleteTownEvent') {
    c.townEvents = c.townEvents.filter((e) => e.id !== value);
    eventId = '';
    send({ type: 'creator', creator: c });
  }
  if (action === 'audio') audioId = value;
  if (action === 'deleteAudio') {
    c.ambience = c.ambience.filter((a) => a.id !== value);
    audioId = '';
    send({ type: 'creator', creator: c });
  }
  if (action === 'guard') guardId = value;
  if (action === 'deleteQuest') {
    c.quests = c.quests.filter((q) => q.id !== value);
    for (const e of c.townEvents) if (e.quest === value) e.quest = '';
    send({ type: 'creator', creator: c });
    questId = '';
  }
  if (action === 'deleteGuard') {
    c.guards = c.guards.filter((g) => g.id !== value);
    send({ type: 'creator', creator: c });
    guardId = '';
  }
  if (action === 'rule') ruleId = value;
  if (action === 'duplicateObject') {
    const o = c.objects.find((o) => o.id === value);
    if (o) {
      const copy = {
        ...o,
        id: crypto.randomUUID(),
        name: o.name + ' copy',
        x: Math.min(240, o.x + 8),
      };
      c.objects.push(copy);
      objectId = copy.id;
      send({ type: 'creator', creator: c });
    }
  }
  if (action === 'deleteObject') {
    c.objects = c.objects.filter((o) => o.id !== value);
    c.ambience = c.ambience.filter((a) => a.object !== value);
    c.rules = c.rules.filter(
      (r) =>
        r.target !== value && !r.effects.some((e) => e.type === 'visibility' && e.object === value),
    );
    objectId = '';
    send({ type: 'creator', creator: c });
  }
  if (action === 'deleteModel') {
    if (
      c.objects.some((o) => o.model === value) ||
      Object.values(c.vehicleModels).includes(value) ||
      Object.values(c.resourceModels).includes(value) ||
      w.buildings.some((b) => b.creatorModel === value)
    )
      throw Error('Remove model assignments from objects, buildings, resources and vehicles first');
    c.models = c.models.filter((m) => m.id !== value);
    draft = undefined;
    send({ type: 'creator', creator: c });
  }
  if (action === 'deleteRule') {
    c.rules = c.rules.filter((r) => r.id !== value);
    ruleId = '';
    send({ type: 'creator', creator: c });
  }
  if (action === 'deleteZone' || action === 'deleteTerrain')
    send({ type: 'creatorRemove', kind: action === 'deleteZone' ? 'zone' : 'terrain', id: value });
}
export function creatorSubmit(form: HTMLFormElement, w: World): Action | undefined {
  if (form.id.startsWith('creator-catalogue-')) return catalogueForm(w, form);
  const c = structuredClone({ ...defaultCreator(), ...w.creator }),
    d = new FormData(form),
    str = (k: string) => String(d.get(k) ?? ''),
    num = (k: string) => Number(d.get(k));
  if (form.id === 'creator-book-form') {
    const b = bookSchema.parse({
      id: bookId || crypto.randomUUID(),
      title: str('title'),
      item: str('item'),
      pages: Array.from({ length: 8 }, (_, i) => str('page' + i).trim()).filter(Boolean),
    });
    c.books = [...c.books.filter((old) => old.id !== b.id), b];
    bookId = b.id;
  } else if (form.id === 'creator-event-form') {
    const e = townEventSchema.parse({
      id: eventId || crypto.randomUUID(),
      title: str('title'),
      description: str('description'),
      startsDay: num('startsDay'),
      repeatDays: num('repeatDays'),
      durationDays: num('durationDays'),
      quest: str('quest'),
    });
    c.townEvents = [...c.townEvents.filter((old) => old.id !== e.id), e];
    eventId = e.id;
  } else if (form.id === 'creator-audio-form') {
    const a = ambientSchema.parse({
      id: audioId || crypto.randomUUID(),
      name: str('name'),
      source: str('source'),
      asset: str('asset') || undefined,
      object: str('object'),
      x: num('x'),
      z: num('z'),
      radius: num('radius'),
      volume: num('volume'),
      loop: d.has('loop'),
      startHour: num('startHour'),
      endHour: num('endHour'),
      weather: str('weather'),
    });
    c.ambience = [...c.ambience.filter((old) => old.id !== a.id), a];
    audioId = a.id;
  } else if (form.id === 'creator-quest-form') {
    const q = questForm(form, questId);
    c.quests = [...c.quests.filter((old) => old.id !== q.id), q];
    questId = q.id;
  } else if (form.id === 'creator-guard-form') {
    const g = {
      id: guardId || crypto.randomUUID(),
      action: str('action') as 'trade',
      target: str('target'),
      skill: str('skill'),
      item: str('item'),
      quantity: num('quantity'),
      variable: str('variable'),
      minimum: num('minimum'),
      message: str('message'),
    };
    c.guards = [...c.guards.filter((old) => old.id !== g.id), g];
    guardId = g.id;
  } else if (form.id === 'creator-terrain-textures-form') {
    c.terrainTextures = Object.fromEntries(
      ['grass', 'gravel', 'soil', 'sand'].filter((k) => str(k)).map((k) => [k, str(k)]),
    );
  } else if (form.id === 'creator-resource-form') {
    c.resourceModels = Object.fromEntries(
      ['logs', 'stone', 'gravel', 'dirt'].filter((k) => str(k)).map((k) => [k, str(k)]),
    );
  } else if (form.id === 'creator-model-form') {
    readDraft();
    const model = blueprintSchema.parse(draft);
    c.models = [...c.models.filter((m) => m.id !== model.id), model];
  } else if (form.id === 'creator-object-form') {
    const o = {
      id: objectId || crypto.randomUUID(),
      name: str('name'),
      model: str('model'),
      x: num('x'),
      z: num('z'),
      y: num('y'),
      yaw: num('yaw'),
      scale: num('scale'),
      radius: num('radius'),
      solid: d.has('solid'),
      visible: d.has('visible'),
      prompt: str('prompt'),
    };
    c.objects = [...c.objects.filter((v) => v.id !== o.id), o];
    objectId = o.id;
  } else if (form.id === 'creator-rule-form') {
    const type = str('effect');
    const effect: any =
      type === 'message'
        ? { type, text: str('text') }
        : type === 'item'
          ? { type, item: str('item'), quantity: num('quantity') }
          : type === 'teleport'
            ? { type, x: num('x'), z: num('z') }
            : type === 'visibility'
              ? { type, object: str('object'), visible: d.has('visible') }
              : type === 'score'
                ? { type, team: num('scoreTeam'), amount: num('amount') }
                : { type, amount: num('amount') };
    const prior = c.rules.find((r) => r.id === ruleId);
    const r = {
      id: ruleId || crypto.randomUUID(),
      name: str('name'),
      event: str('event') as any,
      target: str('target'),
      cooldown: num('cooldown'),
      team: num('team'),
      requiredItem: str('requiredItem'),
      enabled: d.has('enabled'),
      effects: [effect, ...(prior?.effects.slice(1) ?? [])],
    };
    c.rules = [...c.rules.filter((v) => v.id !== r.id), r];
    ruleId = r.id;
  } else if (form.id === 'creator-arena-form')
    c.arena = {
      mode: str('mode') as any,
      roundSeconds: num('roundSeconds'),
      scoreLimit: num('scoreLimit'),
      flagReturnSeconds: num('flagReturnSeconds'),
      protectionSeconds: num('protectionSeconds'),
      bases: [
        { x: num('baseX0'), z: num('baseZ0') },
        { x: num('baseX1'), z: num('baseZ1') },
      ],
      capture: { x: num('captureX'), z: num('captureZ'), radius: num('captureRadius') },
      teams: [str('team0'), str('team1')],
      weapons: d.getAll('weapon') as any,
    };
  else if (form.id === 'creator-recipe-form') {
    const stock = (side: string) => {
      const result: Record<string, number> = {};
      for (let i = 0; i < 8; i++)
        if (str(side + i))
          result[str(side + i)] = (result[str(side + i)] ?? 0) + num(side + 'Qty' + i);
      return result;
    };
    return {
      type: 'creatorRecipe',
      building: str('recipeBuilding'),
      recipe: {
        inputs: stock('inputs'),
        outputs: stock('outputs'),
        seconds: num('seconds'),
        skill: str('skill'),
      },
    };
  } else if (form.id === 'creator-building-form')
    return {
      type: 'creatorBuilding',
      building: str('building'),
      patch: {
        ...(str('name') ? { name: str('name') } : {}),
        x: num('x'),
        z: num('z'),
        rotation: num('rotation'),
        model: str('model'),
      },
    };
  else if (form.id === 'creator-vehicle-form') {
    if (str('model')) c.vehicleModels[str('slot')] = str('model');
    else delete c.vehicleModels[str('slot')];
  } else if (form.id === 'creator-scenery-form') {
    c.scenery = d.has('scenery');
    c.roads = d.has('roads');
    c.weather = str('weather') as typeof c.weather;
  } else return;
  return { type: 'creator', creator: c };
}

export function creatorMemoryKey() {
  return [
    draft?.id,
    objectId,
    ruleId,
    buildingId,
    recipeId,
    vehicleSlot,
    audioId,
    bookId,
    eventId,
    questId,
    guardId,
    catalogueItemId,
    catalogueSkillId,
    templateId,
  ].join(':');
}

/** Keep conditional controls useful and load saved layout values when selecting a building. */
export function creatorControls(w: World, changed?: HTMLElement) {
  const layout = document.querySelector<HTMLFormElement>('#creator-building-form');
  if (layout && changed?.getAttribute('name') === 'building') {
    buildingId = (changed as HTMLSelectElement).value;
    const b = w.buildings.find((b) => b.id === buildingId);
    if (b)
      for (const [key, value] of Object.entries({
        name: b.name,
        x: b.x,
        z: b.z,
        rotation: (b.rotation * 180) / Math.PI,
        model: b.creatorModel ?? '',
      }))
        (layout.elements.namedItem(key) as HTMLInputElement).value = String(value);
  }
  const recipeForm = document.querySelector<HTMLFormElement>('#creator-recipe-form');
  if (recipeForm && changed?.getAttribute('name') === 'recipeBuilding') {
    recipeId = (changed as HTMLSelectElement).value;
    const b = w.buildings.find((b) => b.id === recipeId);
    const recipe = b?.production ?? recipes[b?.recipe ?? ''];
    for (const side of ['inputs', 'outputs'] as const) {
      const entries = Object.entries(recipe?.[side] ?? {});
      for (let i = 0; i < 8; i++) {
        (recipeForm.elements.namedItem(side + i) as HTMLSelectElement).value =
          entries[i]?.[0] ?? '';
        (recipeForm.elements.namedItem(side + 'Qty' + i) as HTMLInputElement).value = String(
          entries[i]?.[1] ?? 1,
        );
      }
    }
    (recipeForm.elements.namedItem('seconds') as HTMLInputElement).value = String(
      recipe?.seconds ?? 600,
    );
    (recipeForm.elements.namedItem('skill') as HTMLSelectElement).value =
      recipe?.skill ?? skills[0];
  }
  const tuning = document.querySelector<HTMLFormElement>('form[data-action="vehicleTuning"]');
  if (tuning && changed?.getAttribute('name') === 'slot') {
    vehicleSlot = Number((changed as HTMLSelectElement).value);
    const v = { ...vehicles[vehicleSlot], ...w.vehicleTuning?.[vehicleSlot] };
    for (const key of ['speed', 'acceleration', 'turn', 'armour', 'fuel'] as const)
      (tuning.elements.namedItem(key) as HTMLInputElement).value = String(v[key]);
  }
  if (
    changed &&
    ['building', 'recipeBuilding', 'slot'].includes(changed.getAttribute('name') ?? '')
  ) {
    const host = document.getElementById('modal-host')!;
    if (host.dataset.viewKey) {
      const scope = JSON.parse(host.dataset.viewKey);
      scope[scope.length - 1] = creatorMemoryKey();
      host.dataset.viewKey = JSON.stringify(scope);
    }
  }
  const rules = document.querySelector<HTMLFormElement>('#creator-rule-form');
  if (rules) {
    const effect = (rules.elements.namedItem('effect') as HTMLSelectElement).value;
    for (const [type, keys] of Object.entries({
      message: ['text'],
      heal: ['amount'],
      needs: ['amount'],
      item: ['item', 'quantity'],
      teleport: ['x', 'z'],
      score: ['scoreTeam', 'amount'],
      visibility: ['object', 'visible'],
    }))
      for (const key of keys) {
        const el = rules.elements.namedItem(key) as HTMLElement;
        const visible =
          key === 'amount' ? ['heal', 'needs', 'score'].includes(effect) : type === effect;
        el.closest('label')!.hidden = !visible;
      }
  }
}
