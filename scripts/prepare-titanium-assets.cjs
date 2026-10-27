'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.join(__dirname, '..', 'public', 'titanium');
const vendor = path.join(root, 'vendor'), assets = path.join(root, 'assets');
fs.mkdirSync(vendor, { recursive: true });fs.mkdirSync(assets, { recursive: true });
async function download(url, file, transform) {
  if (fs.existsSync(file)) return;
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error('Asset download failed (' + response.status + '): ' + url);
  const bytes = transform ? Buffer.from(transform(await response.text())) : Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(file, bytes);console.log(path.basename(file) + ': ' + bytes.length + ' bytes');
}
(async () => {
  await Promise.all([
    ...['loaders/HDRLoader.js', 'objects/Reflector.js'].map(async name => {
      const file = path.join(vendor, path.basename(name));
      const transform = source => source.replaceAll("from 'three'", "from '../../reels/vendor/three.module.js'").trimEnd() + '\n';
      if (process.argv[2]) {
        const source = cp.execFileSync('tar', ['-xOf', process.argv[2], 'package/examples/jsm/' + name], { encoding: 'utf8' });
        fs.writeFileSync(file, transform(source));
      } else await download('https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/' + name, file, transform);
    }),
    download('https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr', path.join(assets, 'studio-small-09-1k.hdr'))
  ]);
  fs.copyFileSync(path.join(root, '..', 'reels', 'vendor', 'LICENSE'), path.join(vendor, 'LICENSE'));
  fs.writeFileSync(path.join(assets, 'sources.json'), JSON.stringify([{ file: 'studio-small-09-1k.hdr', title: 'Studio Small 09', author: 'Sergej Majboroda', source: 'https://polyhaven.com/a/studio_small_09', license: 'https://polyhaven.com/license', usage: 'Shared lighting and reflections for the scene and service exhibits' }], null, 2) + '\n');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
