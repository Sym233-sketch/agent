import * as THREE from '../reels/vendor/three.module.js';

const ITEMS=[
 {id:'care',group:'living',title:'养老与关怀',note:'照护、助餐与日常支持',color:0xe88b89},
 {id:'benefits',group:'living',title:'补贴与待遇',note:'查看事项，逐项确认条件',color:0xd9c194},
 {id:'search',group:'policy',title:'查找政策',note:'官方原文与适用条件',color:0xa3c9e8},
 {id:'pilot',group:'policy',title:'参与政策共创',note:'分享经验，自愿参与',color:0xb8b2e2},
 {id:'messages',group:'message',title:'我的服务消息',note:'查看提醒与服务进展',color:0xa6cdd6},
 {id:'human',group:'message',title:'找人帮一把',note:'了解人工协助方式',color:0xa3c3d8}
];
const GROUPS=[{id:'living',title:'生活服务',color:0xd9bfa9},{id:'policy',title:'政策与共创',color:0xaec4e1},{id:'message',title:'与您有关',color:0xaecbcf}];
const TAU=Math.PI*2,BASE_RATE=TAU/72,clamp=THREE.MathUtils.clamp;
let activeEngine;

function rounded(w,h,r){const s=new THREE.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;}
function heartShape(size=1){const s=new THREE.Shape();s.moveTo(0,-.64*size);s.bezierCurveTo(-.15*size,-.40*size,-.79*size,-.05*size,-.69*size,.42*size);s.bezierCurveTo(-.62*size,.88*size,-.14*size,.90*size,0,.52*size);s.bezierCurveTo(.14*size,.90*size,.62*size,.88*size,.69*size,.42*size);s.bezierCurveTo(.79*size,-.05*size,.15*size,-.40*size,0,-.64*size);return s;}
function create(host,{reduced}){
 if(!host||activeEngine?.host===host)return activeEngine;activeEngine?.destroy();
 const stage=host.querySelector('.tree-stage');if(!stage)return null;
 const abort=new AbortController(),signal=abort.signal,resources=new Set(),nodes=[],pickables=[],wires=[],hubs=[];
 let disposed=false,frame=0,last=0,time=0,phase=0,speed=BASE_RATE,dirty=true,mobile=false,group='all',hovered='',focused='',selected='',drag=null,manualUntil=0,opened=false;
 let yaw=.04,pitch=.55,targetYaw=.04,targetPitch=.55,baseDistance=20,stateText='';
 const keep=r=>{resources.add(r);return r;};
 const view=document.createElement('div');view.className='orbit-view';
 view.innerHTML='<div class="orbit-state">正在缓慢环绕</div><div class="orbit-groups" role="group" aria-label="选择服务分支"><button data-orbit-group="all" aria-pressed="true">全景</button><button data-orbit-group="living" aria-pressed="false">生活服务</button><button data-orbit-group="policy" aria-pressed="false">政策与共创</button><button data-orbit-group="message" aria-pressed="false">与您有关</button></div><div class="orbit-labels"></div><div class="orbit-inspector"><strong>您可以先看看</strong><small>停在一项服务上，查看它能提供哪些帮助。</small></div>';
 const canvas=document.createElement('canvas');canvas.className='orbit-canvas';canvas.tabIndex=0;canvas.setAttribute('aria-label','自动缓慢环绕的三维服务选项，可拖动调整，悬停停留，也可使用下方服务按钮');view.prepend(canvas);stage.append(view);
 let renderer;try{renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});}catch{view.remove();console.warn('Orbit renderer unavailable; keeping the accessible tree.');return null;}
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.16;
 const scene=new THREE.Scene(),rig=new THREE.Group();scene.add(rig);
 const camera=new THREE.PerspectiveCamera(35,1,.1,100),look=new THREE.Vector3(0,0,0),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
 const envCanvas=document.createElement('canvas');envCanvas.width=1024;envCanvas.height=512;const ctx=envCanvas.getContext('2d');ctx.fillStyle='#18212c';ctx.fillRect(0,0,1024,512);
 for(const [x,y,w,h]of [[80,20,130,320],[580,85,230,170],[350,350,250,60],[925,65,35,280]]){const g=ctx.createLinearGradient(x,0,x+w,0);g.addColorStop(0,'#eef6ff00');g.addColorStop(.3,'#eef6ffe8');g.addColorStop(.7,'#fff6e5e8');g.addColorStop(1,'#eef6ff00');ctx.fillStyle=g;ctx.fillRect(x,y,w,h);}
 const env=keep(new THREE.CanvasTexture(envCanvas));env.mapping=THREE.EquirectangularReflectionMapping;env.colorSpace=THREE.SRGBColorSpace;const pmrem=new THREE.PMREMGenerator(renderer),envTarget=pmrem.fromEquirectangular(env);scene.environment=envTarget.texture;keep(envTarget);pmrem.dispose();
 scene.add(new THREE.HemisphereLight(0xe0edff,0x29313d,2.0));const key=new THREE.DirectionalLight(0xfff4e4,3.1);key.position.set(-6,9,11);scene.add(key);const fill=new THREE.DirectionalLight(0xb9d9ff,2.6);fill.position.set(9,4,6);scene.add(fill);const rim=new THREE.DirectionalLight(0xffffff,2);rim.position.set(-4,-5,7);scene.add(rim);
 const silver=keep(new THREE.MeshPhysicalMaterial({color:0xbac7d2,metalness:.87,roughness:.20,clearcoat:1}));
 const pearl=keep(new THREE.MeshPhysicalMaterial({color:0xd9e0e3,metalness:.32,roughness:.24,clearcoat:1}));
 const blue=keep(new THREE.MeshPhysicalMaterial({color:0x7ca8cd,metalness:.48,roughness:.23,clearcoat:1}));
 const ink=keep(new THREE.MeshStandardMaterial({color:0x294259,metalness:.55,roughness:.33}));
 const gold=keep(new THREE.MeshPhysicalMaterial({color:0xd6b36e,metalness:.78,roughness:.24,clearcoat:.8}));
 const red=keep(new THREE.MeshPhysicalMaterial({color:0xd82b3e,metalness:.25,roughness:.21,clearcoat:1}));
 const violet=keep(new THREE.MeshPhysicalMaterial({color:0xa99cd1,metalness:.40,roughness:.24,clearcoat:1}));
 const cylinder=keep(new THREE.CylinderGeometry(1,1,1,24)),sphere=keep(new THREE.SphereGeometry(1,24,16)),box=keep(new THREE.BoxGeometry(1,1,1));
 function mesh(geometry,material,parent,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);parent.add(m);return m;}
 function solid(shape,depth,mat,parent,x=0,y=0,z=0,bevel=.07){return mesh(keep(new THREE.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:3,curveSegments:20})),mat,parent,x,y,z);}
 function ball(radius,mat,parent,x=0,y=0,z=0){const m=mesh(sphere,mat,parent,x,y,z);m.scale.setScalar(radius);return m;}
 function block(w,h,d,mat,parent,x=0,y=0,z=0){const m=mesh(box,mat,parent,x,y,z);m.scale.set(w,h,d);return m;}
 function curve(points,radius,mat,parent){return mesh(keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),30,radius,8,false)),mat,parent);}
 function makeTheme(item,index){
  const outer=new THREE.Group(),body=new THREE.Group();outer.add(body);outer.userData.id=item.id;outer.userData.item=item;outer.userData.body=body;outer.userData.index=index;rig.add(outer);pickables.push(outer);
  if(item.id==='care'){
   const heart=solid(heartShape(.92),.24,red,body,0,.25,.04,.10);heart.rotation.z=-.08;
   const left=solid(rounded(.95,.33,.15),.30,pearl,body,-.56,-.68,-.02,.075);left.rotation.z=-.35;
   const right=solid(rounded(.95,.33,.15),.30,pearl,body,.56,-.68,-.02,.075);right.rotation.z=.35;
   curve([[-.95,-.6,0],[-.78,-.94,.12],[-.34,-1.05,.16],[0,-.91,.18]],.10,pearl,body);
   curve([[.95,-.6,0],[.78,-.94,.12],[.34,-1.05,.16],[0,-.91,.18]],.10,pearl,body);
  }else if(item.id==='benefits'){
   solid(rounded(1.7,1.25,.18),.72,pearl,body,0,-.2,-.38,.07);solid(rounded(1.86,.32,.12),.84,blue,body,0,.54,-.43,.065);
   block(.19,1.55,.80,gold,body,0,-.1,.02);block(1.86,.16,.91,gold,body,0,.55,-.05);
   const bow=keep(new THREE.TorusGeometry(.30,.075,9,32));const a=mesh(bow,gold,body,-.24,.97,.02);a.scale.y=.65;a.rotation.z=-.45;const b=mesh(bow,gold,body,.24,.97,.02);b.scale.y=.65;b.rotation.z=.45;ball(.10,gold,body,0,.86,.13);
  }else if(item.id==='search'){
   const back=solid(rounded(1.50,1.94,.14),.10,blue,body,-.22,.05,-.26,.045);back.rotation.z=.13;
   solid(rounded(1.52,1.98,.14),.12,pearl,body,0,0,-.08,.045);
   for(let j=0;j<4;j++)block(j===3?.65:.99,.055,.025,ink,body,-.1,.58-j*.25,.105);
   const magnifier=new THREE.Group();magnifier.position.set(.62,-.38,.35);magnifier.rotation.z=-.45;body.add(magnifier);
   mesh(keep(new THREE.TorusGeometry(.47,.085,12,42)),silver,magnifier);const glass=keep(new THREE.MeshPhysicalMaterial({color:0xa4d4ed,metalness:.15,roughness:.1,transparent:true,opacity:.25,depthWrite:false,clearcoat:1}));mesh(keep(new THREE.CircleGeometry(.39,40)),glass,magnifier);
   const handle=mesh(cylinder,ink,magnifier,0,-.79,0);handle.scale.set(.095,.64,.095);
  }else if(item.id==='pilot'){
   const sheet=solid(rounded(1.72,1.55,.16),.12,pearl,body,-.07,-.15,-.15,.05);sheet.rotation.z=-.12;
   for(let j=0;j<3;j++){const line=block(.90,.04,.025,blue,body,-.20,.20-j*.25,.025);line.rotation.z=-.12;}
   const pencil=new THREE.Group();pencil.position.set(.43,.15,.37);pencil.rotation.z=-.58;body.add(pencil);
   const barrel=mesh(keep(new THREE.CylinderGeometry(.12,.12,1.88,6)),violet,pencil);const tip=mesh(keep(new THREE.ConeGeometry(.12,.35,6)),gold,pencil,0,-1.10,0);tip.rotation.z=Math.PI;
   const eraser=mesh(cylinder,red,pencil,0,1.01,0);eraser.scale.set(.12,.17,.12);
   ball(.12,blue,body,-.97,.88,.03);ball(.10,gold,body,-.68,1.03,0);
  }else if(item.id==='messages'){
   const card=solid(rounded(1.55,1.30,.10),.06,blue,body,0,.30,-.12,.035);card.rotation.z=.11;
   solid(rounded(1.98,1.25,.14),.22,pearl,body,0,-.25,-.04,.06);
   const flap=new THREE.Shape();flap.moveTo(-.97,.35);flap.lineTo(0,-.27);flap.lineTo(.97,.35);flap.lineTo(.97,.46);flap.lineTo(-.97,.46);flap.closePath();solid(flap,.035,pearl,body,0,0,.23,.02);
   curve([[-.88,-.78,.245],[0,-.19,.255],[.88,-.78,.245]],.014,silver,body);
   solid(heartShape(.20),.04,red,body,0,-.26,.29,.025);
  }else{
   ball(.43,pearl,body,0,.48,0);
   const shoulders=solid(rounded(1.43,.83,.38),.48,blue,body,0,-.60,-.16,.09);shoulders.rotation.x=.05;
   const band=[];for(let i=0;i<=24;i++){const a=Math.PI*i/24;band.push([Math.cos(a)*.72,.40+Math.sin(a)*.77,-.04]);}curve(band,.095,silver,body);
   for(const x of [-.69,.69]){const ear=mesh(sphere,ink,body,x,.37,.02);ear.scale.set(.15,.31,.24);}
   curve([[.72,.25,.14],[.76,-.03,.3],[.45,-.14,.54],[.18,-.12,.57]],.041,silver,body);ball(.075,ink,body,.16,-.12,.57);
  }
  body.rotation.set(.04,-.14,.02);nodes.push(outer);return outer;
 }
 ITEMS.forEach(makeTheme);
 const core=new THREE.Group();core.userData.id='root';rig.add(core);pickables.push(core);ball(.47,silver,core);
 const coreRings=[];for(let i=0;i<3;i++){const r=mesh(keep(new THREE.TorusGeometry(.85,.035,10,64)),silver,core);r.rotation.set(.3+i*.71,i*.72,i*.31);coreRings.push(r);}
 const coreLabel=document.createElement('div');coreLabel.className='orbit-core-label';coreLabel.innerHTML='<b>民策通</b><small>从您的生活出发</small>';view.querySelector('.orbit-labels').append(coreLabel);
 GROUPS.forEach((g,i)=>{const h=new THREE.Group();h.userData.group=g.id;rig.add(h);ball(.085,keep(new THREE.MeshStandardMaterial({color:g.color,metalness:.7,roughness:.25,emissive:g.color,emissiveIntensity:.25})),h);hubs.push(h);});
 const railPositions=new Float32Array(128*3),railGeometry=keep(new THREE.BufferGeometry());railGeometry.setAttribute('position',new THREE.BufferAttribute(railPositions,3));const rail=new THREE.LineLoop(railGeometry,keep(new THREE.LineBasicMaterial({color:0x5d7892,transparent:true,opacity:.14})));rail.frustumCulled=false;rig.add(rail);
 const particleGeometry=keep(new THREE.SphereGeometry(.045,10,8));
 for(let i=0;i<9;i++){const g=GROUPS[Math.floor(i/3)],geometry=keep(new THREE.BufferGeometry());geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(26*3),3));const material=keep(new THREE.LineBasicMaterial({color:g.color,transparent:true,opacity:.28}));const line=new THREE.Line(geometry,material);line.frustumCulled=false;rig.add(line);const dot=mesh(particleGeometry,keep(new THREE.MeshBasicMaterial({color:g.color})),rig);wires.push({line,dot,group:g.id,index:i%3,groupIndex:Math.floor(i/3)});}
 const labels=view.querySelector('.orbit-labels');
 ITEMS.forEach((item,i)=>{const b=document.createElement('button');b.className='orbit-label';b.dataset.orbitId=item.id;b.innerHTML=`<strong>${item.title}</strong><small>${GROUPS.find(g=>g.id===item.group).title}</small>`;b.setAttribute('aria-label',item.title+'：'+item.note);labels.append(b);nodes[i].userData.label=b;});
 const shortcuts=document.createElement('nav');shortcuts.className='orbit-shortcuts';shortcuts.setAttribute('aria-label','全部服务入口');shortcuts.innerHTML=ITEMS.map((item,i)=>`<button data-orbit-id="${item.id}" data-n="0${i+1}">${item.title}</button>`).join('');stage.append(shortcuts);
 function inspect(id){const item=ITEMS.find(v=>v.id===id);view.querySelector('.orbit-inspector').classList.toggle('is-active',!!item);view.querySelector('.orbit-inspector strong').textContent=item?.title||'您可以先看看';view.querySelector('.orbit-inspector small').textContent=item?.note||'停在一项服务上，查看它能提供哪些帮助。';shortcuts.querySelectorAll('button').forEach(b=>b.classList.toggle('is-active',b.dataset.orbitId===id));}
 function activate(id){if(id==='root'){reset();return;}const item=ITEMS.find(v=>v.id===id);if(!item)return;if(mobile&&group!==item.group)chooseGroup(item.group);selected=id;speed=0;inspect(id);host.querySelector('#node-'+id)?.click();dirty=true;}
 for(const element of [labels,shortcuts]){
  element.addEventListener('click',e=>{const b=e.target.closest('[data-orbit-id]');if(b)activate(b.dataset.orbitId);},{signal});
  element.addEventListener('pointerover',e=>{const b=e.target.closest('[data-orbit-id]');if(b){hovered=b.dataset.orbitId;inspect(hovered);dirty=true;}},{signal});
  element.addEventListener('pointerleave',()=>{hovered='';if(!focused)inspect('');dirty=true;},{signal});
  element.addEventListener('focusin',e=>{const b=e.target.closest('[data-orbit-id]');if(b){focused=b.dataset.orbitId;speed=0;inspect(focused);dirty=true;}},{signal});
  element.addEventListener('focusout',()=>{focused='';dirty=true;},{signal});
 }
 function chooseGroup(value){group=mobile&&value==='all'?'living':value;hovered=focused='';selected='';inspect('');layout();dirty=true;}
 view.querySelectorAll('[data-orbit-group]').forEach(b=>b.onclick=()=>chooseGroup(b.dataset.orbitGroup));
 function layout(){nodes.forEach(n=>{n.visible=!mobile||n.userData.item.group===group;n.userData.label.hidden=!n.visible;});hubs.forEach(h=>h.visible=!mobile||h.userData.group===group);view.querySelectorAll('[data-orbit-group]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.orbitGroup===group)));for(let i=0;i<128;i++){const a=i/128*TAU;railPositions[i*3]=Math.cos(a)*(mobile?2.65:7.7);railPositions[i*3+1]=-.55;railPositions[i*3+2]=Math.sin(a)*(mobile?2.65:5.0);}railGeometry.attributes.position.needsUpdate=true;fit();}
 function fit(){const h=mobile?8.8:10.8,w=mobile?8.1:20.0;baseDistance=Math.max(h/2,w/(2*camera.aspect))/Math.tan(THREE.MathUtils.degToRad(camera.fov/2));baseDistance*=1.06;look.set(0,-.10,0);dirty=true;}
 function resize(){const r=view.getBoundingClientRect(),wasMobile=mobile;mobile=r.width<650;if(mobile&&group==='all')group='living';camera.aspect=r.width/Math.max(1,r.height);camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.25,Math.sqrt(750000/Math.max(1,r.width*r.height))));renderer.setSize(r.width,r.height,false);if(wasMobile!==mobile||!railGeometry.attributes.position.version)layout();else fit();dirty=true;}
 const observer=new ResizeObserver(resize);observer.observe(view);
 function hit(e){const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);const h=raycaster.intersectObjects(pickables.filter(o=>o.visible),true)[0];if(!h)return '';let o=h.object;while(o&&!o.userData.id)o=o.parent;return o?.userData.id||'';}
 canvas.addEventListener('pointerdown',e=>{if(e.button>0)return;e.preventDefault();e.stopPropagation();canvas.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,moved:0};speed=0;},{signal});
 canvas.addEventListener('pointermove',e=>{if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;drag.moved+=Math.abs(dx)+Math.abs(dy);phase+=dx*.006;targetPitch=clamp(targetPitch+dy*.003,.28,.82);pitch=targetPitch;canvas.classList.add('is-dragging');dirty=true;return;}hovered=hit(e);canvas.classList.toggle('is-picking',!!hovered);inspect(hovered||focused);dirty=true;},{signal});
 canvas.addEventListener('pointerup',e=>{if(!drag)return;const click=drag.moved<7;drag=null;manualUntil=performance.now()+1600;canvas.classList.remove('is-dragging');if(click)activate(hit(e));dirty=true;},{signal});
 canvas.addEventListener('pointercancel',()=>{drag=null;canvas.classList.remove('is-dragging');dirty=true;},{signal});
 canvas.addEventListener('pointerleave',()=>{if(!drag){hovered='';canvas.classList.remove('is-picking');inspect(focused);dirty=true;}},{signal});
 canvas.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();phase+=(e.key==='ArrowLeft'?-.16:.16);manualUntil=performance.now()+1600;dirty=true;}if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();targetPitch=clamp(targetPitch+(e.key==='ArrowUp'?-.07:.07),.28,.82);manualUntil=performance.now()+1600;dirty=true;}if(e.key==='Home'){e.preventDefault();reset();}},{signal});
 function reset(){phase=0;speed=BASE_RATE;targetYaw=.04;targetPitch=.55;hovered=focused=selected='';manualUntil=0;group=mobile?'living':'all';inspect('');layout();}
 const old=stage.querySelector('.tree-world');old.setAttribute('aria-hidden','true');old.querySelectorAll('button,a').forEach(b=>b.tabIndex=-1);stage.classList.add('orbit-ready');host.classList.add('orbit-active');
 host.querySelector('#treeTitle').innerHTML='您想先了解<span>哪项服务？</span>';host.querySelector('.tree-eyebrow').innerHTML='<i></i> 民策通 / 身边的服务';host.querySelector('.tree-intro p').textContent='服务选项会缓慢环绕，停在一项上即可查看。';host.querySelector('.tree-intro-aside>span').textContent='公共服务 · 与您相连';host.querySelector('.tree-intro-aside p').innerHTML='按自己的节奏了解<br>选择后展开服务';host.querySelector('.tree-drag-hint').textContent='自动环绕 · 悬停查看 · 点击选择';const previous=host.querySelector('.tree-footer a');previous.href='/atelier/user.html';previous.firstChild.textContent='查看树状版 ';
 const projected=new THREE.Vector3(),hubStart=new THREE.Vector3(),from=new THREE.Vector3(),to=new THREE.Vector3();
 function labelPosition(element,world,offset,width,height){
  if(element===coreLabel){projected.copy(world).add(new THREE.Vector3(0,offset,0)).project(camera);element.style.transform=`translate3d(${((projected.x+1)*width/2).toFixed(2)}px,${((1-projected.y)*height/2).toFixed(2)}px,0) translateX(-50%)`;return;}
  if(mobile){projected.copy(world).add(new THREE.Vector3(0,-1.42,0)).project(camera);const x=clamp((projected.x+1)*width/2,element.offsetWidth/2+7,width-element.offsetWidth/2-7),y=clamp((1-projected.y)*height/2,48,height-element.offsetHeight-4);element.style.transform=`translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) translateX(-50%)`;return;}
  projected.copy(world).project(camera);const depth=projected.z,px=(projected.x+1)*width/2,py=(1-projected.y)*height/2;
  const center=new THREE.Vector3().copy(core.position).project(camera),cx=(center.x+1)*width/2,cy=(1-center.y)*height/2;
  let dx=px-cx,dy=py-cy;const length=Math.max(1,Math.hypot(dx,dy));dx/=length;dy/=length;
  const pad=85+Math.hypot(dx*element.offsetWidth/2,dy*element.offsetHeight/2);
  const x=clamp(px+dx*pad,element.offsetWidth/2+7,width-element.offsetWidth/2-7),y=clamp(py+dy*pad-element.offsetHeight/2,48,height-element.offsetHeight+22);
  element.style.transform=`translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) translateX(-50%)`;element.style.zIndex=String(Math.round((1-depth)*10000));
 }
 function updateWire(w){const hub=hubs[w.groupIndex];w.line.visible=w.dot.visible=hub.visible;if(!hub.visible)return;from.copy(w.index===0?core.position:hub.position);to.copy(w.index===0?hub.position:nodes[w.groupIndex*2+w.index-1].position);from.y-=.20;to.y-=.23;const data=w.line.geometry.attributes.position.array,dx=to.x-from.x,dz=to.z-from.z;let dotT=(time*.10+w.groupIndex*.2+w.index*.28)%1;for(let i=0;i<26;i++){const t=i/25,u=1-t;data[i*3]=u*u*u*from.x+3*u*u*t*(from.x+dx*.40)+3*u*t*t*(to.x-dx*.20)+t*t*t*to.x;data[i*3+1]=from.y+(to.y-from.y)*t-Math.sin(t*Math.PI)*.22;data[i*3+2]=u*u*u*from.z+3*u*u*t*(from.z+dz*.10)+3*u*t*t*(to.z-dz*.45)+t*t*t*to.z;}w.line.geometry.attributes.position.needsUpdate=true;const k=dotT*25,j=Math.min(24,Math.floor(k)),f=k-j;w.dot.position.set(THREE.MathUtils.lerp(data[j*3],data[(j+1)*3],f),THREE.MathUtils.lerp(data[j*3+1],data[(j+1)*3+1],f),THREE.MathUtils.lerp(data[j*3+2],data[(j+1)*3+2],f));w.line.material.opacity=group==='all'||group===w.group?.28:.12;}
 function update(now){if(disposed)return;frame=requestAnimationFrame(update);if(document.hidden){last=now;return;}const dt=Math.min(.04,Math.max(.001,(now-(last||now))/1000));last=now;const still=reduced();if(still&&!dirty)return;if(!still)time+=dt;const stopped=still||opened||!!drag||!!hovered||!!focused||now<manualUntil;speed+=( (stopped?0:BASE_RATE)-speed)*(1-Math.exp(-dt*6));if(!drag&&!still)phase+=speed*dt;
  const ease=still?1:1-Math.exp(-dt*7);yaw+=(targetYaw-yaw)*ease;pitch+=(targetPitch-pitch)*ease;const d=baseDistance*(1+Math.abs(pitch-.55)*.2);camera.position.set(Math.sin(yaw)*d,Math.sin(pitch)*d,Math.cos(yaw)*Math.cos(pitch)*d);camera.lookAt(look);camera.updateMatrixWorld();
  const rect=view.getBoundingClientRect();nodes.forEach((n,i)=>{if(!n.visible)return;const item=n.userData.item,a=phase+(mobile?(i%2?Math.PI:0):(-Math.PI/6+i*TAU/6));n.position.set(Math.cos(a)*(mobile?2.65:7.7),Math.sin(a*2)* (mobile?.18:.40),Math.sin(a)*(mobile?2.65:5.0));n.lookAt(camera.position);const body=n.userData.body,active=item.id===hovered||item.id===focused||item.id===selected;body.position.y=still?0:Math.sin(time*.8+i)*.07;body.rotation.set(.06+(still?0:Math.sin(time*.35+i)*.06),-.13+(still?0:Math.sin(time*.25+i*.7)*.16),Math.sin(i)*.06);const scale=(mobile?.85:1)*(active?1.10:1);n.scale.lerp(new THREE.Vector3(scale,scale,scale),ease);const label=n.userData.label;label.classList.toggle('is-muted',group!=='all'&&item.group!==group);labelPosition(label,n.position,-1.31,rect.width,rect.height);label.style.opacity=active?'1':'.90';});
  hubs.forEach((h,i)=>{const a=phase+(mobile?Math.PI/2:(-Math.PI/6+(i*2+.5)*TAU/6));h.position.set(Math.cos(a)*(mobile?.85:3.05),-.12,Math.sin(a)*(mobile?.85:2.05));});wires.forEach(updateWire);coreRings.forEach((r,i)=>{if(!still)r.rotation.y+=dt*(.12+i*.025);});labelPosition(coreLabel,core.position,-1.03,rect.width,rect.height);
  const status=still?'已暂停环绕':drag?'正在调整视角':opened?'正在查看服务':hovered||focused?'停留查看':now<manualUntil?'稍后继续环绕':'正在缓慢环绕';if(status!==stateText){view.querySelector('.orbit-state').textContent=status;stateText=status;}renderer.render(scene,camera);dirty=false;
 }
 resize();frame=requestAnimationFrame(update);
 const api={host,reset,refresh(){dirty=true;},step(value){opened=value!==0;if(!opened){selected='';inspect(focused||hovered);}dirty=true;},burst(){dirty=true;},getBounds(id){const n=nodes.find(n=>n.userData.id===id);if(!n?.visible)return null;scene.updateMatrixWorld();camera.updateMatrixWorld();const b=new THREE.Box3().setFromObject(n),r=canvas.getBoundingClientRect();let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){projected.set(x,y,z).project(camera);const sx=r.left+(projected.x+1)*r.width/2,sy=r.top+(1-projected.y)*r.height/2;x0=Math.min(x0,sx);x1=Math.max(x1,sx);y0=Math.min(y0,sy);y1=Math.max(y1,sy);}return {left:x0,top:y0,width:x1-x0,height:y1-y0};},destroy(){if(disposed)return;disposed=true;abort.abort();observer.disconnect();cancelAnimationFrame(frame);stage.classList.remove('orbit-ready');host.classList.remove('orbit-active');old.removeAttribute('aria-hidden');old.querySelectorAll('button,a').forEach(b=>b.removeAttribute('tabindex'));view.remove();shortcuts.remove();for(const r of resources)r.dispose?.();renderer.dispose();if(activeEngine===api)activeEngine=null;}};activeEngine=api;return api;
}
window.MincetongOrbit={create};window.dispatchEvent(new Event('mincetong-orbit-ready'));
