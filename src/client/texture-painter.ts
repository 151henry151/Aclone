// SPDX-License-Identifier: GPL-3.0-or-later
// A small original-texture editor. No network images or tainted canvases.
let draft: HTMLCanvasElement | undefined,
  worldId = '';
export const texturePainterMarkup = () =>
  `<details><summary>Paint an original texture</summary><p>Paint a 256 × 256 tile with mouse or touch, then save it to this world's assets. Assign it to primitive models, OBJ atlases or terrain in the creator tabs.</p><div id="texture-painter"><label>Paint colour<input id="paint-color" type="color" value="#6e7547"></label><label>Brush size<input id="paint-size" type="range" min="1" max="64" value="16"></label><label>Texture name<input id="paint-name" maxlength="60" value="Painted texture"></label><div id="paint-canvas"></div><button type="button" id="paint-fill">Fill tile</button><button type="button" id="paint-save">Save texture</button><p id="paint-status" role="status"></p></div></details>`;
export function mountTexturePainter(id: string, save: (blob: Blob, name: string) => Promise<void>) {
  const host = document.getElementById('paint-canvas');
  if (!host) return;
  if (!draft || worldId !== id) {
    draft = document.createElement('canvas');
    draft.width = draft.height = 256;
    worldId = id;
    const ctx = draft.getContext('2d')!;
    ctx.fillStyle = '#a48e68';
    ctx.fillRect(0, 0, 256, 256);
  }
  const canvas = draft;
  canvas.style.cssText =
    'width:256px;max-width:100%;height:auto;touch-action:none;border:1px solid #aaa';
  canvas.setAttribute('aria-label', 'Texture painting canvas');
  host.append(canvas);
  const ctx = canvas.getContext('2d')!;
  let down = false,
    previous: { x: number; y: number } | undefined;
  const color = () => (document.getElementById('paint-color') as HTMLInputElement).value;
  const draw = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect(),
      p = { x: ((e.clientX - r.left) * 256) / r.width, y: ((e.clientY - r.top) * 256) / r.height };
    ctx.strokeStyle = color();
    ctx.lineWidth = Number((document.getElementById('paint-size') as HTMLInputElement).value);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(previous?.x ?? p.x, previous?.y ?? p.y);
    ctx.lineTo(p.x + 0.01, p.y);
    ctx.stroke();
    previous = p;
  };
  canvas.onpointerdown = (e) => {
    e.preventDefault();
    down = true;
    canvas.setPointerCapture(e.pointerId);
    previous = undefined;
    draw(e);
  };
  canvas.onpointermove = (e) => {
    if (down) draw(e);
  };
  canvas.onpointerup = canvas.onpointercancel = () => {
    down = false;
    previous = undefined;
  };
  document.getElementById('paint-fill')!.onclick = () => {
    ctx.fillStyle = color();
    ctx.fillRect(0, 0, 256, 256);
  };
  const button = document.getElementById('paint-save') as HTMLButtonElement,
    status = document.getElementById('paint-status')!;
  button.onclick = () => {
    button.disabled = true;
    status.textContent = 'Saving…';
    canvas.toBlob((blob) => {
      if (!blob) {
        button.disabled = false;
        return;
      }
      void save(blob, (document.getElementById('paint-name') as HTMLInputElement).value)
        .then(() => {
          status.textContent = 'Saved. Select it in Workshop or Terrain textures.';
        })
        .catch((e) => {
          status.textContent = e.message;
        })
        .finally(() => {
          button.disabled = false;
        });
    }, 'image/png');
  };
}
