'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.join(__dirname, '..');
const target = path.join(root, 'public', 'titanium');
require('./build-resident-modes.cjs');
let tree = fs.readFileSync(path.join(root, 'public', 'album', 'tree.js'), 'utf8')
  .replaceAll('MincetongAlbum', 'MincetongTitanium')
  .replaceAll('mincetong-album-ready', 'mincetong-titanium-ready')
  .replaceAll('album-ready', 'titanium-ready')
  .replaceAll('data-album-id', 'data-titanium-id')
  .replaceAll('服务相册', '服务空间')
  .replace('window.MincetongTree={render,leave};', 'window.MincetongTitaniumTree={render,leave};')
  .replace('`services.html?embedded=1&group=', '`/titanium/services.html?embedded=1&group=')
  .replace("hall:'服务空间',", "hall:'服务空间',desk:'办事服务',")
  .replace("icon:'benefits',view:'services',group:'benefits'", "icon:'benefits',view:'desk',group:''");
fs.writeFileSync(path.join(target, 'tree.js'), tree);
for (const name of ['tree.css', 'services-frame.css', 'services-frame.js']) {
  fs.copyFileSync(path.join(root, 'public', 'album', name), path.join(target, name));
}
const upstream = cp.execFileSync('git', ['rev-parse', 'origin/main'], { cwd: root, encoding: 'utf8' }).trim();
fs.writeFileSync(path.join(target, 'source-upstream.json'), JSON.stringify({ repository: 'https://github.com/Sym233-sketch/agent', upstream, resident: 'public/user.js', entry: 'public/user.html', includes: ['service-desk', 'contextual-care', 'birthday', 'policy-discovery', 'onboarding'], photographs: '../album/photos/sources.json' }, null, 2) + '\n');
console.log('Built /titanium/ from current upstream resident resources (' + upstream.slice(0, 7) + ').');
