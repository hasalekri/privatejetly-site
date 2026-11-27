const root = document.documentElement;
const header = document.querySelector('.site-header');
const menu = document.querySelector('.menu-toggle');
const nav = document.querySelector('#nav');
const flight = document.querySelector('.flight');
const frame = flight.querySelector('.flight-frame');
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

const clamp = (value) => Math.min(1, Math.max(0, value));
const span = (value, start, end) => clamp((value - start) / (end - start));
const ease = (value) => value * value * (3 - 2 * value);
let queued = false;

function renderFlight() {
  queued = false;
  const bounds = flight.getBoundingClientRect();
  header.classList.toggle('solid', bounds.bottom < header.offsetHeight * 1.3);
  if (!motion.matches) return;

  const travel = flight.offsetHeight - frame.offsetHeight;
  const progress = travel > 0 ? clamp(-bounds.top / travel) : 0;
  const approach = ease(span(progress, .05, .65));
  const transition = ease(span(progress, .35, .63));
  const typeReveal = ease(span(progress, .54, .78));
  const typeOut = ease(span(progress, .08, .33));
  const reading = progress < .48 ? 1 - typeOut : typeReveal;
  frame.style.setProperty('--cabin-scale', 1 + approach * 4.8);
  frame.style.setProperty('--cabin-opacity', 1 - transition);
  frame.style.setProperty('--sky-scale', 1.12 - ease(span(progress, .37, .98)) * .12);
  frame.style.setProperty('--title-opacity', reading);
  frame.style.setProperty('--title-y', `${(1 - reading) * 65}%`);
}

function requestFrame() {
  if (!queued) {
    queued = true;
    requestAnimationFrame(renderFlight);
  }
}

function updateMotion() {
  root.classList.toggle('has-motion', motion.matches);
  if (!motion.matches) {
    frame.removeAttribute('style');
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
