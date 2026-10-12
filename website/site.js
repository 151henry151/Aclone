// SPDX-License-Identifier: GPL-3.0-or-later
// Progressive enhancement: without JavaScript, screenshots open as normal image links.
const dialog = document.querySelector('#screenshot-dialog');
if (dialog && typeof dialog.showModal === 'function') {
  const image = dialog.querySelector('img');
  const caption = dialog.querySelector('#screenshot-caption');
  for (const link of document.querySelectorAll('[data-gallery]')) {
    link.addEventListener('click', (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const source = link.querySelector('img');
      image.src = link.href;
      image.alt = source.alt;
      caption.textContent = link.closest('figure').querySelector('figcaption').textContent;
      dialog.showModal();
    });
  }
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      dialog.close();
  });
}
