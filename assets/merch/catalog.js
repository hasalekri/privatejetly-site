const filters = document.querySelector('.filters');
const buttons = [...filters.querySelectorAll('[data-filter]')];
const products = document.querySelectorAll('.product');

filters.addEventListener('click', (event) => {
  const selected = event.target.closest('[data-filter]');
  if (!selected) return;

  for (const button of buttons) {
    button.setAttribute('aria-pressed', String(button === selected));
  }
  for (const product of products) {
    product.hidden = selected.dataset.filter !== 'All' && product.dataset.type !== selected.dataset.filter;
  }
});

filters.hidden = false;
