// SPDX-License-Identifier: GPL-3.0-or-later
import {
  vehicleDef,
  isTrawler,
  hasProvisions,
  crewBerths,
  vehicleTuningSchema,
} from '../shared/vehicle-config';
import { vehicles } from '../shared/catalog';
import type { World } from '../shared/types';
const esc = (s: unknown) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const label = (s: string) => s.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
const select = (name: string, values: [string, string][], value: unknown) =>
  `<label>${label(name)}<select name="${name}">${values.map(([id, text]) => `<option value="${esc(id)}" ${String(value) === id ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select></label>`;
const input = (name: string, value: unknown, type = 'number') =>
  `<label>${label(name)}<input name="${name}" type="${type}" value="${esc(value)}" ${type === 'number' ? 'step="any" required' : ''}></label>`;
export function vehicleEditor(w: World, slot: number) {
  const v = vehicleDef(w, slot),
    tuning = w.vehicleTuning?.[slot] ?? {};
  const defaults = {
    tank: 64,
    traction: 0,
    snowTraction: v.traction ?? 0,
    rainTraction: v.traction ?? 0,
    torque: 1,
    headlight: 150,
    lightRange: 110,
    collisionRadius: 1.3,
    length: v.length ?? (v.mode === 3 ? 12 : 3.7),
    beam: v.beam ?? (v.mode === 3 ? 3 : 2.3),
    netCapacity: 640,
    trawlFuel: 8.5 / 60,
    trawlSpeed: 2.4,
    frontTrack: 1.8,
    rearTrack: 2.2,
    frontTyre: 0.35,
    rearTyre: 0.55,
    wheelbase: 2.5,
  };
  const values = { ...defaults, ...v };
  const numberFields = (keys: string) =>
    keys
      .split(' ')
      .map((key) => input(key, values[key as keyof typeof values]))
      .join('');
  const bool = (key: string, value: boolean) =>
    select(
      key,
      [
        ['true', 'Enabled'],
        ['false', 'Disabled'],
      ],
      value,
    );
  const models: [string, string][] = [
    ['', 'None'],
    ...(w.creator?.models ?? []).map((m) => [m.id, m.name] as [string, string]),
  ];
  const images: [string, string][] = [
    ['', 'Default'],
    ...w.assets
      .filter((a) => a.type.startsWith('image/'))
      .map((a) => [a.id, a.name] as [string, string]),
  ];
  const group = (title: string, body: string) =>
    `<details><summary>${title}</summary><div class="settings-grid">${body}</div></details>`;
  return `<p>Configure each vehicle independently for this world. Custom slots 9–24 are available for your own designs. Upload GLB/OBJ models and images in Assets, then assemble named components in Workshop. Lengths use metres; speed uses m/s; fuel uses tank units per real second; price uses hundredths of a denarius (10,000 = 1s).</p><form data-vehicle-editor>${select(
    'slot',
    vehicles.map((_, i) => [String(i), `${i + 1}: ${vehicleDef(w, i).name}`]),
    slot,
  )}${input('name', v.name, 'text')}${select(
    'mode',
    [
      ['0', 'Ground vehicle'],
      ['1', 'Road vehicle'],
      ['2', 'Fixed-wing aircraft'],
      ['3', 'Boat'],
      ['4', 'Ground utility craft'],
      ['5', 'Amphibious hovercraft'],
      ['6', 'Vertical-flight craft'],
      ['8', 'Walking'],
    ],
    v.mode,
  )}${group('Performance, fuel and economy', numberFields('speed acceleration turn armour fuel tank capacity price hitch torque traction snowTraction rainTraction collisionRadius length beam') + input('color', v.color, 'color') + bool('persistentThrottle', v.persistentThrottle ?? [30, 31, 32].includes(slot)))}${group('Fishing, provisions and paid crew', bool('trawling', isTrawler(slot, w)) + bool('provisions', hasProvisions(slot, w)) + input('crew', crewBerths(slot, w)) + numberFields('netCapacity trawlFuel trawlSpeed') + '<p>Boat movement is required for these features. Up to two paid deckhands share expedition profit; other berths use the passenger limit. Capacity includes cargo and provisions.</p>')}${group(
    'Death and recovery',
    select(
      'deathPolicy',
      [
        ['world', 'Use world rules'],
        ['lose', 'Lose owned vessel and cargo'],
        ['recover', 'Leave offshore for recovery'],
      ],
      v.deathPolicy ?? 'world',
    ) +
      input('spoilageDays', v.spoilageDays ?? w.settings.boatCargoSpoilageDays ?? 5) +
      bool('retainFuel', v.retainFuel ?? w.settings.retainBoatFuelOnDeath !== false) +
      '<p>Recovery is for boats. Spoilage is measured in game days; zero means no expiry. Death overrides apply to this vehicle only.</p>',
  )}${group('Tyres and tracks', bool('tracks', v.tracks ?? [0, 24, 25, 26, 27, 28].includes(slot)) + numberFields('frontTrack rearTrack frontTyre rearTyre wheelbase') + select('trackTexture', images, v.trackTexture))}${group('Cockpit and instruments', bool('customCockpit', !!v.cockpit) + ['x', 'y', 'z'].map((k) => input('eye_' + k, v.cockpit?.[k as 'x'] ?? (k === 'y' ? 2 : 0))).join('') + select('dashboard', images, v.dashboard) + ['speed', 'fuel', 'heading', 'altitude', 'pitch', 'condition'].map((key) => `<label><input type="checkbox" name="instrument_${key}" ${(v.instruments ?? ['speed', 'fuel', 'heading']).includes(key as 'speed') ? 'checked' : ''}>${label(key)}</label>`).join('') + '<p>The eye position is relative to the vehicle. Optional dashboard artwork sits below the selected live instrument readouts.</p>')}${group(
    'Lighting',
    numberFields('headlight lightRange') +
      Array.from({ length: 12 }, (_, i) => {
        const l = v.lights?.[i];
        return `<fieldset><legend>Light ${i + 1}</legend>${bool('light_' + i, !!l)}${['x', 'y', 'z'].map((k) => input(`light_${i}_${k}`, l?.[k as 'x'] ?? 0)).join('')}${input(`light_${i}_color`, l?.color ?? '#ffffff', 'color')}${input(`light_${i}_intensity`, l?.intensity ?? 2)}${input(`light_${i}_blink`, l?.blink ?? 0)}${select(
          `light_${i}_switch`,
          ['always', 'headlights', 'cabin', 'deck'].map((k) => [k, k]),
          l?.switch ?? 'headlights',
        )}</fieldset>`;
      }).join('') +
      '<p>Extra lamps use emissive lenses; the shared beam budget provides ground illumination. Blink is cycles per second; zero is steady.</p>',
  )}${group(
    'Component models',
    Array.from({ length: 16 }, (_, i) => {
      const c = tuning.components?.[i];
      return `<fieldset><legend>Component ${i + 1}</legend>${select(`part_${i}_model`, models, c?.model)}${select(
        `part_${i}_role`,
        ['body', 'wheel', 'steer', 'propeller'].map((k) => [k, k]),
        c?.role ?? 'body',
      )}${['x', 'y', 'z', 'scale', 'yaw'].map((k) => input(`part_${i}_${k}`, c?.[k as 'x'] ?? (k === 'scale' ? 1 : 0))).join('')}</fieldset>`;
    }).join('') +
      '<p>Components attach to the Workshop body replacement, or to the built-in model when no replacement is assigned. Wheel and propeller roles animate; steering wheels turn with steering input. Keep meshes lightweight.</p>',
  )}<button>Save vehicle configuration</button></form><form data-action="vehicleReset"><input type="hidden" name="slot" value="${slot}"><button>Restore built-in settings for this slot</button></form>`;
}
export function vehicleForm(form: HTMLFormElement) {
  const d = new FormData(form),
    values: Record<string, unknown> = {};
  for (const key of Object.keys(vehicleTuningSchema.shape)) {
    const value = d.get(key);
    if (value === null || value === '') continue;
    values[key] = ['name', 'color', 'deathPolicy', 'dashboard', 'trackTexture'].includes(key)
      ? String(value)
      : ['trawling', 'provisions', 'tracks', 'persistentThrottle', 'retainFuel'].includes(key)
        ? value === 'true'
        : Number(value);
  }
  values.components = Array.from({ length: 16 }, (_, i) => {
    const model = d.get(`part_${i}_model`);
    return model
      ? {
          model: String(model),
          role: String(d.get(`part_${i}_role`)),
          ...Object.fromEntries(
            ['x', 'y', 'z', 'scale', 'yaw'].map((k) => [k, Number(d.get(`part_${i}_${k}`))]),
          ),
        }
      : undefined;
  }).filter(Boolean);
  values.lights = Array.from({ length: 12 }, (_, i) =>
    d.get('light_' + i) === 'true'
      ? {
          ...Object.fromEntries(
            ['x', 'y', 'z', 'intensity', 'blink'].map((k) => [k, Number(d.get(`light_${i}_${k}`))]),
          ),
          color: String(d.get(`light_${i}_color`)),
          switch: String(d.get(`light_${i}_switch`)),
        }
      : undefined,
  ).filter(Boolean);
  values.instruments = ['speed', 'fuel', 'heading', 'altitude', 'pitch', 'condition'].filter((k) =>
    d.has('instrument_' + k),
  );
  if (d.get('customCockpit') === 'true')
    values.cockpit = Object.fromEntries(['x', 'y', 'z'].map((k) => [k, Number(d.get('eye_' + k))]));
  return {
    type: 'vehicleTuning',
    slot: Number(d.get('slot')),
    replace: true,
    tuning: vehicleTuningSchema.parse(values),
  };
}
