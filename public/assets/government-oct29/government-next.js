/* Optional government design study. Keeps the existing workflow and its state. */
(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  if (!['next', 'classic'].includes(params.get('design'))) return;
  const $ = selector => document.querySelector(selector);
  const intro = $('.import-slide .intro');
  const title = intro.querySelector('h1');
  const description = intro.querySelector(':scope > p');
  const logo = $('.brand-logo');
  const originals = {title: title.innerHTML, description: description.innerHTML, logo: logo.innerHTML};
  const orbitMark = '<svg viewBox="0 0 32 32" aria-hidden="true"><ellipse cx="16" cy="16" rx="13" ry="5.8" transform="rotate(-35 16 16)"/><ellipse cx="16" cy="16" rx="6.4" ry="12" transform="rotate(-25 16 16)"/><circle cx="16" cy="16" r="1.6"/></svg>';
  const compare = document.createElement('button');
  compare.type = 'button';
  compare.className = 'gov-comparison';
  $('.top-actions').prepend(compare);
  const railLabel = document.createElement('span');
  railLabel.className = 'gov-only gov-rail-label';
  railLabel.textContent = '工作空间';
  $('.rail').prepend(railLabel);
  const residentLink = $('.rail > a');
  const residentLabel = document.createElement('span');
  residentLabel.className = 'gov-only';
  residentLabel.textContent = '前往民生端';
  residentLink.append(residentLabel);

  const orbit = document.createElement('div');
  orbit.className = 'gov-only gov-orbit';
  orbit.setAttribute('aria-hidden', 'true');
  orbit.innerHTML = '<canvas class="ob-canvas"></canvas><svg class="gov-orbit-fallback" viewBox="0 0 400 220"><defs><linearGradient id="govMetal" x1="0" x2="1" y2="1"><stop stop-color="#586472"/><stop offset=".25" stop-color="#d9e5f2"/><stop offset=".5" stop-color="#4b5365"/><stop offset=".75" stop-color="#a0a2b9"/><stop offset="1" stop-color="#252936"/></linearGradient></defs><ellipse cx="200" cy="110" rx="104" ry="70" fill="none" stroke="url(#govMetal)" stroke-width="19" transform="rotate(-25 200 110)"/></svg><span class="gov-motion-support ob-cursor-anchor" hidden><span class="ob-cursor"></span><span class="ob-cursor-dot"></span></span>';
  description.after(orbit);
  const promise = document.createElement('p');
  promise.className = 'gov-only gov-human-note';
  promise.innerHTML = '<svg aria-hidden="true"><use href="#shield"/></svg><span>审查有依据，递送经确认。</span>';
  intro.append(promise);
  const dossier = document.createElement('div');
  dossier.className = 'gov-only gov-dossier';
  dossier.setAttribute('aria-hidden', 'true');
  dossier.innerHTML = '<svg viewBox="0 0 240 182"><defs><linearGradient id="govPaper" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#eff3fa"/><stop offset="1" stop-color="#a5b1c7"/></linearGradient><linearGradient id="govGlass" x1="0" x2="1" y2="1"><stop stop-color="#354050"/><stop offset="1" stop-color="#1b2230"/></linearGradient></defs><g class="gov-dossier-back"><rect x="98" y="22" width="82" height="120" rx="10" fill="url(#govGlass)" stroke="#7586a34d" transform="rotate(17 139 82)"/><path d="m130 45 30 9m-34 6 30 9m-35 5 25 8" stroke="#9daec057" stroke-width="3" stroke-linecap="round"/></g><g class="gov-dossier-front"><path d="M76 31h57l26 27v95a9 9 0 0 1-9 9H76a9 9 0 0 1-9-9V40a9 9 0 0 1 9-9Z" fill="url(#govPaper)" stroke="#ffffff70"/><path d="M132 32v22a5 5 0 0 0 5 5h21" fill="#dce5f2" stroke="#ffffff70"/><path d="M85 83h54M85 96h54M85 109h33" stroke="#75859a" stroke-width="3" stroke-linecap="round"/><rect x="85" y="128" width="29" height="15" rx="4" fill="#303b4f"/><path d="m91 136 4 3 6-7" stroke="#e7efff" stroke-width="1.5" fill="none" stroke-linecap="round"/></g><circle cx="175" cy="143" r="21" fill="#c4d6f4"/><path d="M175 152v-17m-6 6 6-6 6 6" stroke="#2a3b55" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  $('#dropZone h2').before(dossier);

  let motion, generation = 0, scriptPromise;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const atmosphere = document.createElement('div');
  atmosphere.className = 'gov-only gov-atmosphere';
  atmosphere.setAttribute('aria-hidden', 'true');
  atmosphere.innerHTML = '<div class="gov-atmosphere-film"></div><div class="gov-atmosphere-light"></div><div class="gov-atmosphere-grain"></div>';
  atmosphere.classList.toggle('is-idle', document.hidden);
  document.body.prepend(atmosphere);
  for (const [selector, path] of [['.gov-atmosphere-film','satin-light.svg'],['.gov-atmosphere-grain','film-grain.svg']]) {
    fetch('assets/government-oct29/' + path).then(response => {
      if (!response.ok) throw Error('Background asset unavailable');
      return response.text();
    }).then(source => {
      const svg = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement;
      if (svg.localName !== 'svg') return;
      svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      atmosphere.querySelector(selector).replaceChildren(document.importNode(svg, true));
    }).catch(() => {});
  }

  // Feedback is visual only: native clicks, file pickers and confirmation handlers run immediately.
  const interactive = 'button,a[href],summary,[role="button"],.finding-item,.person-card,.mode-option';
  const animations = new Set(), springs = new Map(), taps = new WeakMap();
  let pressed, pointerFrame = 0, pointerX = .62, pointerY = .35, lastStep = '';
  const isNext = () => document.documentElement.dataset.govDesign === 'next';
  function controlFor(event) {
    if (!(event.target instanceof Element) || !isNext() || reduced.matches) return null;
    const node = event.target.closest(interactive);
    return node && !node.matches(':disabled,[aria-disabled="true"]') ? node : null;
  }
  function track(animation, cleanup = () => {}) {
    animations.add(animation);
    const finish = () => { animations.delete(animation); cleanup(); };
    animation.finished.then(finish, finish);
    return animation;
  }
  function spring(node, from = '.97') {
    springs.get(node)?.cancel();
    const animation = node.animate([{scale:from},{scale:'1.018',offset:.55},{scale:'1'}], {duration:390,easing:'cubic-bezier(.22,1,.36,1)'});
    springs.set(node, animation);
    track(animation, () => { if (springs.get(node) === animation) springs.delete(node); });
  }
  function release(cancelled = false) {
    if (!pressed) return;
    const {node, animation} = pressed;
    const from = getComputedStyle(node).scale;
    animation.cancel();
    pressed = null;
    if (!cancelled && isNext() && !reduced.matches && node.isConnected) spring(node, from === 'none' ? '1' : from);
  }
  function clearFeedback() {
    release(true);
    for (const animation of [...animations]) animation.cancel();
    document.querySelectorAll('.gov-feedback-surface').forEach(node => node.remove());
  }
  document.addEventListener('pointerdown', event => {
    const node = controlFor(event);
    if (!node || event.button !== 0 || event.isPrimary === false) return;
    release(true);
    springs.get(node)?.cancel();
    const animation = track(node.animate([{scale:'1'},{scale:'.968'}], {duration:100,fill:'forwards',easing:'cubic-bezier(.2,.8,.2,1)'}));
    pressed = {node, animation, id:event.pointerId};
  }, {capture:true,passive:true});
  window.addEventListener('pointerup', event => { if (pressed?.id === event.pointerId) release(); }, {passive:true});
  window.addEventListener('pointercancel', () => release(true), {passive:true});
  window.addEventListener('pointerout', event => { if (!event.relatedTarget) release(true); }, {passive:true});
  window.addEventListener('blur', clearFeedback);
  document.addEventListener('click', event => {
    const node = controlFor(event);
    if (!node || performance.now() - (taps.get(node) || -1000) < 85) return;
    taps.set(node, performance.now());
    const box = node.getBoundingClientRect();
    if (!box.width || !box.height) return;
    if (event.detail === 0) spring(node);
    const surface = document.createElement('div');
    surface.className = 'gov-feedback-surface';
    surface.dataset.govStep = node.closest('[data-page]')?.dataset.page || 'persistent';
    surface.setAttribute('aria-hidden', 'true');
    const x = event.detail ? event.clientX - box.left : box.width / 2;
    const y = event.detail ? event.clientY - box.top : box.height / 2;
    const size = Math.max(90, Math.hypot(box.width, box.height) * 2);
    Object.assign(surface.style, {left:box.left+'px',top:box.top+'px',width:box.width+'px',height:box.height+'px',borderRadius:getComputedStyle(node).borderRadius || '12px'});
    const wave = document.createElement('span');
    Object.assign(wave.style, {left:x+'px',top:y+'px',width:size+'px',height:size+'px'});
    surface.append(wave);
    (node.closest('dialog') || document.body).append(surface);
    const old = document.querySelectorAll('.gov-feedback-surface');
    if (old.length > 8) old[0].remove();
    track(wave.animate([{transform:'translate(-50%,-50%) scale(0)',opacity:.68},{opacity:.3,offset:.35},{transform:'translate(-50%,-50%) scale(1)',opacity:0}], {duration:620,easing:'cubic-bezier(.16,1,.3,1)'}), () => surface.remove());
    track(surface.animate([{opacity:1},{opacity:0}], {duration:640,easing:'ease-out'}));
  }, {capture:true,passive:true});
  document.addEventListener('pointermove', event => {
    if (!isNext() || reduced.matches || event.pointerType === 'touch') return;
    pointerX = event.clientX / innerWidth;
    pointerY = event.clientY / innerHeight;
    if (!pointerFrame) pointerFrame = requestAnimationFrame(() => {
      pointerFrame = 0;
      atmosphere.style.setProperty('--gov-light-x', Math.round(pointerX * innerWidth) + 'px');
      atmosphere.style.setProperty('--gov-light-y', Math.round(pointerY * innerHeight) + 'px');
    });
  }, {passive:true});
  document.addEventListener('visibilitychange', () => {
    atmosphere.classList.toggle('is-idle', document.hidden);
    if (document.hidden) clearFeedback();
  });
  reduced.addEventListener('change', () => { if (reduced.matches) clearFeedback(); });
  function loadScene() {
    if (window.MincetongMotion) return Promise.resolve();
    if (!scriptPromise) scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'onboarding-scene.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    });
    return scriptPromise;
  }
  async function updateScene() {
    const active = document.documentElement.dataset.govDesign === 'next';
    const step = [...document.querySelectorAll('[data-page]')].find(node => !node.hidden);
    const stepId = step?.dataset.page || '0';
    if (stepId !== lastStep) document.querySelectorAll('.gov-feedback-surface').forEach(node => {
      if (node.dataset.govStep !== 'persistent' && node.dataset.govStep !== stepId) node.remove();
    });
    if (active && stepId !== lastStep && !reduced.matches) {
      track(step.animate([{opacity:0,transform:'translateY(14px)',filter:'blur(4px)'},{opacity:1,transform:'translateY(0)',filter:'blur(0px)'}], {duration:470,easing:'cubic-bezier(.22,1,.36,1)'}));
    }
    lastStep = stepId;
    document.documentElement.style.setProperty('--gov-progress', ((Number(step?.dataset.page || 0) + 1) * 25) + '%');
    if (step?.dataset.page === '3') $('#matchPolicyName').title = $('#matchPolicyName').textContent;
    if (!active || step?.dataset.page !== '0') {
      generation++;
      motion?.destroy();
      motion = null;
      return;
    }
    if (motion) return;
    const current = ++generation;
    try {
      await loadScene();
      if (current !== generation) return;
      motion = window.MincetongMotion.create(orbit, reduced);
    } catch { orbit.dataset.renderer = 'fallback'; }
  }
  function apply(next) {
    if (!next) clearFeedback();
    if (next) document.documentElement.dataset.govDesign = 'next';
    else delete document.documentElement.dataset.govDesign;
    title.innerHTML = next ? '让政策，<br><em>准确抵达。</em>' : originals.title;
    description.innerHTML = next ? '从发布前的细致核对，<br>到每一位先行者的真实反馈。' : originals.description;
    logo.innerHTML = next ? orbitMark : originals.logo;
    compare.textContent = next ? '对照原版' : '查看试版';
    compare.setAttribute('aria-label', next ? '切换到原版界面，保留当前任务' : '切换到钛银试版，保留当前任务');
    compare.setAttribute('aria-pressed', String(next));
    const url = new URL(location.href);
    url.searchParams.set('design', next ? 'next' : 'classic');
    history.replaceState(null, '', url);
    updateScene();
    // Recalculate document pagination after the workspace changes width.
    window.dispatchEvent(new Event('resize'));
  }
  compare.onclick = () => apply(document.documentElement.dataset.govDesign !== 'next');
  new MutationObserver(updateScene).observe(document.body, {attributes: true, attributeFilter: ['data-care-view']});
  window.addEventListener('pagehide', () => { generation++; motion?.destroy(); motion = null; clearFeedback(); cancelAnimationFrame(pointerFrame); pointerFrame = 0; });
  window.addEventListener('pageshow', event => { if (event.persisted) { atmosphere.classList.toggle('is-idle', document.hidden); updateScene(); } });
  apply(params.get('design') === 'next');
})();
