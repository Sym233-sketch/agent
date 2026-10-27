'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.join(__dirname, '..');
const target = path.join(root, 'public', 'titanium');
fs.mkdirSync(target, { recursive: true });
let controller = fs.readFileSync(path.join(root, 'public', 'user.js'), 'utf8');
const start = controller.indexOf('function renderApp(){');
const end = controller.indexOf('function messageView()', start);
if (start < 0 || end < start) throw new Error('Review latest resident presentation adapter.');
controller = controller.slice(0, start) + `function renderApp(){
  document.body.dataset.careView='resident-'+view;
  if(!threads.some(t=>t.id===active))active=threads[0]?.id||'';
  window.MincetongTree.render({
    view,profile,unread:threads.filter(t=>t.unread).length,
    html:view==='messages'?messageView():view==='pilot'?pilotView():(view==='search'||view==='desk')?hallView():view==='services'?'<iframe id="serviceFrame" title="服务事项与提醒" src="services.html?embedded=1"></iframe>':'',
    navigate:next=>{view=next;selectedDifficulties=[];location.hash=next;renderApp()}
  });
  bindApp();persist();
  window.MincetongBirthday?.check({api:residentApi,profile:()=>profile});
}
` + controller.slice(end);
function replaceOnce(before, after) {
  if (controller.split(before).length !== 2) throw new Error('Review current resident controller: ' + before);
  controller = controller.replace(before, after);
}
replaceOnce('function renderEnroll(){', 'function renderEnroll(){\nwindow.MincetongTree?.leave();');
if (!controller.includes("persist();view='hall';location.hash='hall';renderApp();")) throw new Error('Review latest enrollment destination.');
controller = controller.replaceAll("['messages','hall','pilot','search']", "['messages','hall','pilot','search','services','desk']");
replaceOnce('if(profile){if(profile.proactive)', "if(!profile&&new URLSearchParams(location.search).get('preview')==='1'){draft.name='演示访客';draft.identity='DEMO-ID-001';draft.proactive=false;joined=false;topics=[];finishEnroll();}else if(profile){if(profile.proactive)");
fs.writeFileSync(path.join(target, 'user.js'), controller.trimEnd() + '\n');
let tree = fs.readFileSync(path.join(root, 'public', 'album', 'tree.js'), 'utf8')
  .replaceAll('MincetongAlbum', 'MincetongTitanium')
  .replaceAll('mincetong-album-ready', 'mincetong-titanium-ready')
  .replaceAll('album-ready', 'titanium-ready')
  .replaceAll('data-album-id', 'data-titanium-id')
  .replaceAll('服务相册', '服务空间')
  .replace("hall:'服务空间',", "hall:'服务空间',desk:'办事服务',")
  .replace("icon:'benefits',view:'services',group:'benefits'", "icon:'benefits',view:'desk',group:''");
fs.writeFileSync(path.join(target, 'tree.js'), tree);
for (const name of ['tree.css', 'services-frame.css', 'services-frame.js']) {
  fs.copyFileSync(path.join(root, 'public', 'album', name), path.join(target, name));
}
let html = fs.readFileSync(path.join(root, 'public', 'user.html'), 'utf8')
  .replace(/(href|src)="(?!https?:|\/|#)([^"]+)"/g, '$1="/$2"');
for (const name of ['care-organic.css', 'care-colors.css', 'service-launcher.css']) html = html.replace(`<link rel="stylesheet" href="/${name}">`, '');
for (const name of ['care-scenery.js', 'care-doodles.js', 'service-launcher.js']) html = html.replace(`<script src="/${name}"></script>`, '');
html = html.replace('<script src="/user.js"></script>', '<script src="tree.js"></script><script src="user.js"></script>')
  .replace('</head>', '<meta name="color-scheme" content="dark"><link rel="stylesheet" href="tree.css"><link rel="stylesheet" href="titanium.css"></head>')
  .replace('</body>', '<script type="module" src="titanium-scene.js"></script></body>');
fs.writeFileSync(path.join(target, 'user.html'), html);
let services = fs.readFileSync(path.join(root, 'public', 'services.html'), 'utf8')
  .replace(/(href|src)="(?!https?:|\/|#)([^"]+)"/g, '$1="/$2"')
  .replace('</head>', '<link rel="stylesheet" href="services-frame.css"></head>')
  .replace('</body>', '<script src="services-frame.js"></script></body>');
fs.writeFileSync(path.join(target, 'services.html'), services);
const upstream = cp.execFileSync('git', ['rev-parse', 'origin/main'], { cwd: root, encoding: 'utf8' }).trim();
fs.writeFileSync(path.join(target, 'source-upstream.json'), JSON.stringify({ repository: 'https://github.com/Sym233-sketch/agent', upstream, resident: 'public/user.js', entry: 'public/user.html', includes: ['service-desk', 'contextual-care', 'birthday', 'policy-discovery', 'onboarding'], photographs: '../album/photos/sources.json' }, null, 2) + '\n');
console.log('Built /titanium/ from current upstream resident resources (' + upstream.slice(0, 7) + ').');
