'use strict';
const fs = require('node:fs');
const path = require('node:path');
const destination = path.join(__dirname, '..', 'public', 'album', 'photos');
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'care-photos.json'), 'utf8'));
const ids = { care: 'care', benefits: 'family', pilot: 'friends', messages: 'tiny', human: 'together' };
const sources = Object.entries(ids).map(([id, sourceId]) => {
  const photo = catalog.find(p => p.id === sourceId);
  return { id, author: photo.author, source: photo.source, license: photo.license, url: photo.photo, position: photo.position };
});
sources.push({
  id: 'search', author: 'Jason Leung',
  source: 'https://unsplash.com/photos/a-library-aisle-with-bookshelves-and-sunlight-through-window-xmeRBPunJR8',
  license: 'https://unsplash.com/license',
  url: 'https://images.unsplash.com/photo-1764728671460-34931d8261f5', position: '50% 50%'
});
fs.mkdirSync(destination, { recursive: true });
(async () => {
  await Promise.all(sources.map(async photo => {
    const file = path.join(destination, photo.id + '.jpg');
    if (fs.existsSync(file)) return;
    const url = new URL(photo.url);
    url.search = new URLSearchParams({ fm: 'jpg', fit: 'crop', w: '1000', q: '85' }).toString();
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) {
      throw new Error('Photo download failed: ' + photo.id + ' (' + response.status + ')');
    }
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length < 1000 || data[0] !== 0xff || data[1] !== 0xd8) throw new Error('Invalid JPEG: ' + photo.id);
    fs.writeFileSync(file, data);
    console.log(photo.id + ': ' + Math.round(data.length / 1024) + ' KB');
  }));
  fs.writeFileSync(path.join(destination, 'sources.json'), JSON.stringify(sources.map(({url, ...photo}) => photo), null, 2) + '\n');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
