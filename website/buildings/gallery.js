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
