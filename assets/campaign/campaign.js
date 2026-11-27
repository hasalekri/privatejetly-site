const root = document.documentElement;
const header = document.querySelector('.site-header');
const menu = document.querySelector('.menu-toggle');
const nav = document.querySelector('#nav');
const flight = document.querySelector('.journey');
const frame = flight.querySelector('.journey-frame');
const motion = matchMedia('(prefers-reduced-motion: no-preference)');
const desktopPointer = matchMedia('(hover: hover) and (pointer: fine)');

menu.hidden = false;

function closeMenu(restoreFocus = false) {
  menu.setAttribute('aria-expanded', 'false');
  if (restoreFocus) menu.focus();
}

menu.addEventListener('click', () => {
  menu.setAttribute('aria-expanded', String(menu.getAttribute('aria-expanded') === 'false'));
});
nav.addEventListener('click', (event) => {
  if (event.target.closest('a')) closeMenu();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') closeMenu(true);
});
document.addEventListener('click', (event) => {
  if (!header.contains(event.target)) closeMenu();
});

const languageButtons = [...document.querySelectorAll('[data-lang]')];
const translations = [
  ...Array.from(document.querySelectorAll('[data-ar]'), (element) => [element, 'textContent', element.textContent, element.dataset.ar]),
  ...Array.from(document.querySelectorAll('[data-ar-label]'), (element) => [element, 'aria-label', element.getAttribute('aria-label'), element.dataset.arLabel]),
  ...Array.from(document.querySelectorAll('[data-ar-alt]'), (element) => [element, 'alt', element.getAttribute('alt'), element.dataset.arAlt]),
];

function setLanguage(language) {
  root.lang = language;
  root.dir = language === 'ar' ? 'rtl' : 'ltr';
  document.title = language === 'ar' ? 'سما العز | فوق المألوف' : 'JetMajlis | Above the ordinary';
  for (const [element, field, english, arabic] of translations) {
    const text = language === 'ar' ? arabic : english;
    if (field === 'textContent') element.textContent = text;
    else element.setAttribute(field, text);
  }
  for (const button of languageButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.lang === language));
  }
  root.dispatchEvent(new Event('campaign-language'));
}

const initialLanguage = new URL(location.href).searchParams.get('lang');
if (initialLanguage === 'ar') setLanguage('ar');
for (const button of languageButtons) {
  button.addEventListener('click', () => {
    const language = button.dataset.lang;
    setLanguage(language);
    const url = new URL(location.href);
    if (language === 'ar') url.searchParams.set('lang', 'ar');
    else url.searchParams.delete('lang');
    history.replaceState(history.state, '', url);
  });
}
document.querySelector('.languages').hidden = false;

// The same pressed-button behaviour drives the galleries and destination board.
for (const group of document.querySelectorAll('.gallery-controls, .route-options')) {
  const buttons = [...group.querySelectorAll('button')];
  for (const button of buttons) {
    button.addEventListener('click', () => {
      if (button.getAttribute('aria-pressed') === 'true') return;
      for (const candidate of buttons) {
        const active = candidate === button;
        candidate.setAttribute('aria-pressed', String(active));
        const panel = document.getElementById(candidate.getAttribute('aria-controls'));
        panel.hidden = !active;
        panel.classList.toggle('active', active);
      }
    });
  }
}

const scenes = [...frame.querySelectorAll('.journey-scene')];
const track = frame.querySelector('.journey-track');
const stages = [...track.querySelectorAll('[data-stage]')];
const clamp = (value) => Math.min(1, Math.max(0, value));
let queued = false;
let activeStage = -1;

