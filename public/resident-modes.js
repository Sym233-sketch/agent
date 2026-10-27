/* Presentation preferences only. Resident state stays in the shared controller. */
(() => {
  'use strict';
  const key = 'mincetong-resident-mode-v1';
  const modes = { atelier: { label: '服务图谱', tree: () => window.MincetongAtelierTree, glyph: '<path d="M5 4v12h14M5 9h9V4"/><circle cx="5" cy="3" r="2"/><circle cx="15" cy="3" r="2"/><circle cx="20" cy="16" r="2"/>' }, titanium: { label: '立体空间', tree: () => window.MincetongTitaniumTree, glyph: '<path d="m12 3 9 5v9l-9 5-9-5V8l9-5Zm0 10 9-5m-9 5L3 8m9 5v9"/>' } };
  const valid = value => Object.hasOwn(modes, value);
  const url = new URL(location.href);
  let saved;
  try { saved = localStorage.getItem(key); } catch {}
  let selected = valid(url.searchParams.get('mode')) ? url.searchParams.get('mode') : location.pathname.includes('/atelier/') ? 'atelier' : location.pathname.includes('/titanium/') ? 'titanium' : valid(saved) ? saved : 'titanium';
  let active = '', options = null, loadingSpace = false;

  function writeMode() {
    const target = new URL(location.href); target.searchParams.set('mode', selected); history.replaceState(history.state, '', target);
  }

  function useStyle(mode) {
    document.documentElement.dataset.residentPresentation = mode;
    document.querySelector('#residentSpaceStyle').media = mode === 'titanium' ? 'all' : 'not all';
    if (mode === 'titanium' && !window.MincetongTitanium && !loadingSpace) {
      loadingSpace = true;
      const script = document.createElement('script'); script.type = 'module'; script.src = '/titanium/titanium-scene.js';
      script.onerror = () => { loadingSpace = false; script.remove(); const status = document.querySelector('.tree-status'); if (status) status.textContent = '立体空间暂未加载，仍可通过服务图谱选择服务。'; };
      document.head.append(script);
    }
  }
  function mount() {
    const header = document.querySelector('.tree-header-actions'); if (!header) return;
    let control = header.querySelector('.resident-mode-switch');
    if (!control) {
      control = document.createElement('div'); control.className = 'resident-mode-switch'; control.setAttribute('role', 'group'); control.setAttribute('aria-label', '界面模式');
      control.innerHTML = Object.entries(modes).map(([id, mode]) => `<button type="button" data-resident-mode="${id}" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true">${mode.glyph}</svg><span>${mode.label}</span></button>`).join('');
      control.addEventListener('click', event => { const button = event.target.closest('[data-resident-mode]'); if (button) change(button.dataset.residentMode); });
      header.prepend(control);
    }
    control.querySelectorAll('[data-resident-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.residentMode === selected)));
  }
  function render(next) {
    options = next;
    if (!active || (next.view === 'hall' && active !== selected)) {
      if (active) modes[active].tree().leave();
      active = selected; useStyle(active);
    }
    modes[active].tree().render(next); mount();
  }
  function change(next) {
    if (!valid(next) || next === selected || !options) return;
    const restoreFocus = document.activeElement?.closest('.resident-mode-switch');
    selected = next;
    try { localStorage.setItem(key, selected); } catch {}
    writeMode();
    // Keep an open form or embedded service connected. Swap the scene on return.
    if (options.view === 'hall') { render(options); options.afterModeChange?.(); }
    else mount();
    if (restoreFocus) document.querySelector(`.resident-mode-switch button[data-resident-mode="${selected}"]`)?.focus({ preventScroll: true });
  }
  useStyle(selected);
  writeMode();
  window.addEventListener('popstate', () => { const next = new URL(location.href).searchParams.get('mode'); if (valid(next)) change(next); });
  window.MincetongTree = { render, leave() { if (active) modes[active].tree().leave(); active = ''; options = null; } };
  window.MincetongModes = { change };
})();
