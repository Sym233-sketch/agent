import * as THREE from '../reels/vendor/three.module.js';
import { HDRLoader } from './vendor/HDRLoader.js';
import { Reflector } from './vendor/Reflector.js';

const ITEMS = [
  { id: 'care', title: '养老关怀', w: 2.70, h: 3.18, y: 1.00, turn: -.42 },
  { id: 'benefits', title: '办事服务', w: 3.48, h: 2.68, y: -.95, turn: .32 },
  { id: 'search', title: '政策查询', w: 3.10, h: 2.90, y: -1.02, turn: -.62 },
  { id: 'pilot', title: '政策共创', w: 3.28, h: 2.78, y: 1.35, turn: .74 },
  { id: 'messages', title: '服务消息', w: 2.82, h: 3.12, y: 1.00, turn: -.16 },
  { id: 'human', title: '人工协助', w: 3.48, h: 2.68, y: -.50, turn: .58 }
];
const TAU = Math.PI * 2, clamp = THREE.MathUtils.clamp;
let activeEngine;

function roundedShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function create(host, { reduced }) {
  if (!host || activeEngine?.host === host) return activeEngine;
  activeEngine?.destroy();
  const stage = host.querySelector('.tree-stage');
  if (!stage) return null;
  const abort = new AbortController(), { signal } = abort;
  const resources = new Set(), nodes = [];
  const keep = value => { resources.add(value); return value; };
  const view = document.createElement('div'); view.className = 'titanium-view';
  const canvas = document.createElement('canvas'); canvas.className = 'titanium-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const hits = document.createElement('nav'); hits.className = 'titanium-hits'; hits.setAttribute('aria-label', '选择服务');
  view.append(canvas, hits); stage.append(view);
  let disposed = false, opened = false, frame = 0, last = 0, time = 0, flow = 1, dirty = true;
  let mobile = false, width = 1, height = 1, hovered = '', focused = '', drag = null;
  let manualYaw = 0, manualPitch = .13, targetYaw = 0, cameraYaw = 0, manualUntil = 0, suppressClickUntil = 0;
  let radiusX = 5.8, radiusZ = 3.7, distance = 21, environmentTarget;
  const mouse = new THREE.Vector2(), projected = new THREE.Vector3(), targetPosition = new THREE.Vector3();
  const targetRotation = new THREE.Quaternion(), rotationEuler = new THREE.Euler();
  const cornerVectors = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch {
    canvas.remove(); hits.remove();
    view.innerHTML = '<nav class="titanium-fallback" aria-label="选择服务">' + ITEMS.map(item => `<button data-titanium-id="${item.id}"><img src="../album/photos/${item.id}.jpg" alt=""><strong>${item.title}</strong></button>`).join('') + '</nav>';
    view.addEventListener('click', event => { const id = event.target.closest('[data-titanium-id]')?.dataset.titaniumId; if (id) host.querySelector('#node-' + id)?.click(); }, { signal });
    stage.classList.add('titanium-ready');
    return { host, refresh() {}, step() {}, burst() {}, reset() {}, getBounds() { return null; }, destroy() { abort.abort(); view.remove(); stage.classList.remove('titanium-ready'); } };
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.VSMShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x181d24);
  scene.fog = new THREE.FogExp2(0x181d24, .018);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 110);
  const look = new THREE.Vector3(0, .10, 0), raycaster = new THREE.Raycaster();
  const rig = new THREE.Group(); scene.add(rig);

  // A continuous floor and curved wall, rather than a flat background image.
  const profile = [[-4.22, 35], [-4.22, -4]];
  for (let i = 1; i <= 30; i++) {
    const a = i / 30 * Math.PI / 2;
    profile.push([-4.22 + 4 * (1 - Math.cos(a)), -4 - 4 * Math.sin(a)]);
  }
  profile.push([18, -8]);
  const positions = [], indices = [];
  profile.forEach(([y, z]) => positions.push(-45, y, z, 45, y, z));
  for (let i = 0; i < profile.length - 1; i++) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const roomGeometry = keep(new THREE.BufferGeometry());
  roomGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); roomGeometry.setIndex(indices); roomGeometry.computeVertexNormals();
  const roomMaterial = keep(new THREE.MeshStandardMaterial({ color: 0x252a32, metalness: .28, roughness: .52, side: THREE.DoubleSide }));
  const room = new THREE.Mesh(roomGeometry, roomMaterial); room.receiveShadow = true; scene.add(room);
  scene.add(new THREE.HemisphereLight(0xd8e4f2, 0x292621, 1.35));
  const key = new THREE.DirectionalLight(0xffe9c9, 3.4); key.position.set(-7, 11, 8); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -12; key.shadow.camera.right = 12;
  key.shadow.camera.top = 10; key.shadow.camera.bottom = -10; key.shadow.camera.near = 1; key.shadow.camera.far = 35;
  key.shadow.bias = -.0003; key.shadow.normalBias = .035; key.shadow.radius = 5; key.shadow.blurSamples = 8;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xc2d5e9, 1.5); fill.position.set(8, 4, 7); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffeee0, 2.0); rim.position.set(-4, 6, -5); scene.add(rim);
  const wallLight = new THREE.SpotLight(0xffd9ac, 190, 45, .77, 1, 1.5);
  wallLight.position.set(-11, 9, 3); wallLight.target.position.set(-4, 2.5, -7); scene.add(wallLight, wallLight.target);

  // Low-strength, softly sampled planar reflections share the same real objects.
  const reflection = new Reflector(keep(new THREE.PlaneGeometry(70, 65)), { textureWidth: 512, textureHeight: 512, clipBias: .003, multisample: 0 });
  reflection.rotation.x = -Math.PI / 2; reflection.position.y = -4.205;
  reflection.material.transparent = true; reflection.material.depthWrite = false;
  reflection.material.uniforms.color.value.set(0xcbd3db);
  reflection.material.fragmentShader = reflection.material.fragmentShader.replace(
    'vec4 base = texture2DProj( tDiffuse, vUv );',
    `vec2 uv = vUv.xy / vUv.w;
     vec4 base = texture2D(tDiffuse, uv) * .28;
     base += texture2D(tDiffuse, uv + vec2(.006, .003)) * .18;
     base += texture2D(tDiffuse, uv - vec2(.006, .003)) * .18;
     base += texture2D(tDiffuse, uv + vec2(.003, -.006)) * .18;
     base += texture2D(tDiffuse, uv - vec2(.003, -.006)) * .18;`
  ).replace('gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );', 'gl_FragColor = vec4( blendOverlay( base.rgb, color ), 0.10 );');
  scene.add(reflection);

  // An immediate neutral environment is replaced by a real CC0 studio HDRI.
  const envCanvas = document.createElement('canvas'); envCanvas.width = 512; envCanvas.height = 256;
  const envContext = envCanvas.getContext('2d'); envContext.fillStyle = '#242b35'; envContext.fillRect(0, 0, 512, 256);
  for (const [x, y, w, h] of [[45, 15, 85, 190], [320, 40, 125, 85]]) {
    const g = envContext.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#f7f0df00'); g.addColorStop(.3, '#fff2dfee'); g.addColorStop(.7, '#e9f3ffee'); g.addColorStop(1, '#edf5ff00'); envContext.fillStyle = g; envContext.fillRect(x, y, w, h);
  }
  const initialEnv = keep(new THREE.CanvasTexture(envCanvas)); initialEnv.mapping = THREE.EquirectangularReflectionMapping; initialEnv.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  environmentTarget = pmrem.fromEquirectangular(initialEnv); scene.environment = environmentTarget.texture; scene.environmentIntensity = .65;
  new HDRLoader().load('assets/studio-small-09-1k.hdr', hdr => {
    if (disposed) { hdr.dispose(); return; }
    const target = pmrem.fromEquirectangular(hdr); hdr.dispose(); environmentTarget.dispose(); environmentTarget = target;
    scene.environment = target.texture; dirty = true;
  }, undefined, () => { dirty = true; });

  const titanium = keep(new THREE.MeshPhysicalMaterial({ color: 0x98a1ac, metalness: .94, roughness: .29, clearcoat: .30, clearcoatRoughness: .22, envMapIntensity: 1.05 }));
  const glass = keep(new THREE.MeshPhysicalMaterial({ color: 0xcbd6de, metalness: .08, roughness: .12, transparent: true, opacity: .115, clearcoat: 1, clearcoatRoughness: .07, depthWrite: false, envMapIntensity: .7 }));

  function photoTexture(node, back = false) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * node.item.h / node.item.w);
    const ctx = c.getContext('2d'), h = c.height;
    ctx.fillStyle = back ? '#1c232c' : '#3c444d'; ctx.fillRect(0, 0, 1024, h);
    if (node.image) {
      const scale = Math.max(1024 / node.image.naturalWidth, h / node.image.naturalHeight);
      const w = node.image.naturalWidth * scale, ih = node.image.naturalHeight * scale;
      ctx.globalAlpha = back ? .11 : 1; ctx.filter = 'saturate(.82)';
      ctx.drawImage(node.image, (1024 - w) * .46, (h - ih) * .5, w, ih);
      ctx.globalAlpha = 1; ctx.filter = 'none';
    }
    if (!back) {
      const g = ctx.createLinearGradient(0, h * .60, 0, h); g.addColorStop(0, '#0b111900'); g.addColorStop(1, '#10171fe8');
      ctx.fillStyle = g; ctx.fillRect(0, h * .6, 1024, h * .4);
    }
    ctx.fillStyle = '#f0eee8'; ctx.font = `500 ${mobile ? 126 : 90}px "Microsoft YaHei UI", "PingFang SC", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(node.item.title, 512, back ? h * .66 : h - (mobile ? 107 : 88), 940);
    const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    return texture;
  }
  function refreshTextures(node) {
    for (const [material, back] of [[node.frontMaterial, false], [node.backMaterial, true]]) {
      material.map?.dispose(); material.map = photoTexture(node, back); material.needsUpdate = true;
    }
  }
  ITEMS.forEach((item, index) => {
    const group = new THREE.Group(); group.userData.id = item.id; rig.add(group);
    const bodyGeometry = keep(new THREE.ExtrudeGeometry(roundedShape(item.w, item.h, .14), { depth: .18, bevelEnabled: true, bevelSize: .045, bevelThickness: .045, bevelSegments: 3, curveSegments: 14, steps: 1 }));
    const body = new THREE.Mesh(bodyGeometry, titanium); body.position.z = -.13; body.castShadow = true; group.add(body);
    const plane = keep(new THREE.PlaneGeometry(item.w - .13, item.h - .13));
    const frontMaterial = keep(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
    const backMaterial = keep(new THREE.MeshStandardMaterial({ color: 0xe2e6eb, metalness: .62, roughness: .38 }));
    const front = new THREE.Mesh(plane, frontMaterial); front.position.z = .101; group.add(front);
    const coating = new THREE.Mesh(plane, glass); coating.position.z = .115; group.add(coating);
    const back = new THREE.Mesh(plane, backMaterial); back.position.z = -.181; back.rotation.y = Math.PI; group.add(back);
    const button = document.createElement('button'); button.type = 'button'; button.className = 'titanium-hit'; button.dataset.titaniumId = item.id; button.setAttribute('aria-label', item.title); button.innerHTML = `<span>${item.title}</span>`; hits.append(button);
    const node = { item, index, group, button, frontMaterial, backMaterial, image: null };
    nodes.push(node); refreshTextures(node);
    const image = new Image(); image.decoding = 'async';
    image.onload = () => { if (!disposed) { node.image = image; refreshTextures(node); dirty = true; } };
    image.src = '../album/photos/' + item.id + '.jpg';
  });

  function resize() {
    const r = view.getBoundingClientRect(), previous = mobile; width = r.width; height = r.height; mobile = width < 650;
    radiusX = mobile ? 1.95 : 7.1; radiusZ = mobile ? 1.8 : 5.5;
    const requiredH = mobile ? 14.8 : 13.6, requiredW = mobile ? 7.9 : 22.0;
    camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix();
    distance = Math.max(requiredH / 2, requiredW / (2 * camera.aspect)) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.4, Math.sqrt(850000 / Math.max(1, width * height)))); renderer.setSize(width, height, false);
    reflection.visible = !mobile;
    if (previous !== mobile) nodes.forEach(refreshTextures);
    dirty = true;
  }
  const observer = new ResizeObserver(resize); observer.observe(view);

  function activate(id) { if (!opened) { flow = 0; host.querySelector('#node-' + id)?.click(); dirty = true; } }
  function hit(event) {
    const button = event.target.closest('[data-titanium-id]'); if (button) return button.dataset.titaniumId;
    mouse.set(event.clientX / width * 2 - 1, -(event.clientY / height * 2 - 1)); raycaster.setFromCamera(mouse, camera);
    const found = raycaster.intersectObjects(nodes.map(n => n.group), true)[0]; if (!found) return '';
    let object = found.object; while (object && !object.userData.id) object = object.parent;
    return object?.userData.id || '';
  }
  view.addEventListener('pointerdown', event => {
    if (event.button > 0 || opened) return;
    if (event.pointerType === 'mouse') event.preventDefault();
    drag = { x: event.clientX, y: event.clientY, moved: 0, id: event.pointerId }; flow = 0;
  }, { signal });
  view.addEventListener('pointermove', event => {
    if (drag) {
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y; drag.x = event.clientX; drag.y = event.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
      if (drag.moved > 7) {
        if (!view.hasPointerCapture(event.pointerId)) view.setPointerCapture(event.pointerId);
        manualYaw += dx * .003; manualPitch = clamp(manualPitch + dy * .0015, .02, .32); hovered = ''; view.classList.add('is-dragging');
      }
    } else if (event.pointerType === 'mouse') hovered = hit(event);
    dirty = true;
  }, { signal });
  const finish = event => {
    if (!drag) return;
    const moved = drag.moved;
    if (view.hasPointerCapture(drag.id)) view.releasePointerCapture(drag.id);
    drag = null; view.classList.remove('is-dragging');
    if (moved > 7) { suppressClickUntil = performance.now() + 350; manualUntil = performance.now() + 1200; }
    if (event.pointerType !== 'mouse') hovered = ''; dirty = true;
  };
  view.addEventListener('pointerup', finish, { signal }); view.addEventListener('pointercancel', finish, { signal });
  view.addEventListener('click', event => { if (performance.now() < suppressClickUntil) return; const id = hit(event); if (id) { event.stopPropagation(); activate(id); } }, { signal });
  view.addEventListener('pointerleave', () => { if (!drag) hovered = ''; dirty = true; }, { signal });
  hits.addEventListener('focusin', event => { const b = event.target.closest('[data-titanium-id]'); focused = b?.matches(':focus-visible') ? b.dataset.titaniumId : ''; if (focused) flow = 0; dirty = true; }, { signal });
  hits.addEventListener('focusout', () => { focused = ''; dirty = true; }, { signal });
  hits.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); const id = event.target.closest('[data-titanium-id]')?.dataset.titaniumId; const i = nodes.findIndex(n => n.item.id === id);
      nodes[(i + (event.key === 'ArrowLeft' ? 5 : 1)) % nodes.length].button.focus({ preventScroll: true });
    }
    if (event.key === 'Home') { event.preventDefault(); reset(); }
  }, { signal });

  function projectButton(node) {
    const { group, item, button } = node, w = (item.w + .02) / 2, h = (item.h + .02) / 2;
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    [[-w, h], [w, h], [w, -h], [-w, -h]].forEach(([x, y], i) => {
      const p = cornerVectors[i].set(x, y, .02).applyMatrix4(group.matrixWorld).project(camera);
      p.x = (p.x + 1) * width / 2; p.y = (1 - p.y) * height / 2;
      left = Math.min(left, p.x); right = Math.max(right, p.x); top = Math.min(top, p.y); bottom = Math.max(bottom, p.y);
    });
    const bw = Math.max(1, right - left), bh = Math.max(1, bottom - top);
    button.style.width = bw.toFixed(2) + 'px'; button.style.height = bh.toFixed(2) + 'px'; button.style.transform = `translate3d(${left.toFixed(2)}px,${top.toFixed(2)}px,0)`;
    button.style.clipPath = 'polygon(' + cornerVectors.map(p => `${((p.x - left) / bw * 100).toFixed(2)}% ${((p.y - top) / bh * 100).toFixed(2)}%`).join(',') + ')';
    projected.copy(group.position).project(camera); button.style.zIndex = String(Math.max(1, Math.round((1 - projected.z) * 10000)));
  }
  function reset() { time = 0; manualYaw = targetYaw = cameraYaw = 0; manualPitch = .13; hovered = focused = ''; manualUntil = 0; flow = 1; dirty = true; }
  function update(now) {
    if (disposed) return;
    frame = requestAnimationFrame(update);
    if (document.hidden) { last = now; return; }
    const dt = Math.min(.05, Math.max(0, (now - (last || now)) / 1000)); last = now;
    const still = reduced(); if ((still || opened) && !dirty) return;
    const stopped = still || opened || !!hovered || !!focused || !!drag || now < manualUntil;
    const ease = still ? 1 : 1 - Math.exp(-dt * 6);
    flow += ((stopped ? 0 : 1) - flow) * ease; if (!still && !drag && !opened) time += dt * flow;
    targetYaw = manualYaw + (still ? 0 : Math.sin(time * .055) * .025); cameraYaw += (targetYaw - cameraYaw) * ease;
    camera.position.set(Math.sin(cameraYaw) * distance, distance * manualPitch + 1.25, Math.cos(cameraYaw) * distance);
    camera.lookAt(look); camera.updateMatrixWorld();
    nodes.forEach((node, i) => {
      const a = time * .085 + i * TAU / 6 + .32 + Math.sin(time * .025 + i * .7) * .025;
      const y = mobile ? [3.6, .8, -2.3, 1.8, -.8, -2.65][i] + Math.sin(a * 1.4 + i) * .24 : node.item.y + Math.sin(a * 1.73 + i * .6) * .38 + Math.cos(time * .027 + i) * .14;
      targetPosition.set(Math.cos(a) * radiusX, y, Math.sin(a) * radiusZ + Math.cos(time * .036 + i) * .22);
      const active = !opened && (node.item.id === hovered || node.item.id === focused);
      if (active) targetPosition.z += .20;
      node.group.position.lerp(targetPosition, dirty && !last ? 1 : Math.max(.08, ease));
      const automaticTurn = node.item.turn + Math.sin(time * (.028 + i * .003) + i * .8) * .36 + (i === 3 && !mobile ? time * .023 : 0);
      const ownTurn = mobile ? clamp(automaticTurn, -.45, .45) : automaticTurn;
      rotationEuler.set(Math.sin(time * .039 + i) * .12 + (i % 2 ? .07 : -.07), ownTurn, Math.sin(i * 1.8) * .055 + Math.sin(time * .031 + i) * .035);
      targetRotation.setFromEuler(rotationEuler);
      if (active) targetRotation.copy(camera.quaternion);
      node.group.quaternion.slerp(targetRotation, Math.max(.08, ease));
      const scale = (mobile ? .90 : 1) * (active ? 1.045 : 1); node.group.scale.setScalar(scale);
    });
    scene.updateMatrixWorld(); nodes.forEach(projectButton);
    renderer.render(scene, camera); dirty = false;
  }
  const old = stage.querySelector('.tree-world'); old.setAttribute('aria-hidden', 'true'); old.querySelectorAll('button,a').forEach(b => b.tabIndex = -1);
  stage.classList.add('titanium-ready'); stage.setAttribute('aria-label', '三维服务空间'); host.classList.add('titanium-active');
  host.querySelector('#treeTitle').textContent = '您需要什么帮助？';
  host.querySelector('.tree-profile').innerHTML = '<svg class="tree-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg>';
  resize(); frame = requestAnimationFrame(update);
  const api = {
    host, reset, refresh() { dirty = true; }, burst() { dirty = true; },
    step(value) { opened = value !== 0; hits.inert = opened; if (opened) hovered = focused = ''; dirty = true; },
    getBounds(id) { const b = nodes.find(n => n.item.id === id)?.button; if (!b) return null; const r = b.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; },
    destroy() {
      if (disposed) return; disposed = true; abort.abort(); observer.disconnect(); cancelAnimationFrame(frame);
      nodes.forEach(n => { n.frontMaterial.map?.dispose(); n.backMaterial.map?.dispose(); });
      reflection.dispose(); key.shadow.dispose(); environmentTarget.dispose(); pmrem.dispose(); resources.forEach(r => r.dispose?.()); renderer.dispose();
      view.remove(); stage.classList.remove('titanium-ready'); host.classList.remove('titanium-active'); old.removeAttribute('aria-hidden'); old.querySelectorAll('button,a').forEach(b => b.removeAttribute('tabindex'));
      if (activeEngine === api) activeEngine = null;
    }
  };
  activeEngine = api; return api;
}
window.MincetongTitanium = { create };
window.dispatchEvent(new Event('mincetong-titanium-ready'));