function renderFlight() {
  queued = false;
  const bounds = flight.getBoundingClientRect();
  header.classList.toggle('solid', bounds.bottom < header.offsetHeight * 1.3);
  if (!motion.matches) return;

  const travel = flight.offsetHeight - frame.offsetHeight;
  const progress = travel > 0 ? clamp(-bounds.top / travel) : 0;
  const position = progress * scenes.length;
  const chapter = Math.min(scenes.length - 1, Math.floor(position));
  const fraction = position - chapter;
  const blend = chapter === scenes.length - 1 ? 0 : clamp((fraction - .53) / .47);
  const fade = blend * blend * (3 - 2 * blend);
  const selected = chapter + (fade > .5 && chapter + 1 < scenes.length ? 1 : 0);
  scenes.forEach((scene, index) => {
    const next = index === chapter + 1;
    scene.style.setProperty('--scene-opacity', index === chapter ? 1 : next ? fade : 0);
    scene.style.setProperty('--scene-scale', index === chapter ? 1 + fraction * .11 : 1);
    scene.style.setProperty('--copy-opacity', index === chapter ? 1 - fade : next ? fade : 0);
  });
  track.style.setProperty('--tour-progress', progress);
  if (selected !== activeStage) {
    activeStage = selected;
    stages.forEach((button, index) => button.setAttribute('aria-pressed', String(index === selected)));
    for (const [index, scene] of scenes.entries()) {
      const focused = document.activeElement;
      if (index !== selected && scene.contains(focused)) stages[selected].focus({ preventScroll: true });
      scene.inert = index !== selected;
    }
  }
}

function requestFrame() {
  if (!queued) {
    queued = true;
    requestAnimationFrame(renderFlight);
  }
}

function goToStage(index) {
  const top = window.scrollY + flight.getBoundingClientRect().top;
  const travel = flight.offsetHeight - frame.offsetHeight;
  window.scrollTo({ top: top + travel * (index + .13) / scenes.length, behavior: 'smooth' });
}

for (const [index, button] of stages.entries()) {
  button.addEventListener('click', () => goToStage(index));
}
for (const [index, scene] of scenes.entries()) {
  scene.querySelector('.journey-next')?.addEventListener('click', (event) => {
    if (!motion.matches) return;
    event.preventDefault();
    stages[index + 1].focus({ preventScroll: true });
    goToStage(index + 1);
  });
}

function updateMotion() {
  root.classList.toggle('has-motion', motion.matches);
  track.hidden = !motion.matches;
  activeStage = -1;
  if (!motion.matches) {
    for (const scene of scenes) {
      scene.removeAttribute('style');
      scene.inert = false;
    }
    for (const element of document.querySelectorAll('.gallery-stage')) element.removeAttribute('style');
  }
  requestFrame();
}

const visible = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      entry.target.classList.remove('awaiting');
      visible.unobserve(entry.target);
    }
  }
}, { threshold: .12 }) : null;
if (visible && motion.matches) {
  for (const element of document.querySelectorAll('.reveal')) {
    if (element.getBoundingClientRect().top < innerHeight) continue;
    element.classList.add('awaiting');
    visible.observe(element);
    element.addEventListener('focusin', () => element.classList.remove('awaiting'), { once: true });
  }
}

for (const stage of document.querySelectorAll('.gallery-stage')) {
  stage.addEventListener('pointermove', (event) => {
    if (!motion.matches || !desktopPointer.matches || event.pointerType === 'touch') return;
    const bounds = stage.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - .5;
    const y = (event.clientY - bounds.top) / bounds.height - .5;
    stage.style.setProperty('--ry', `${x * 2}deg`);
    stage.style.setProperty('--rx', `${y * -2}deg`);
    stage.style.setProperty('--zoom', '1.025');
  });
  stage.addEventListener('pointerleave', () => stage.removeAttribute('style'));
}

window.addEventListener('scroll', requestFrame, { passive: true });
window.addEventListener('resize', requestFrame, { passive: true });
motion.addEventListener('change', updateMotion);
updateMotion();

const imageDialog = document.querySelector('.image-dialog');
if (typeof imageDialog.showModal === 'function') {
  const dialogImage = imageDialog.querySelector('img');
  imageDialog.querySelector('button').addEventListener('click', () => imageDialog.close());

  for (const button of document.querySelectorAll('.expand-image')) {
    button.hidden = false;
    button.addEventListener('click', () => {
      const image = button.closest('.gallery').querySelector('figure:not([hidden]) img');
      dialogImage.src = image.currentSrc || image.src;
      dialogImage.alt = image.alt;
      imageDialog.showModal();
    });
  }
}

