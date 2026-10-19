// SPDX-License-Identifier: GPL-3.0-or-later
const search = document.querySelector('#search');
const cards = [...document.querySelectorAll('article')];
const results = document.querySelector('#results');
function filter() {
  const query = search.value.trim().toLocaleLowerCase();
  let count = 0;
  for (const card of cards) {
    card.hidden = !card.dataset.search.includes(query);
    if (!card.hidden) count++;
  }
  results.textContent = count
    ? `${count} of ${cards.length} building types`
    : 'No matching buildings. Try another name.';
}
document.querySelector('.filter').hidden = false;
search.addEventListener('input', filter);
filter();

// Keep sheets usable without JavaScript or WebGL. Download the renderer only on demand.
const dialog = document.querySelector('#building-dialog');
const previewHost = document.querySelector('#building-preview');
const previewStatus = document.querySelector('#preview-status');
let disposePreview;
let opening = 0;
let returnFocus;
dialog.addEventListener('close', () => {
  opening++;
  disposePreview?.();
  disposePreview = undefined;
  previewHost.replaceChildren();
  document.body.classList.remove('preview-open');
  returnFocus?.focus({ preventScroll: true });
});
const closeButton = document.querySelector('#preview-close');
closeButton.addEventListener('click', () => dialog.close());
// Mobile browsers can suppress the compatibility click after an orbit gesture.
// A deliberate tap on Close must still dismiss the viewer on its first attempt.
let closeTouch;
closeButton.addEventListener('pointerdown', (event) => {
  closeTouch =
    event.pointerType === 'touch'
      ? { id: event.pointerId, x: event.clientX, y: event.clientY }
      : undefined;
});
closeButton.addEventListener('pointercancel', () => {
  closeTouch = undefined;
});
closeButton.addEventListener('pointerup', (event) => {
  const start = closeTouch;
  closeTouch = undefined;
  if (
    start?.id === event.pointerId &&
    Math.hypot(event.clientX - start.x, event.clientY - start.y) < 10
  ) {
    event.preventDefault();
    dialog.close();
  }
});
dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const box = dialog.getBoundingClientRect();
  if (
    event.clientX < box.left ||
    event.clientX > box.right ||
    event.clientY < box.top ||
    event.clientY > box.bottom
  )
    dialog.close();
});
for (const link of document.querySelectorAll('[data-preview]')) {
  link.addEventListener('click', async (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const ticket = ++opening;
    returnFocus = link;
    document.querySelector('#preview-title').textContent = link.dataset.name;
    document.querySelector('#preview-sheet').href = link.href;
    document.querySelector('#preview-launch-label').hidden = true;
    previewStatus.textContent = 'Loading 3D preview…';
    previewHost.dataset.ready = 'false';
    dialog.querySelectorAll('select, [data-view], #preview-launch').forEach((control) => {
      control.disabled = true;
      if (control.tagName === 'SELECT') control.replaceChildren();
    });
    document.body.classList.add('preview-open');
    dialog.showModal();
    try {
      const { mount } = await import('/assets/building-viewer/viewer.js');
      if (ticket !== opening || !dialog.open) return;
      dialog
        .querySelectorAll('select, [data-view], #preview-launch')
        .forEach((control) => (control.disabled = false));
      disposePreview = mount(dialog, link.dataset.preview);
    } catch {
      if (ticket !== opening || !dialog.open) return;
      previewHost.replaceChildren();
      previewStatus.textContent =
        '3D preview unavailable. You can still open the image sheet below. Close and reopen to retry.';
      dialog
        .querySelectorAll('select, [data-view], #preview-launch')
        .forEach((control) => (control.disabled = true));
    }
  });
}
