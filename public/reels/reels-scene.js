import * as THREE from './vendor/three.module.js';

const ITEMS=[
 {id:'care',group:'living',title:'养老与关怀',note:'照护、助餐与日常支持',color:0xc4d8e8,light:true,p:[1.7,3.9,-.8],r:[-.12,-.18,-.13]},
 {id:'benefits',group:'living',title:'补贴与待遇',note:'查看事项，逐项确认条件',color:0xd7c6a8,light:false,p:[6.0,3.1,.55],r:[.05,.18,-.17]},
 {id:'search',group:'policy',title:'查找政策',note:'官方原文与适用条件',color:0xb9b5df,light:false,p:[1.7,.65,1.0],r:[.1,-.15,.13]},
 {id:'pilot',group:'policy',title:'参与政策共创',note:'分享经验，自愿参与',color:0xc4c1df,light:true,p:[6.4,-.8,-.45],r:[-.1,.16,-.1]},
 {id:'messages',group:'message',title:'我的服务消息',note:'查看提醒与服务进展',color:0xd6c6a8,light:true,p:[1.2,-2.6,.9],r:[.13,.12,.10]},
 {id:'human',group:'message',title:'找人帮一把',note:'了解人工协助方式',color:0xbcd4d5,light:false,p:[6.1,-4.1,.1],r:[-.1,-.14,-.13]}
];
const BRANCHES=[{id:'living',title:'生活服务',p:[-2.4,3.0,0],color:0xb7d1e5},{id:'policy',title:'政策与共创',p:[-1.8,0,.25],color:0xbab8d9},{id:'message',title:'与您有关',p:[-2.5,-3,.1],color:0xd8c6a7}];
let activeEngine;
const clamp=THREE.MathUtils.clamp;

