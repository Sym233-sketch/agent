'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../public/resident-modes.js'), 'utf8');

function harness(address = 'http://localhost/resident.html', saved = null, blocked = false) {
  const calls = [], stored = [], modules = [], events = {}, style = {}, html = { dataset: {} };
  const location = new URL(address);
  const engine = mode => ({ render(options) { calls.push({ type: 'render', mode, options }); }, leave() { calls.push({ type: 'leave', mode }); } });
  const window = { MincetongAtelierTree: engine('atelier'), MincetongTitaniumTree: engine('titanium'), addEventListener(name, fn) { events[name] = fn; } };
  const context = {
    URL, window, location,
    document: { documentElement: html, activeElement: null, querySelector(selector) { return selector === '#residentSpaceStyle' ? style : null; }, createElement() { return {}; }, head: { append(script) { modules.push(script); } } },
    localStorage: { getItem() { if (blocked) throw Error('blocked'); return saved; }, setItem(key, value) { if (blocked) throw Error('blocked'); stored.push([key, value]); } },
    history: { state: null, replaceState(state, unused, value) { location.href = String(value); } }
  };
  vm.runInNewContext(source, context);
  const render = (view = 'hall') => {
    const options = { view, profile: { name: '测试访客' }, html: '', afterModeChange() { calls.push({ type: 'bind' }); } };
    window.MincetongTree.render(options); return options;
  };
  return { ...context, calls, stored, modules, events, style, html, render };
}

test('unified entry remembers a valid preference; explicit routes and URL mode take precedence', () => {
  assert.equal(harness(undefined, 'atelier').html.dataset.residentPresentation, 'atelier');
  assert.equal(harness('http://localhost/atelier/user.html', 'titanium').html.dataset.residentPresentation, 'atelier');
  assert.equal(harness('http://localhost/titanium/user.html', 'atelier').html.dataset.residentPresentation, 'titanium');
  assert.equal(harness('http://localhost/atelier/user.html?mode=titanium', 'atelier').html.dataset.residentPresentation, 'titanium');
  assert.equal(harness(undefined, '__proto__').html.dataset.residentPresentation, 'titanium');
});

test('switching the hall releases the old scene and keeps the current resident object and route', () => {
  const h = harness('http://localhost/atelier/user.html?preview=1#hall');
  const original = h.render();
  h.window.MincetongModes.change('titanium');
  assert.deepEqual(h.calls.map(c => c.type + ':' + (c.mode || '')), ['render:atelier', 'leave:atelier', 'render:titanium', 'bind:']);
  assert.equal(h.calls[2].options, original);
  assert.equal(h.location.hash, '#hall');
  assert.equal(h.location.searchParams.get('preview'), '1');
  assert.equal(h.location.searchParams.get('mode'), 'titanium');
  assert.deepEqual(h.stored, [['mincetong-resident-mode-v1', 'titanium']]);
});

test('changing modes during a form or embedded service never remounts or disconnects its DOM', () => {
  for (const view of ['search', 'desk', 'services', 'messages', 'pilot']) {
    const h = harness('http://localhost/atelier/user.html#' + view);
    h.render(view);
    h.window.MincetongModes.change('titanium');
    assert.equal(h.calls.length, 1, view + ' must remain mounted');
    assert.equal(h.html.dataset.residentPresentation, 'atelier', 'keep its current scene until returning');
    h.render('hall');
    assert.deepEqual(h.calls.slice(1).map(c => [c.type, c.mode]), [['leave', 'atelier'], ['render', 'titanium']]);
    assert.equal(h.html.dataset.residentPresentation, 'titanium');
  }
});

test('repeated toggles release exactly one active engine; invalid or duplicate choices do nothing', () => {
  const h = harness('http://localhost/atelier/user.html'); h.render();
  for (let i = 0; i < 20; i++) h.window.MincetongModes.change(i % 2 ? 'atelier' : 'titanium');
  assert.equal(h.calls.filter(c => c.type === 'leave').length, 20);
  const before = h.calls.length;
  h.window.MincetongModes.change('atelier'); h.window.MincetongModes.change('__proto__'); h.window.MincetongModes.change('https://evil.example');
  assert.equal(h.calls.length, before);
  h.window.MincetongTree.leave();
  h.window.MincetongModes.change('titanium');
  assert.equal(h.calls.at(-1).type, 'leave', 'changing a preference cannot reopen enrollment');
});

test('storage restrictions do not prevent switching or overwrite resident credentials', () => {
  const h = harness('http://localhost/atelier/user.html', null, true); h.render();
  assert.doesNotThrow(() => h.window.MincetongModes.change('titanium'));
  assert.equal(h.html.dataset.residentPresentation, 'titanium');
  assert.equal(h.location.searchParams.get('mode'), 'titanium');
});

test('3D modules load only when needed and are not loaded again on each toggle', () => {
  const h = harness('http://localhost/atelier/user.html'); h.render();
  assert.equal(h.modules.length, 0);
  h.window.MincetongModes.change('titanium');
  assert.equal(h.modules[0].src, '/titanium/titanium-scene.js');
  h.window.MincetongModes.change('atelier'); h.window.MincetongModes.change('titanium');
  assert.equal(h.modules.length, 1);
});

test('back and forward navigation restore the mode encoded in the URL', () => {
  const h = harness('http://localhost/atelier/user.html'); h.render();
  h.window.MincetongModes.change('titanium');
  h.location.search = '?mode=atelier'; h.events.popstate();
  assert.equal(h.html.dataset.residentPresentation, 'atelier');
  assert.equal(h.calls.at(-2).mode, 'atelier');
});
