// SPDX-License-Identifier: GPL-3.0-or-later
import { BuildPreview } from './build-preview';
import { buildings } from '../shared/catalog';
import { buildingArchitectures } from '../shared/building-architecture';
import { buildingStyles, sizesForBuilding } from '../shared/building-designs';
import { makeBuilding } from '../shared/simulation';
import { waitForTextures, failedTextures } from './materials';

/** Loaded on demand by the static website; no game connection or live world. */
export function mount(dialog: HTMLDialogElement, kind: string) {
  if (!buildings[kind]) throw Error('Unknown building type');
  const host = dialog.querySelector<HTMLElement>('#building-preview')!;
  const model = dialog.querySelector<HTMLSelectElement>('#preview-model')!;
  const finish = dialog.querySelector<HTMLSelectElement>('#preview-finish')!;
  const size = dialog.querySelector<HTMLSelectElement>('#preview-size')!;
  const launch = dialog.querySelector<HTMLInputElement>('#preview-launch')!;
  launch.checked = false;
  dialog.querySelector<HTMLElement>('#preview-launch-label')!.hidden = kind !== 'starport';
  const status = dialog.querySelector<HTMLElement>('#preview-status')!;
  const options = (select: HTMLSelectElement, entries: readonly { id: string; name: string }[]) =>
    select.replaceChildren(...entries.map((entry) => new Option(entry.name, entry.id)));
  options(model, buildingArchitectures(kind));
  options(finish, buildingStyles(kind, model.value));
  options(size, sizesForBuilding(kind));
  size.disabled = size.options.length < 2;
  dialog.querySelector('#preview-finish-label')!.textContent =
    kind === 'pickup' ? 'Paint colour' : 'Surface finish';
  const preview = new BuildPreview(host, true);
  const controller = new AbortController();
  const { signal } = controller;
  let revision = 0;
  const show = () => {
    const b = makeBuilding('gallery', kind, 0, 0);
    b.architecture = model.value;
    b.style = finish.value;
    b.size = sizesForBuilding(kind).find((entry) => entry.id === size.value)!.id;
    b.stock.hay = 450;
    const current = ++revision;
    status.textContent = 'Loading textures…';
    host.dataset.ready = 'false';
    preview.show(b, undefined, kind === 'starport' && !launch.checked);
    void waitForTextures().then(() => {
      if (signal.aborted || current !== revision) return;
      status.textContent = failedTextures.size
        ? 'Some textures could not load. Close and reopen after refreshing to retry.'
        : 'Drag to rotate · scroll or pinch to zoom · arrow keys rotate the focused preview.';
      host.dataset.ready = 'true';
    });
  };
  for (const select of [model, finish, size]) select.addEventListener('change', show, { signal });
  launch.addEventListener(
    'change',
    () => {
      show();
      preview.resetView();
    },
    { signal },
  );
  dialog.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) =>
    button.addEventListener(
      'click',
      () => {
        switch (button.dataset.view) {
          case 'left':
            preview.turn(-Math.PI / 8);
            break;
          case 'right':
            preview.turn(Math.PI / 8);
            break;
          case 'up':
            preview.turn(0, -Math.PI / 12);
            break;
          case 'down':
            preview.turn(0, Math.PI / 12);
            break;
          case 'in':
            preview.zoom(1.2);
            break;
          case 'out':
            preview.zoom(1 / 1.2);
            break;
          case 'reset':
            preview.resetView();
            break;
        }
      },
      { signal },
    ),
  );
  host.addEventListener(
    'keydown',
    (event) => {
      const turns: Record<string, [number, number]> = {
        ArrowLeft: [-Math.PI / 8, 0],
        ArrowRight: [Math.PI / 8, 0],
        ArrowUp: [0, -Math.PI / 12],
        ArrowDown: [0, Math.PI / 12],
      };
      if (turns[event.key]) {
        event.preventDefault();
        preview.turn(...turns[event.key]);
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        preview.zoom(1.2);
      } else if (event.key === '-') {
        event.preventDefault();
        preview.zoom(1 / 1.2);
      } else if (event.key === 'Home') {
        event.preventDefault();
        preview.resetView();
      }
    },
    { signal },
  );
  host.addEventListener('pointerdown', () => host.focus({ preventScroll: true }), { signal });
  host.querySelector('canvas')!.addEventListener(
    'webglcontextlost',
    () => {
      status.textContent =
        '3D preview interrupted. Close and reopen it to retry, or view the image sheet.';
    },
    { signal },
  );
  try {
    show();
  } catch (error) {
    controller.abort();
    preview.dispose();
    throw error;
  }
  return () => {
    controller.abort();
    preview.dispose();
    host.replaceChildren();
  };
}
