/* Both presentations use the same current resident business controller. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
let controller = fs.readFileSync(path.join(root, 'public/user.js'), 'utf8');
const start = controller.indexOf('function renderApp(){');
const end = controller.indexOf('function messageView()', start);
if (start < 0 || end < start) throw new Error('Review current resident presentation adapter.');
controller = controller.slice(0, start) + `function renderApp(){
  document.body.dataset.careView='resident-'+view;
  if(!threads.some(t=>t.id===active))active=threads[0]?.id||'';
  window.MincetongTree.render({
    view,profile,unread:threads.filter(t=>t.unread).length,
    html:view==='messages'?messageView():view==='pilot'?pilotView():(view==='search'||view==='desk')?hallView():view==='services'?'<iframe id="serviceFrame" title="服务事项与提醒" src="/titanium/services.html?embedded=1"></iframe>':'',
    navigate:next=>{view=next;selectedDifficulties=[];location.hash=next;renderApp()},
    afterModeChange:()=>{bindApp();window.MINCETONG_CARE?.mount()}
  });
  bindApp();window.MINCETONG_CARE?.mount();persist();
  window.MincetongBirthday?.check({api:residentApi,profile:()=>profile});
}
` + controller.slice(end);
function replaceOnce(before, after) {
  if (controller.split(before).length !== 2) throw new Error('Review resident adapter: ' + before);
  controller = controller.replace(before, after);
}
replaceOnce('function renderEnroll(){', 'function renderEnroll(){\nwindow.MincetongTree?.leave();');
controller = controller.replaceAll("['messages','hall','pilot','search']", "['messages','hall','pilot','search','services','desk']");
replaceOnce('if(profile){if(profile.proactive)', "if(!profile&&new URLSearchParams(location.search).get('preview')==='1'){draft.name='演示访客';draft.identity='DEMO-ID-001';draft.proactive=false;joined=false;topics=[];finishEnroll();}else if(profile){if(profile.proactive)");
let html = fs.readFileSync(path.join(root, 'public/user.html'), 'utf8')
  .replace(/(href|src)="(?!https?:|\/|#)([^"]+)"/g, '$1="/$2"');
for (const name of ['care-organic.css', 'care-colors.css', 'service-launcher.css']) html = html.replace(`<link rel="stylesheet" href="/${name}">`, '');
for (const name of ['care-scenery.js', 'care-doodles.js', 'service-launcher.js']) html = html.replace(`<script src="/${name}"></script>`, '');
html = html.replace('</head>', '<meta name="color-scheme" content="dark"><link rel="stylesheet" href="/atelier/tree.css"><link id="residentSpaceStyle" rel="stylesheet" href="/titanium/titanium.css" media="not all"><link rel="stylesheet" href="/resident-modes.css"></head>');
let services = fs.readFileSync(path.join(root, 'public/services.html'), 'utf8')
  .replace(/(href|src)="(?!https?:|\/|#)([^"]+)"/g, '$1="/$2"')
  .replace('</head>', '<link rel="stylesheet" href="services-frame.css"></head>')
  .replace('</body>', '<script src="services-frame.js"></script></body>');
for (const mode of ['atelier', 'titanium']) {
  const target = path.join(root, 'public', mode);
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'user.js'), controller.trimEnd() + '\n');
  fs.writeFileSync(path.join(target, 'user.html'), entry(mode));
  fs.writeFileSync(path.join(target, 'services.html'), services);
}
fs.writeFileSync(path.join(root, 'public/resident.html'), entry('titanium'));
function entry(mode) {
  return html.replace('<script src="/user.js"></script>', `<script src="/atelier/tree.js"></script><script src="/titanium/tree.js"></script><script src="/resident-modes.js"></script><script src="/${mode}/user.js"></script>`);
}
console.log('Built resident dual modes and shared entry from the current controller.');