const basketPanel = document.querySelector('#basket');
const reviewPanel = document.querySelector('#order-review');
const trigger = document.querySelector('#basket-trigger');
const count = document.querySelector('#basket-count');
const reviewButton = basketPanel.querySelector('[data-review]');
const storageKey = 'jetmajlis-basket-v1';
const products = new Map();
const basket = new Map();
const localize = (en, ar) => root.lang === 'ar' ? ar : en;

for (const button of document.querySelectorAll('[data-add-product]')) {
  const id = button.dataset.addProduct;
  products.set(id, button.closest('article').querySelector('h3'));
  button.hidden = false;
  button.addEventListener('click', () => {
    changeQuantity(id, 1);
    showSection(basketPanel);
  });
}

try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
  for (const [id, quantity] of Object.entries(saved || {})) {
    if (products.has(id) && Number.isSafeInteger(quantity) && quantity > 0 && quantity <= 99) {
      basket.set(id, quantity);
    }
  }
} catch {
  // The basket remains usable when browser storage is unavailable.
}

function changeQuantity(id, amount) {
  const quantity = Math.min(99, (basket.get(id) || 0) + amount);
  if (quantity > 0) basket.set(id, quantity);
  else basket.delete(id);
  try {
    localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(basket)));
  } catch {
    // Keep the current session's basket in memory.
  }
  renderShop();
}

function renderLines(container, editable) {
  container.replaceChildren();
  for (const [id, quantity] of basket) {
    const line = document.createElement('li');
    const name = products.get(id).textContent;
    const controls = document.createElement('span');
    line.className = 'shop-line';
    controls.className = 'shop-quantity';
    const quantityLabel = document.createElement('bdi');
    quantityLabel.textContent = quantity;
    controls.append(quantityLabel);
    if (editable) {
      for (const [amount, symbol, label] of [
        [-1, '−', localize('Decrease quantity', 'تقليل الكمية')],
        [1, '+', localize('Increase quantity', 'زيادة الكمية')],
      ]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = symbol;
        button.setAttribute('aria-label', `${label}: ${name}`);
        button.disabled = amount > 0 && quantity === 99;
        button.addEventListener('click', () => {
          changeQuantity(id, amount);
          const replacement = Array.from(container.querySelectorAll('button'))
            .find(candidate => candidate.getAttribute('aria-label') === button.getAttribute('aria-label') && !candidate.disabled);
          (replacement || container.querySelector('button:not(:disabled)') || basketPanel.querySelector('h2')).focus();
        });
        amount < 0 ? controls.prepend(button) : controls.append(button);
      }
    }
    line.append(document.createTextNode(name), controls);
    container.append(line);
  }
}


function renderShop() {
  count.textContent = Array.from(basket.values()).reduce((sum, quantity) => sum + quantity, 0);
  basketPanel.querySelector('.shop-empty').hidden = basket.size > 0;
  reviewButton.disabled = basket.size === 0;
  renderLines(basketPanel.querySelector('.shop-lines'), true);
  renderLines(reviewPanel.querySelector('.shop-lines'), false);
  if (basket.size === 0) reviewPanel.hidden = true;
}

function showSection(section) {
  basketPanel.hidden = false;
  section.hidden = false;
  if (location.hash !== '#' + section.id) location.hash = section.id;
  section.scrollIntoView({ block: 'start' });
  section.querySelector('h2').focus({ preventScroll: true });
}

trigger.hidden = false;
trigger.addEventListener('click', (event) => {
  event.preventDefault();
  showSection(basketPanel);
});
reviewButton.addEventListener('click', () => {
  if (basket.size > 0) showSection(reviewPanel);
});
root.addEventListener('campaign-language', renderShop);
renderShop();

if (location.hash === '#basket') showSection(basketPanel);
if (location.hash === '#order-review') showSection(basket.size ? reviewPanel : basketPanel);
