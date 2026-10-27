/* Create an isolated presentation of the current resident controller. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const target=path.join(root,'public','atelier');
fs.mkdirSync(target,{recursive:true});
let source=fs.readFileSync(path.join(root,'public','user.js'),'utf8');
function replaceOnce(before,after){
  if(source.split(before).length!==2)throw new Error('Resident source changed; review tree adapter: '+before.slice(0,70));
  source=source.replace(before,after);
}
const start=source.indexOf('function renderApp(){');
const end=source.indexOf('function messageView()',start);
if(start<0||end<start)throw new Error('Resident renderer not found');
source=source.slice(0,start)+`function renderApp(){
  document.body.dataset.careView='resident-'+view;
  if(!threads.some(t=>t.id===active))active=threads[0]?.id||'';
  window.MincetongTree.render({
    view,profile,unread:threads.filter(t=>t.unread).length,
    html:view==='messages'?messageView():view==='pilot'?pilotView():view==='search'?hallView():view==='services'?'<iframe id="serviceFrame" title="服务事项与提醒" src="services.html?embedded=1"></iframe>':'',
    navigate:next=>{view=next;selectedDifficulties=[];location.hash=next;renderApp()}
  });
  bindApp();persist();
}
\n`+source.slice(end);
replaceOnce('function renderEnroll(){','function renderEnroll(){\n  window.MincetongTree?.leave();');
replaceOnce("persist();view='messages';location.hash='messages';renderApp();", "persist();view='hall';location.hash='hall';renderApp();");
source=source.replaceAll("['messages','hall','pilot','search']", "['messages','hall','pilot','search','services']");
replaceOnce("location.hash.slice(1):'messages';syncInvitation();renderApp()", "location.hash.slice(1):'hall';syncInvitation();renderApp()");
fs.writeFileSync(path.join(target,'user.js'),source.trimEnd()+'\n');
let html=fs.readFileSync(path.join(root,'public','modern','user.html'),'utf8');
html=html.replace('<link rel="stylesheet" href="modern.css"><link rel="stylesheet" href="polish.css">','<link rel="stylesheet" href="tree.css">');
html=html.replace('<script src="/user.js"></script>','<script src="tree.js"></script><script src="user.js"></script>');
html=html.replace('<script src="/service-launcher.js"></script>','').replace('<script src="art.js"></script><script src="modern.js"></script><script src="polish.js"></script>','');
fs.writeFileSync(path.join(target,'user.html'),html);
let services=fs.readFileSync(path.join(root,'public','services.html'),'utf8');
services=services.replace('href="services.css"','href="/services.css"><link rel="stylesheet" href="services-frame.css"');
services=services.replace('src="services.js"','src="/services.js"').replace('src="click-sounds.js"','src="/click-sounds.js"');
services=services.replace('</body>','<script src="services-frame.js"></script></body>');
fs.writeFileSync(path.join(target,'services.html'),services);
console.log('Built isolated tree presentation; original files unchanged.');
