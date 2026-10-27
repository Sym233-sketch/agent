/* Native 3D photo prints. No generated illustrations, UI sidebars or WebGL loop. */
const ITEMS = [
  { id: 'care', title: '养老关怀', position: '50% 50%' },
  { id: 'benefits', title: '补贴待遇', position: '42% 50%' },
  { id: 'search', title: '政策查询', position: '50% 50%' },
  { id: 'pilot', title: '政策共创', position: '46% 50%' },
  { id: 'messages', title: '服务消息', position: '50% 50%' },
  { id: 'human', title: '人工协助', position: '50% 50%' }
];
const TAU = Math.PI * 2;
const RATE = TAU / 96;
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
let activeEngine;

function create(host, { reduced }) {
  if (!host || activeEngine?.host === host) return activeEngine;
  activeEngine?.destroy();
  const stage = host.querySelector('.tree-stage');
  if (!stage) return null;
  const abort = new AbortController();
  const { signal } = abort;
  const space = document.createElement('nav');
  space.className = 'album-space';
  space.setAttribute('aria-label', '选择服务');
  space.innerHTML = '<div class="album-orbit"></div>';
  const orbit = space.firstElementChild;
  const cards = ITEMS.map(item => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'album-card';
    button.dataset.albumId = item.id;
    button.setAttribute('aria-label', item.title);
    button.style.setProperty('--photo-position', item.position);
    button.innerHTML = `<span class="album-photo" data-fallback="${item.title}"><img src="photos/${item.id}.jpg" alt="" draggable="false" decoding="async" width="1000" height="1000"></span><strong>${item.title}</strong>`;
    button.querySelector('img').addEventListener('error', () => button.classList.add('photo-unavailable'), { signal });
    orbit.append(button);
    return { element: button, id: item.id, lift: 0 };
  });
  stage.append(space);
  const old = stage.querySelector('.tree-world');
  old.setAttribute('aria-hidden', 'true');
  old.querySelectorAll('button,a').forEach(b => b.tabIndex = -1);
  stage.classList.add('album-ready');
  stage.setAttribute('aria-label', '服务相册');
  host.classList.add('album-active');
  host.querySelector('#treeTitle').textContent = '您需要什么帮助？';
  host.querySelector('.tree-profile').innerHTML = '<svg class="tree-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg>';

  let frame = 0, last = 0, phase = 0, speed = RATE, time = 0;
  let width = 1, height = 1, mobile = false, perspective = 1250;
  let radiusX = 400, radiusY = 150, depth = 180;
  let hovered = '', focused = '', opened = false, disposed = false, dirty = true;
  let drag = null, manualUntil = 0, suppressClickUntil = 0;

  function resize() {
    const r = space.getBoundingClientRect();
    width = r.width; height = r.height; mobile = width < 650;
    perspective = mobile ? 900 : 1250;
    const cardWidth = mobile ? clamp(width * .34, 116, 142) : clamp(width * .19, 180, 246);
    const cardHeight = cardWidth * (mobile ? 1.34 : 1.25);
    space.style.setProperty('--photo-w', cardWidth.toFixed(2) + 'px');
    space.style.setProperty('--photo-h', cardHeight.toFixed(2) + 'px');
    radiusX = mobile ? (width - cardWidth * 1.13) * .49 : (width - cardWidth * 1.23) * .46;
    radiusY = Math.min(height * (mobile ? .32 : .23), mobile ? 218 : 166);
    depth = mobile ? 56 : 190;
    dirty = true;
  }
  const observer = new ResizeObserver(resize);
  observer.observe(space);

  function activate(id) {
    if (opened) return;
    speed = 0;
    host.querySelector('#node-' + id)?.click();
    dirty = true;
  }
  space.addEventListener('click', event => {
    const card = event.target.closest('[data-album-id]');
    if (!card) return;
    event.stopPropagation();
    if (performance.now() < suppressClickUntil) { event.preventDefault(); return; }
    activate(card.dataset.albumId);
  }, { signal });
  space.addEventListener('focusin', event => {
    const card = event.target.closest('[data-album-id]');
    focused = card?.matches(':focus-visible') ? card.dataset.albumId : '';
    if (focused) speed = 0;
    dirty = true;
  }, { signal });
  space.addEventListener('focusout', () => { focused = ''; dirty = true; }, { signal });
  space.addEventListener('pointerdown', event => {
    if (event.button > 0 || opened) return;
    if (event.pointerType === 'mouse') event.preventDefault();
    drag = { x: event.clientX, y: event.clientY, distance: 0, id: event.pointerId };
    speed = 0;
  }, { signal });
  space.addEventListener('pointermove', event => {
    if (drag) {
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      drag.x = event.clientX; drag.y = event.clientY;
      drag.distance += Math.abs(dx) + Math.abs(dy);
      if (drag.distance > 7) {
        if (!space.hasPointerCapture(event.pointerId)) space.setPointerCapture(event.pointerId);
        phase += dx * (mobile ? .007 : .004);
        space.classList.add('is-dragging'); hovered = '';
      }
    } else if (event.pointerType === 'mouse') {
      hovered = event.target.closest('[data-album-id]')?.dataset.albumId || '';
    }
    dirty = true;
  }, { signal });
  const finishDrag = event => {
    if (!drag) return;
    if (drag.distance > 7) { suppressClickUntil = performance.now() + 350; manualUntil = performance.now() + 1000; }
    if (space.hasPointerCapture(drag.id)) space.releasePointerCapture(drag.id);
    drag = null; space.classList.remove('is-dragging');
    if (event.pointerType !== 'mouse') hovered = '';
    dirty = true;
  };
  space.addEventListener('pointerup', finishDrag, { signal });
  space.addEventListener('pointercancel', finishDrag, { signal });
  space.addEventListener('pointerleave', () => { if (!drag) hovered = ''; dirty = true; }, { signal });
  space.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const currentId = event.target.closest('[data-album-id]')?.dataset.albumId;
    const index = cards.findIndex(c => c.id === currentId);
    cards[(index + (event.key === 'ArrowLeft' ? 5 : 1)) % cards.length].element.focus({ preventScroll: true });
  }, { signal });

  function update(now) {
    if (disposed) return;
    frame = requestAnimationFrame(update);
    if (document.hidden) { last = now; return; }
    const dt = Math.min(.05, Math.max(0, (now - (last || now)) / 1000));
    last = now;
    const still = reduced();
    if (still && !dirty) return;
    if (opened && !dirty) return;
    const stopped = still || opened || !!drag || !!hovered || !!focused || now < manualUntil;
    const ease = 1 - Math.exp(-dt * 8);
    speed += ((stopped ? 0 : RATE) - speed) * ease;
    if (!still && !drag) { phase += speed * dt; time += dt; }
    cards.forEach((card, index) => {
      const a = phase + index * TAU / 6;
      const x = Math.cos(a) * radiusX;
      const y = Math.sin(a) * radiusY + (still ? 0 : Math.sin(time * .5 + index) * 3);
      const z = Math.sin(a) * depth;
      const active = !opened && (card.id === hovered || card.id === focused);
      card.lift += ((active ? 1 : 0) - card.lift) * (still ? 1 : ease);
      const liftedZ = z + (depth + 100 - z) * card.lift;
      const compensate = (perspective - liftedZ) / (perspective - z);
      const scale = compensate * (1 + card.lift * .045);
      const yaw = -Math.cos(a) * (mobile ? 9 : 16);
      const roll = Math.sin(index * 2.1) * 3.6 + (still ? 0 : Math.sin(time * .22 + index) * 1.1);
      card.element.style.transform = `translate(-50%,-50%) translate3d(${(x * compensate).toFixed(2)}px,${(y * compensate).toFixed(2)}px,${liftedZ.toFixed(2)}px) rotateY(${yaw.toFixed(2)}deg) rotateZ(${roll.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
      card.element.classList.toggle('is-active', active);
    });
    dirty = false;
  }
  resize();
  frame = requestAnimationFrame(update);
  const api = {
    host,
    reset() { phase = 0; hovered = focused = ''; speed = RATE; dirty = true; },
    refresh() { dirty = true; },
    step(value) { opened = value !== 0; space.inert = opened; if (opened) { hovered = focused = ''; } dirty = true; },
    burst() { dirty = true; },
    getBounds(id) {
      const card = cards.find(c => c.id === id)?.element;
      if (!card) return null;
      const r = card.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    },
    destroy() {
      if (disposed) return;
      disposed = true; abort.abort(); observer.disconnect(); cancelAnimationFrame(frame);
      space.remove(); stage.classList.remove('album-ready'); host.classList.remove('album-active');
      old.removeAttribute('aria-hidden'); old.querySelectorAll('button,a').forEach(b => b.removeAttribute('tabindex'));
      if (activeEngine === api) activeEngine = null;
    }
  };
  activeEngine = api;
  return api;
}
window.MincetongAlbum = { create };
window.dispatchEvent(new Event('mincetong-album-ready'));
