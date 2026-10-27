'use strict';
const fs = require('node:fs');
const path = require('node:path');
const base = path.join(__dirname, '..', 'public', 'orbit');
const target = path.join(__dirname, '..', 'public', 'album');
fs.mkdirSync(target, { recursive: true });
for (const name of ['user.js', 'services.html', 'services-frame.css', 'services-frame.js', 'tree.css']) {
  fs.copyFileSync(path.join(base, name), path.join(target, name));
}
const tree = fs.readFileSync(path.join(base, 'tree.js'), 'utf8')
  .replaceAll('MincetongOrbit', 'MincetongAlbum')
  .replaceAll('mincetong-orbit-ready', 'mincetong-album-ready')
  .replaceAll('orbit-ready', 'album-ready')
  .replaceAll('data-orbit-id', 'data-album-id')
  .replaceAll('服务图谱', '服务相册')
  .replaceAll('树状服务导航', '服务相册');
fs.writeFileSync(path.join(target, 'tree.js'), tree);
const html = fs.readFileSync(path.join(base, 'user.html'), 'utf8')
  .replace('href="orbit.css"', 'href="album.css"')
  .replace('src="orbit-scene.js"', 'src="album-scene.js"');
fs.writeFileSync(path.join(target, 'user.html'), html);
console.log('Built independent /album/ entry; previous versions were preserved.');