function roundedShape(w,h,r){
 const s=new THREE.Shape(),x=-w/2,y=-h/2;
 s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;
}
function create(host,{reduced}){
 if(!host||activeEngine?.host===host)return activeEngine;
 activeEngine?.destroy();
 const stage=host.querySelector('.tree-stage');if(!stage)return null;
 const abort=new AbortController(),signal=abort.signal,resources=new Set(),modelGroups=[],picks=[],wires=[],reels=[];
 let disposed=false,frame=0,elapsed=0,last=0,mobile=false,activeGroup='all',hovered='',selected='',drag=null,dirty=true,mode=0;
 let yaw=-.24,pitch=.30,targetYaw=-.24,targetPitch=.30,velocityX=0,velocityY=0,zoom=1,targetZoom=1,baseDistance=24;
 const keep=r=>{resources.add(r);return r;};
 const view=document.createElement('div');view.className='reels-view';
 view.innerHTML='<div class="reels-backdrop" aria-hidden="true"></div><div class="reels-label" aria-hidden="true"><b>MINCETONG / SERVICE COLLECTION</b>生活中的每一件事，都值得被认真对待</div><div class="reels-groups" role="group" aria-label="选择服务分支"><button data-reel-group="all" aria-pressed="true">全景</button><button data-reel-group="living" aria-pressed="false">生活服务</button><button data-reel-group="policy" aria-pressed="false">政策与共创</button><button data-reel-group="message" aria-pressed="false">与您有关</button></div><div class="reels-inspector"><strong>从一个需要开始</strong><small>转动视角，选择一盘属于您的服务。</small></div><span class="reels-index" aria-hidden="true">01 — 06 / 与您相连</span>';
 const canvas=document.createElement('canvas');canvas.className='reels-canvas';canvas.tabIndex=0;canvas.setAttribute('aria-label','三维服务树，可拖动转动视角，也可使用方向键；下方提供全部服务入口');view.prepend(canvas);stage.append(view);
 let renderer;
 try{renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});}catch(error){view.remove();console.warn('3D service tree unavailable; retaining accessible tree navigation.');return null;}
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
 const scene=new THREE.Scene(),rig=new THREE.Group();scene.add(rig);
 const camera=new THREE.PerspectiveCamera(35,1,.1,120),look=new THREE.Vector3(.3,0,0),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
 const envCanvas=document.createElement('canvas');envCanvas.width=1024;envCanvas.height=512;const ec=envCanvas.getContext('2d');
 ec.fillStyle='#151a22';ec.fillRect(0,0,1024,512);
 for(const [x,y,w,h,alpha]of [[110,40,110,330,.95],[620,95,230,115,.85],[420,340,260,60,.6],[910,60,32,300,.6]]){
  const g=ec.createLinearGradient(x,0,x+w,0);g.addColorStop(0,'rgba(240,247,255,0)');g.addColorStop(.25,`rgba(240,247,255,${alpha})`);g.addColorStop(.75,`rgba(255,251,235,${alpha})`);g.addColorStop(1,'rgba(240,247,255,0)');ec.fillStyle=g;ec.fillRect(x,y,w,h);
 }
 const env=keep(new THREE.CanvasTexture(envCanvas));env.mapping=THREE.EquirectangularReflectionMapping;env.colorSpace=THREE.SRGBColorSpace;
 const pmrem=new THREE.PMREMGenerator(renderer);const envTarget=pmrem.fromEquirectangular(env);scene.environment=envTarget.texture;pmrem.dispose();resources.add(envTarget);
 scene.add(new THREE.HemisphereLight(0xd9e8ff,0x25202a,2.2));
 const key=new THREE.DirectionalLight(0xfff4df,4.2);key.position.set(-7,10,14);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-16,right:16,top:13,bottom:-13,near:1,far:40});key.shadow.bias=-.0007;key.shadow.normalBias=.035;scene.add(key);
 const fill=new THREE.DirectionalLight(0xb5d2ff,3.2);fill.position.set(10,2,7);scene.add(fill);
 const rim=new THREE.DirectionalLight(0xffffff,3.0);rim.position.set(-2,-8,8);scene.add(rim);
 const shadow=new THREE.Mesh(keep(new THREE.PlaneGeometry(50,35)),keep(new THREE.ShadowMaterial({opacity:.13})));shadow.position.z=-1.6;shadow.receiveShadow=true;scene.add(shadow);
 const metal=keep(new THREE.MeshStandardMaterial({color:0xb7bdc6,metalness:.94,roughness:.19}));
 const darkMetal=keep(new THREE.MeshStandardMaterial({color:0x131820,metalness:.83,roughness:.28}));
 const tapeMat=keep(new THREE.MeshStandardMaterial({color:0x1c1717,metalness:.22,roughness:.67}));
 const screwGeo=keep(new THREE.CylinderGeometry(.067,.067,.03,12)),slotGeo=keep(new THREE.BoxGeometry(.085,.011,.012));
 const spoolGeo=keep(new THREE.CylinderGeometry(.42,.42,.08,32)),hubGeo=keep(new THREE.CylinderGeometry(.17,.17,.105,12)),ringGeo=keep(new THREE.TorusGeometry(.43,.027,8,40)),spokeGeo=keep(new THREE.BoxGeometry(.075,.55,.035));
 function mesh(geo,mat,parent,x=0,y=0,z=0){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 function label(text,sub,light,w=3.2,h=.48){
  const c=document.createElement('canvas');c.width=1024;c.height=160;const ctx=c.getContext('2d');ctx.fillStyle=light?'#dfe3e3':'#13181e';ctx.fillRect(0,0,1024,160);
  ctx.fillStyle=light?'#26303c':'#eef0ee';ctx.font='500 92px "Microsoft YaHei",sans-serif';ctx.textBaseline='middle';ctx.fillText(text,30,75,950);
  ctx.font='18px Consolas,monospace';ctx.fillStyle=light?'#5b6772':'#93a3b3';ctx.fillText(sub,33,140);
  const texture=keep(new THREE.CanvasTexture(c));texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
  return new THREE.Mesh(keep(new THREE.PlaneGeometry(w,h)),keep(new THREE.MeshBasicMaterial({map:texture,toneMapped:false})));
 }
 function cassette(item,index){
  const outer=new THREE.Group(),body=new THREE.Group();outer.add(body);outer.userData.id=item.id;outer.userData.item=item;outer.userData.body=body;outer.userData.index=index;
  const casing=keep(new THREE.MeshPhysicalMaterial({color:item.light?0xaeb8c1:0x19212a,metalness:item.light?.78:.88,roughness:item.light?.21:.2,clearcoat:1,clearcoatRoughness:.16}));
  const backGeo=keep(new THREE.ExtrudeGeometry(roundedShape(3.65,2.26,.24),{depth:.26,steps:1,bevelEnabled:true,bevelSize:.065,bevelThickness:.05,bevelSegments:3,curveSegments:14}));
  mesh(backGeo,casing,body,0,0,-.2);
  const face=roundedShape(3.53,2.14,.19);
  for(const x of [-.82,.82]){const hole=new THREE.Path();hole.absellipse(x,-.10,.50,.50,0,Math.PI*2,true);face.holes.push(hole);}
  mesh(keep(new THREE.ExtrudeGeometry(face,{depth:.055,steps:1,bevelEnabled:true,bevelSize:.025,bevelThickness:.018,bevelSegments:2,curveSegments:16})),casing,body,0,0,.1);
  const glass=keep(new THREE.MeshPhysicalMaterial({color:item.light?0xe1edf3:0x6c8294,metalness:.3,roughness:.15,transparent:true,opacity:.16,depthWrite:false,clearcoat:1}));
  mesh(keep(new THREE.PlaneGeometry(2.8,1.18)),glass,body,0,-.10,.205);
  for(const [side,x]of [[0,-.82],[1,.82]]){
   const rotating=new THREE.Group();rotating.position.set(x,-.1,.12);body.add(rotating);reels.push({group:rotating,speed:(side?1:-1)*(.23+index*.012),id:item.id});
   const tape=mesh(spoolGeo,tapeMat,rotating);tape.rotation.x=Math.PI/2;tape.scale.setScalar(side?.94:1.02);
   const hub=mesh(hubGeo,metal,rotating,0,0,.07);hub.rotation.x=Math.PI/2;
   mesh(ringGeo,metal,rotating,0,0,.09);
   for(let k=0;k<3;k++){const s=mesh(spokeGeo,item.light?metal:metal,rotating,0,0,.09);s.rotation.z=k*Math.PI/3;}
   const center=mesh(keep(new THREE.CylinderGeometry(.075,.075,.12,8)),darkMetal,rotating,0,0,.09);center.rotation.x=Math.PI/2;
  }
  for(const x of [-1.54,1.54])for(const y of [-.86,.86]){const screw=mesh(screwGeo,metal,body,x,y,.205);screw.rotation.x=Math.PI/2;const slot=mesh(slotGeo,darkMetal,body,x,y,.225);slot.rotation.z=(index+x)*.3;}
  const title=label(item.title,`MINCETONG / ${String(index+1).padStart(2,'0')} / SERVICE`,item.light);title.position.set(0,.80,.22);body.add(title);
  const bottom=label('由您选择  ·  按需了解','PUBLIC SERVICES / KEEP IN TOUCH',!item.light,2.55,.24);bottom.position.set(0,-.89,.22);body.add(bottom);
  const notch=mesh(keep(new THREE.BoxGeometry(1.4,.18,.17)),darkMetal,body,0,-1.03,.12);
  for(const x of [-.55,0,.55]){const pin=mesh(keep(new THREE.CylinderGeometry(.045,.045,.19,10)),metal,body,x,-1.03,.17);pin.rotation.x=Math.PI/2;}
  const port=mesh(keep(new THREE.SphereGeometry(.075,12,8)),keep(new THREE.MeshStandardMaterial({color:item.color,metalness:.7,roughness:.22,emissive:item.color,emissiveIntensity:.2})),outer,-1.9,0,-.05);
  outer.userData.port=port;outer.userData.casing=casing;
  outer.position.fromArray(item.p);body.rotation.set(...item.r);rig.add(outer);modelGroups.push(outer);picks.push(outer);return outer;
 }
 const rootItem={id:'root',group:'root',title:'民策通',note:'服务从您的生活出发',color:0xd9e3e8,light:true,p:[-6.5,-.35,-.1],r:[-.08,.18,.08]};
 const root=cassette(rootItem,-1);root.scale.setScalar(1.02);
 const leaves=ITEMS.map(cassette);
 const hubs=BRANCHES.map((b,i)=>{
  const g=new THREE.Group();g.position.fromArray(b.p);g.userData.id=b.id;g.userData.branch=true;rig.add(g);picks.push(g);
  mesh(keep(new THREE.ExtrudeGeometry(roundedShape(2.35,.69,.16),{depth:.19,bevelEnabled:true,bevelThickness:.035,bevelSize:.035,bevelSegments:2,curveSegments:12})),darkMetal,g,0,0,-.08);
  const text=label(b.title,`BRANCH / 0${i+1}`,false,2.04,.43);text.position.z=.18;g.add(text);
  mesh(keep(new THREE.SphereGeometry(.062,12,8)),keep(new THREE.MeshStandardMaterial({color:b.color,emissive:b.color,emissiveIntensity:.8})),g,-1.18,0,.03);
  g.userData.info=b;return g;
 });
 const wireMaterial=keep(new THREE.MeshStandardMaterial({color:0x647588,metalness:.74,roughness:.38,transparent:true,opacity:.7}));
 function addWire(a,b,group){
  const a1=a.clone(),b1=b.clone(),c1=a.clone(),c2=b.clone();const bend=Math.max(.6,(b.x-a.x)*.45);c1.x+=bend;c2.x-=bend;c1.z-=.2;c2.z-=.2;
  const curve=new THREE.CubicBezierCurve3(a1,c1,c2,b1),geometry=keep(new THREE.TubeGeometry(curve,35,.018,5,false));
  const tube=new THREE.Mesh(geometry,keep(wireMaterial.clone()));rig.add(tube);
  const particle=mesh(keep(new THREE.SphereGeometry(.047,10,7)),keep(new THREE.MeshBasicMaterial({color:BRANCHES.find(v=>v.id===group).color})),rig);
  wires.push({curve,tube,particle,group,offset:wires.length*.13});
 }
 function rebuildWires(){
  for(const w of wires){rig.remove(w.tube,w.particle);for(const r of [w.tube.geometry,w.tube.material,w.particle.geometry,w.particle.material]){r.dispose();resources.delete(r);}}wires.length=0;
  for(const [i,b]of BRANCHES.entries()){
   if(mobile&&b.id!==activeGroup)continue;
   const hub=hubs[i];addWire(root.position.clone().add(new THREE.Vector3(1.8,0,-.08)),hub.position.clone().add(new THREE.Vector3(-1.2,0,0)),b.id);
   for(const leaf of leaves.filter(g=>g.userData.item.group===b.id))addWire(hub.position.clone().add(new THREE.Vector3(1.2,0,0)),leaf.position.clone().add(new THREE.Vector3(-1.9*(mobile?.88:1),0,-.05)),b.id);
  }
 }
 const shortcuts=document.createElement('nav');shortcuts.className='reels-shortcuts';shortcuts.setAttribute('aria-label','服务快捷入口');
 shortcuts.innerHTML=ITEMS.map((item,i)=>`<button data-reel-id="${item.id}" data-n="0${i+1}">${item.title}</button>`).join('');stage.append(shortcuts);
 function inspect(id){
  const item=ITEMS.find(v=>v.id===id);view.querySelector('.reels-inspector strong').textContent=item?.title||'从一个需要开始';view.querySelector('.reels-inspector small').textContent=item?.note||'转动视角，选择一盘属于您的服务。';
  shortcuts.querySelectorAll('button').forEach(b=>b.classList.toggle('is-active',b.dataset.reelId===id));
 }
 function activate(id){
  if(id==='root'){reset();return;}if(BRANCHES.some(v=>v.id===id)){chooseGroup(id);return;}
  const item=ITEMS.find(v=>v.id===id);if(!item)return;
  if(mobile&&activeGroup!==item.group)chooseGroup(item.group);
  selected=id;inspect(id);host.querySelector(`#node-${id}`)?.click();dirty=true;
 }
 shortcuts.addEventListener('click',event=>{const b=event.target.closest('[data-reel-id]');if(b)activate(b.dataset.reelId);},{signal});
 shortcuts.addEventListener('focusin',event=>{const id=event.target.dataset.reelId;if(id){inspect(id);hovered=id;dirty=true;}},{signal});
 function chooseGroup(group){activeGroup=group==='all'&&mobile?'living':group;layout();inspect('');dirty=true;}
 view.querySelectorAll('[data-reel-group]').forEach(b=>b.onclick=()=>chooseGroup(b.dataset.reelGroup));
 function layout(){
  root.position.set(...(mobile?[-1.1,2.5,-.4]:rootItem.p));root.scale.setScalar(mobile?.78:1.02);
  hubs.forEach((g,i)=>{g.visible=!mobile||BRANCHES[i].id===activeGroup;g.position.set(...(mobile?[1.15,.95,.1]:BRANCHES[i].p));g.scale.setScalar(mobile?.72:1);});
  leaves.forEach((g,i)=>{g.visible=!mobile||ITEMS[i].group===activeGroup;g.scale.setScalar(mobile?.88:1);g.position.set(...(mobile?(i%2?[1.0,-3.4,.05]:[-1.0,-.50,.5]):ITEMS[i].p));});
  view.querySelectorAll('[data-reel-group]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.reelGroup===activeGroup)));
  rebuildWires();fit();
 }
 function fit(){
  const height=mobile?9.2:12.0,width=mobile?6.5:21.0;
  baseDistance=Math.max(height/2,width/(2*camera.aspect))/Math.tan(THREE.MathUtils.degToRad(camera.fov/2));baseDistance*=mobile?1.12:1.02;
  look.set(mobile?0:.3,mobile?-.1:0,0);dirty=true;
 }
 function resize(){
  const r=view.getBoundingClientRect(),nextMobile=r.width<650;
  const changed=nextMobile!==mobile;mobile=nextMobile;if(mobile&&activeGroup==='all')activeGroup='living';
  camera.aspect=r.width/Math.max(1,r.height);camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.25,Math.sqrt(850000/Math.max(1,r.width*r.height))));renderer.setSize(r.width,r.height,false);
  if(changed||!wires.length)layout();else fit();dirty=true;
 }
 const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(view);
 function hit(event){const r=canvas.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(picks.filter(v=>v.visible),true)[0];if(!hit)return '';let o=hit.object;while(o&&!o.userData.id)o=o.parent;return o?.userData.id||'';}
 canvas.addEventListener('pointerdown',event=>{if(event.button>0)return;event.preventDefault();event.stopPropagation();canvas.setPointerCapture(event.pointerId);drag={x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,lastAt:event.timeStamp,moved:0};velocityX=velocityY=0;canvas.classList.add('is-dragging');},{signal});
 canvas.addEventListener('pointermove',event=>{
  if(drag){const dx=event.clientX-drag.lastX,dy=event.clientY-drag.lastY,delta=Math.max(.008,(event.timeStamp-drag.lastAt)/1000);drag.moved+=Math.abs(dx)+Math.abs(dy);drag.lastX=event.clientX;drag.lastY=event.clientY;drag.lastAt=event.timeStamp;targetYaw=clamp(targetYaw+dx*.005,-.62,.62);targetPitch=clamp(targetPitch+dy*.004,-.28,.43);yaw=targetYaw;pitch=targetPitch;velocityX=dx*.005/delta*.35;velocityY=dy*.004/delta*.35;dirty=true;return;}
  hovered=hit(event);canvas.classList.toggle('is-picking',!!hovered);inspect(hovered);dirty=true;
 },{signal});
 canvas.addEventListener('pointerup',event=>{if(!drag)return;const clicked=drag.moved<7;drag=null;canvas.classList.remove('is-dragging');if(clicked)activate(hit(event));dirty=true;},{signal});
 canvas.addEventListener('pointercancel',()=>{drag=null;canvas.classList.remove('is-dragging');},{signal});
 canvas.addEventListener('pointerleave',()=>{if(!drag){hovered='';inspect('');canvas.classList.remove('is-picking');dirty=true;}},{signal});
 canvas.addEventListener('keydown',event=>{const dirs={ArrowLeft:[-.1,0],ArrowRight:[.1,0],ArrowUp:[0,-.07],ArrowDown:[0,.07]};if(dirs[event.key]){event.preventDefault();targetYaw=clamp(targetYaw+dirs[event.key][0],-.62,.62);targetPitch=clamp(targetPitch+dirs[event.key][1],-.28,.43);dirty=true;}if(event.key==='Home'){event.preventDefault();reset();}},{signal});
 function reset(){targetYaw=-.24;targetPitch=.30;targetZoom=1;velocityX=velocityY=0;selected=hovered='';activeGroup=mobile?'living':'all';layout();inspect('');}
 const oldWorld=stage.querySelector('.tree-world');oldWorld.setAttribute('aria-hidden','true');oldWorld.querySelectorAll('button,a').forEach(b=>b.tabIndex=-1);
 stage.classList.add('reels-ready');host.classList.add('reels-active');
 const heading=host.querySelector('#treeTitle');if(heading)heading.innerHTML='您想先了解<span>哪项服务？</span>';
 const eyebrow=host.querySelector('.tree-eyebrow');if(eyebrow)eyebrow.innerHTML='<i></i> 民策通 / 立体服务图谱';
 const introNote=host.querySelector('.tree-intro p');if(introNote)introNote.textContent='转动视角，找到您想了解的那一件事。';
 const topAside=host.querySelector('.tree-intro-aside>span');if(topAside)topAside.textContent='A COLLECTION OF EVERYDAY CARE';
 const asideNote=host.querySelector('.tree-intro-aside p');if(asideNote)asideNote.innerHTML='拖动转动视角<br>点击磁带查看服务';
 const hint=host.querySelector('.tree-drag-hint');if(hint)hint.textContent='拖动转动视角 · 点击磁带进入服务';
 const oldLink=host.querySelector('.tree-footer a');if(oldLink){oldLink.href='/atelier/user.html';oldLink.firstChild.textContent='查看上一版 ';}
 function update(now){
  if(disposed)return;frame=requestAnimationFrame(update);if(document.hidden){last=now;return;}
  const dt=Math.min(.04,Math.max(.001,(now-(last||now))/1000));last=now;const still=reduced();if(still&&!dirty)return;
  if(!still)elapsed+=dt;
  if(!drag&&!still){targetYaw=clamp(targetYaw+velocityX*dt,-.62,.62);targetPitch=clamp(targetPitch+velocityY*dt,-.28,.43);velocityX*=Math.exp(-dt*6);velocityY*=Math.exp(-dt*6);}
  const ease=still?1:1-Math.exp(-dt*7);yaw+=(targetYaw-yaw)*ease;pitch+=(targetPitch-pitch)*ease;zoom+=(targetZoom-zoom)*ease;
  const orbitPadding=1+Math.max(0,Math.abs(yaw)-.24)*.45+Math.max(0,pitch-.30)*.5;
  const distance=baseDistance*zoom*orbitPadding;camera.position.set(look.x+Math.sin(yaw)*distance,look.y+Math.sin(pitch)*distance,Math.cos(yaw)*Math.cos(pitch)*distance);camera.lookAt(look);
  modelGroups.forEach((g,i)=>{
   const body=g.userData.body,item=g.userData.item,picked=hovered===item.id||selected===item.id;
   const breathing=still?0:Math.sin(elapsed*.72+i*.8)*.055;
   body.position.y=breathing;body.position.z+=( (picked?.46:0)-body.position.z)*ease;
   body.rotation.x=item.r[0]+.18+(still?0:Math.sin(elapsed*.28+i)*.025);body.rotation.y=item.r[1]+(still?0:Math.sin(elapsed*.23+i*.6)*.035);body.rotation.z=item.r[2];
   const lit=activeGroup==='all'||item.group===activeGroup||item.id==='root';g.userData.casing.emissive.setHex(picked?item.color:0x000000);g.userData.casing.emissiveIntensity=picked?.08:0;g.userData.casing.color.setHex(item.light?0xaeb8c1:lit?0x19212a:0x0c1017);
  });
  if(!still)reels.forEach(r=>{r.group.rotation.z+=dt*r.speed*(hovered===r.id?2.5:1);});
  wires.forEach(w=>{w.particle.position.copy(w.curve.getPoint((elapsed*.095+w.offset)%1));const show=activeGroup==='all'||activeGroup===w.group;w.particle.visible=show;w.tube.material.opacity=show?.68:.25;});
  renderer.render(scene,camera);dirty=false;
 }
 resize();frame=requestAnimationFrame(update);
 const api={host,
  reset,
  refresh(){dirty=true;},
  step(value){mode=value;targetZoom=value===0?1:.96;if(value===0){selected='';inspect('');}dirty=true;},
  burst(){dirty=true;},
  getBounds(id){const group=leaves.find(g=>g.userData.id===id);if(!group?.visible)return null;scene.updateMatrixWorld();camera.updateMatrixWorld();const box=new THREE.Box3().setFromObject(group),r=canvas.getBoundingClientRect();let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const p=new THREE.Vector3(x,y,z).project(camera),sx=r.left+(p.x+1)*r.width/2,sy=r.top+(1-p.y)*r.height/2;x0=Math.min(x0,sx);x1=Math.max(x1,sx);y0=Math.min(y0,sy);y1=Math.max(y1,sy);}return {left:x0,top:y0,width:x1-x0,height:y1-y0};},
  destroy(){if(disposed)return;disposed=true;abort.abort();resizeObserver.disconnect();cancelAnimationFrame(frame);stage.classList.remove('reels-ready');host.classList.remove('reels-active');oldWorld.removeAttribute('aria-hidden');oldWorld.querySelectorAll('button,a').forEach(b=>b.removeAttribute('tabindex'));view.remove();shortcuts.remove();for(const resource of resources)resource.dispose?.();key.shadow.map?.dispose();renderer.dispose();if(activeEngine===api)activeEngine=null;}
 };
 activeEngine=api;return api;
}
window.MincetongReels={create};
window.dispatchEvent(new Event('mincetong-reels-ready'));
