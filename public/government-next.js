/* Government presentation layer. Existing workflow handlers retain ownership of all actions. */
(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const design = params.get('design') === 'classic' ? 'classic' : 'next';
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

  const promise = document.createElement('p');
  promise.className = 'gov-only gov-human-note';
  promise.innerHTML = '<svg aria-hidden="true"><use href="#shield"/></svg><span>审查有依据，递送经确认。</span>';
  intro.append(promise);
  let motion;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const atmosphere = document.createElement('div');
  atmosphere.className = 'gov-only gov-atmosphere';
  atmosphere.setAttribute('aria-hidden', 'true');
  atmosphere.innerHTML = '<div class="gov-topology-host"><div class="gov-topology-fallback"><i></i></div></div><div class="gov-topology-stars"></div><div class="gov-topology-shade"></div>';
  atmosphere.classList.toggle('is-idle', document.hidden);
  document.body.prepend(atmosphere);

  // Feedback is visual only: native clicks, file pickers and confirmation handlers run immediately.
  const interactive = 'button,a[href],summary,[role="button"],.finding-item,.person-card,.mode-option';
  const animations = new Set(), springs = new Map(), taps = new WeakMap();
  let pressed, lastStep = '';
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
  document.addEventListener('visibilitychange', () => {
    atmosphere.classList.toggle('is-idle', document.hidden);
    if (document.hidden) clearFeedback();
  });
  reduced.addEventListener('change', () => { if (reduced.matches) clearFeedback(); });
  function updateScene() {
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
    document.documentElement.dataset.govPage = stepId;
    if (!active) {
      motion?.destroy(); motion = null;
      return;
    }
    if (!motion) motion = window.MincetongGovernmentScene.create(atmosphere.querySelector('.gov-topology-host'), reduced);
    motion.setActivity(stepId === '0' ? 1 : .18);
  }
  function apply(next) {
    if (!next) clearFeedback();
    if (next) document.documentElement.dataset.govDesign = 'next';
    else delete document.documentElement.dataset.govDesign;
    title.innerHTML = next ? '让政策，<br><em>准确抵达。</em>' : originals.title;
    description.innerHTML = next ? '核对材料、确认发布、检索先行者。<br>每一步清晰，每一次递送有据可循。' : originals.description;
    logo.innerHTML = next ? orbitMark : originals.logo;
    compare.textContent = next ? '对照原版' : '查看试版';
    compare.setAttribute('aria-label', next ? '切换到原版界面，保留当前任务' : '切换到拓扑工作台，保留当前任务');
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
  window.addEventListener('pagehide', () => { motion?.destroy(); motion = null; clearFeedback(); });
  window.addEventListener('pageshow', event => { if (event.persisted) { atmosphere.classList.toggle('is-idle', document.hidden); updateScene(); } });
  apply(design === 'next');
})();
