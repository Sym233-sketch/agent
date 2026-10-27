/* Spatial navigation. Resident data and consent remain in the resident controller. */
(() => {
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const glyphs={
    branch:'<path d="M5 4v11a4 4 0 0 0 4 4h10M5 9h9a4 4 0 0 0 4-4V3"/><circle cx="5" cy="3" r="2"/><circle cx="19" cy="19" r="2"/>',
    living:'<path d="m3 11 9-8 9 8M6 9v12h12V9M10 21v-7h4v7"/>',
    policy:'<path d="M7 3h8l4 4v14H5V3h2Zm8 0v5h4M8 12h8m-8 4h6"/>',
    message:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>',
    care:'<path d="M12 20S3 15 3 9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-9 11-9 11Z"/>',
    benefits:'<path d="M4 8h16v12H4V8Zm-1 0h18V5H3v3Zm9-3v15M12 5C5 6 5 0 9 2l3 3Zm0 0c7 1 7-5 3-3l-3 3Z"/>',
    people:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6m4 10v-3a6 6 0 0 0-4-5"/>',
    arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
    back:'<path d="m10 5-7 7 7 7M3 12h18"/>',
    globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/>',
    help:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2M2 8v5m20-5v5"/>',
    pause:'<path d="M8 5v14M16 5v14"/>',
    play:'<path d="m8 4 12 8-12 8V4Z"/>',
    reset:'<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>',
    star:'<path d="m12 2 2.5 6 6.5 1-5 4.5 1.5 6.5L12 17l-5.5 3 1.5-6.5L3 9l6.5-1L12 2Z"/>'
  };
  const icon=(name,cls='')=>`<svg class="tree-icon ${cls}" aria-hidden="true" viewBox="0 0 24 24">${glyphs[name]||glyphs.branch}</svg>`;
  const groups=[
    {id:'living',n:'01',label:'生活服务',note:'从日常需要出发',x:45,y:17,color:'ice',leaves:[
      {id:'care',label:'养老与关怀',note:'照护、助餐与日常支持',icon:'care',view:'services',group:'care',x:80,y:8},
      {id:'benefits',label:'补贴与待遇',note:'查看事项，逐项确认条件',icon:'benefits',view:'desk',group:'',x:80,y:25}]},
    {id:'policy',n:'02',label:'政策与共创',note:'有出处，也听得见您',x:45,y:50,color:'violet',leaves:[
      {id:'search',label:'查找政策',note:'官方原文与适用条件',icon:'policy',view:'search',x:80,y:42},
      {id:'pilot',label:'参与政策共创',note:'分享经验，自愿参与',icon:'people',view:'pilot',x:80,y:59}]},
    {id:'message',n:'03',label:'与您有关',note:'按自己的节奏继续',x:45,y:81,color:'amber',leaves:[
      {id:'messages',label:'我的服务消息',note:'查看提醒与服务进展',icon:'message',view:'messages',x:80,y:76},
      {id:'human',label:'找人帮一把',note:'了解人工协助方式',icon:'help',view:'human',x:80,y:93}]}
  ];
  const titles={hall:'服务空间',desk:'办事服务',search:'查找政策',messages:'我的服务消息',pilot:'政策共创',services:'生活服务'};
  const motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
  let host,scene,sceneShell,abort,navigate,current='',sequence=0,transition,lastLeaf=null,serviceGroup='',paused=motionQuery.matches,selectedGroup='',drag=null,pan={x:0,y:0},pointerFrame=0,rootScrollY=0;
  const reduced=()=>paused||motionQuery.matches;
  const $=selector=>host?.querySelector(selector);
  function leafMarkup(leaf,group){return `<button class="tree-node tree-leaf" id="node-${leaf.id}" data-leaf="${leaf.id}" data-branch="${group.id}" style="--x:${leaf.x}%;--y:${leaf.y}%" aria-label="${leaf.label}：${leaf.note}"><i class="node-joint" aria-hidden="true"></i><span class="node-face"><span class="leaf-glyph">${icon(leaf.icon)}</span><span class="leaf-copy"><strong>${leaf.label}</strong><small>${leaf.note}</small></span><span class="node-enter">${icon('arrow')}</span></span></button>`;}
  function pathMarkup(){return groups.map(g=>{
    const root=`M 250 350 C 294 350 290 ${g.y*7} 335 ${g.y*7}`;
    const leaves=g.leaves.map(l=>`<path class="wire" d="M 605 ${g.y*7} C 637 ${g.y*7} 621 ${l.y*7} 655 ${l.y*7}"/><path class="wire-flow" d="M 605 ${g.y*7} C 637 ${g.y*7} 621 ${l.y*7} 655 ${l.y*7}"/>`).join('');
    return `<g data-wire="${g.id}" class="wire-group color-${g.color}"><path class="wire" d="${root}"/><path class="wire-flow" d="${root}"/><path class="wire" d="M 565 ${g.y*7} H 605"/>${leaves}<circle class="wire-junction" cx="605" cy="${g.y*7}" r="3"/></g>`;
  }).join('');}
  function shell(profile){
    return `<div class="tree-shell"><header class="tree-header"><button class="tree-brand" data-tree-home aria-label="返回服务空间"><span class="tree-logomark">${icon('branch')}</span><span>民策通<small>居民服务</small></span></button><span class="tree-header-caption">公共服务 · 与您相连</span><div class="tree-header-actions"><button class="tree-help" data-tree-human aria-label="人工协助">${icon('help')}<span>人工协助</span></button><button class="tree-profile" data-action="profile" aria-label="打开我的服务档案"><span class="tree-avatar">${esc(profile.name?.slice(0,1)||'您')}</span><span>我的档案</span></button></div></header>
      <main class="tree-main"><section class="tree-intro" aria-labelledby="treeTitle"><div><span class="tree-eyebrow"><i></i> 民策通 / 服务空间</span><h1 id="treeTitle">您需要的，<span>在这里相连。</span></h1><p>从一个需要开始，找到可以走的下一步。</p></div><div class="tree-intro-aside"><span>EXPLORE YOUR SERVICES</span><p>选择一块牌面<br>让服务向您展开 ${icon('arrow')}</p></div></section>
      <section class="tree-stage" aria-label="服务空间"><div class="tree-world"><div class="tree-grid" aria-hidden="true"></div><svg class="tree-wires" viewBox="0 0 1000 700" preserveAspectRatio="none" aria-hidden="true"><defs><filter id="wireGlow" x="-50%" y="-200%" width="200%" height="500%"><feGaussianBlur stdDeviation="2"/></filter></defs>${pathMarkup()}</svg>
      <div class="tree-node tree-root" style="--x:14%;--y:50%"><span class="root-halo" aria-hidden="true"></span><span class="root-kicker">服务由此出发</span><span class="root-mark" aria-hidden="true">${icon('branch')}</span><h2>您的生活<span>是服务的起点</span></h2><p>无需一次办完<br>按自己的节奏来</p><i class="root-joint" aria-hidden="true"></i></div>
      ${groups.map(g=>`<section class="tree-cluster color-${g.color}" data-cluster="${g.id}" aria-label="${g.label}"><button class="tree-node tree-branch" data-group="${g.id}" aria-expanded="true" aria-controls="leaves-${g.id}" style="--x:${g.x}%;--y:${g.y}%"><i class="node-joint" aria-hidden="true"></i><span class="node-face"><span class="branch-number">${g.n}</span><span><strong>${g.label}</strong><small>${g.note}</small></span><span class="branch-toggle" aria-hidden="true">−</span></span></button><div class="tree-leaves" id="leaves-${g.id}">${g.leaves.map(l=>leafMarkup(l,g)).join('')}</div></section>`).join('')}
      </div><div class="tree-map-tools"><span class="tree-drag-hint">拖动空白处探索 · 点击牌面进入</span><button class="tree-reset" data-tree-reset>${icon('reset')}<span>回到全景</span></button><button class="tree-motion" data-tree-motion aria-pressed="${paused}" aria-label="${paused?'开启动效':'暂停动效'}">${icon(paused?'play':'pause')}</button></div></section></main>
      <footer class="tree-footer"><span><i></i> 本地演示 · 非政府官方平台</span><a href="/user.html">查看原版 ${icon('arrow')}</a><span>您的选择，始终由您决定</span></footer>
      <section class="tree-sheet" hidden aria-labelledby="sheetTitle"><header class="tree-sheet-bar"><button class="sheet-back" data-tree-home>${icon('back')}<span>服务空间</span></button><span class="sheet-route">/ <b id="sheetTitle"></b></span><span class="sheet-note">按需了解 · 自主选择</span></header><div id="treeContent" class="tree-content"></div></section><div class="tree-status" role="status" aria-live="polite"></div></div>`;
  }
  function setup(profile){
    host=document.querySelector('#app');abort=new AbortController();const signal=abort.signal;
    document.body.classList.add('tree-active');
    host.innerHTML=shell(profile);
    sceneShell=document.createElement('div');sceneShell.className='tree-scene';sceneShell.setAttribute('aria-hidden','true');
    sceneShell.innerHTML='<canvas class="ob-canvas"></canvas><div class="ob-pointer-light"></div><div class="ob-cursor-anchor"><div class="ob-cursor"></div><div class="ob-cursor-dot"></div></div>';
    host.prepend(sceneShell);window.addEventListener('mincetong-titanium-ready',()=>{scene?.destroy();createScene();},{signal});createScene();
    const handleClick=event=>{
      const leafButton=event.target.closest('[data-leaf]');
      if(leafButton){
        const leaf=groups.flatMap(g=>g.leaves).find(l=>l.id===leafButton.dataset.leaf);
        lastLeaf=leafButton;
        if(leaf.view==='human'){human();return;}
        serviceGroup=leaf.group||'';
        navigate(leaf.view);return;
      }
      const groupButton=event.target.closest('[data-group]');
      if(groupButton){
        const id=groupButton.dataset.group;const collapsed=$(`[data-cluster="${id}"]`).classList.toggle('is-collapsed');
        groupButton.setAttribute('aria-expanded',String(!collapsed));groupButton.querySelector('.branch-toggle').textContent=collapsed?'+':'−';
        $(`[data-wire="${id}"]`).classList.toggle('is-collapsed',collapsed);
        scene?.burst();return;
      }
      if(event.target.closest('[data-tree-home]')){navigate('hall');return;}
      if(event.target.closest('[data-tree-human]')){human();return;}
      if(event.target.closest('[data-tree-reset]')){reset();return;}
      if(event.target.closest('[data-tree-motion]')){
        paused=!paused;
        if(paused)host.getAnimations({subtree:true}).filter(a=>a.animationName==='tree-assemble').forEach(a=>a.finish());
        document.body.classList.toggle('tree-still',reduced());
        const b=$('[data-tree-motion]');b.innerHTML=icon(paused?'play':'pause');b.setAttribute('aria-pressed',String(paused));b.setAttribute('aria-label',paused?'开启动效':'暂停动效');
        scene?.refresh?.();
      }
    };
    host.querySelectorAll('[data-leaf],[data-group],[data-tree-home],[data-tree-human],[data-tree-reset],[data-tree-motion]').forEach(button=>{button.onclick=handleClick;});
    host.addEventListener('pointerover',event=>{
      const b=event.target.closest('[data-branch],[data-group]');
      if(b)highlight(b.dataset.branch||b.dataset.group);
    },{signal});
    $('.tree-world').addEventListener('pointerleave',()=>highlight(''),{signal});
    host.addEventListener('focusin',event=>{const b=event.target.closest('[data-branch],[data-group]');if(b)highlight(b.dataset.branch||b.dataset.group);},{signal});
    const stage=$('.tree-stage');
    stage.addEventListener('pointerdown',event=>{
      if(stage.classList.contains('titanium-ready'))return;
      if(event.pointerType!=='mouse'||event.button!==0||event.target.closest('button,a,input,textarea,select')||current!=='hall'||innerWidth<760)return;
      drag={x:event.clientX,y:event.clientY,panX:pan.x,panY:pan.y};stage.setPointerCapture(event.pointerId);stage.classList.add('is-dragging');
    },{signal});
    stage.addEventListener('pointermove',event=>{
      if(reduced()||stage.classList.contains('titanium-ready'))return;
      const r=stage.getBoundingClientRect();
      const x=(event.clientX-r.left)/r.width-.5,y=(event.clientY-r.top)/r.height-.5;
      if(drag){pan.x=Math.max(-70,Math.min(70,drag.panX+event.clientX-drag.x));pan.y=Math.max(-35,Math.min(35,drag.panY+event.clientY-drag.y));}
      if(pointerFrame)cancelAnimationFrame(pointerFrame);
      pointerFrame=requestAnimationFrame(()=>{pointerFrame=0;stage.style.setProperty('--pan-x',`${pan.x+x*7}px`);stage.style.setProperty('--pan-y',`${pan.y+y*5}px`);});
    },{signal});
    const endDrag=()=>{drag=null;stage.classList.remove('is-dragging');};
    stage.addEventListener('pointerup',endDrag,{signal});stage.addEventListener('pointercancel',endDrag,{signal});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&current!=='hall'&&!document.querySelector('dialog[open]'))navigate('hall');},{signal});
    window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==$('#serviceFrame')?.contentWindow)return;if(event.data?.type==='mincetong-tree-back')navigate('hall');},{signal});
    motionQuery.addEventListener('change',()=>{document.body.classList.toggle('tree-still',reduced());scene?.refresh?.();},{signal});
    document.body.classList.toggle('tree-still',reduced());
  }
  function createScene(){
    scene=window.MincetongTitanium?.create(host,{reduced});
    scene?.step(!current||current==='hall'?0:2);
  }
  function human(){document.querySelector('#alwaysHuman button')?.click();}
  function highlight(id){
    if(selectedGroup===id)return;selectedGroup=id;
    $('.tree-world')?.classList.toggle('is-tracing',!!id);
    host.querySelectorAll('[data-cluster],[data-wire]').forEach(e=>e.classList.toggle('is-highlighted',(e.dataset.cluster||e.dataset.wire)===id));
  }
  function reset(){
    pan={x:0,y:0};const stage=$('.tree-stage');stage.style.setProperty('--pan-x','0px');stage.style.setProperty('--pan-y','0px');
    host.querySelectorAll('.is-collapsed').forEach(e=>e.classList.remove('is-collapsed'));
    host.querySelectorAll('[data-group]').forEach(e=>{e.setAttribute('aria-expanded','true');e.querySelector('.branch-toggle').textContent='−';});highlight('');scene?.reset?.();scene?.step(0);scene?.burst();
  }
  function geometry(button,sheet){
    let a=null;const b=sheet.getBoundingClientRect();
    const model=scene?.getBounds(button?.dataset.leaf);
    if(model)return {transform:`translate(${model.left-b.left}px,${model.top-b.top}px) scale(${model.width/b.width},${model.height/b.height})`,opacity:.25,borderRadius:'24px'};
    if(button?.isConnected){
      const stage=$('.tree-stage'),r=stage.getBoundingClientRect();
      a={left:r.left+button.offsetLeft-button.offsetWidth/2+(parseFloat(stage.style.getPropertyValue('--pan-x'))||0),top:r.top+button.offsetTop-button.offsetHeight/2+(parseFloat(stage.style.getPropertyValue('--pan-y'))||0),width:button.offsetWidth,height:button.offsetHeight};
    }
    if(!a||innerWidth<760)return {transform:'translate(0, 30px) scale(.98)',opacity:0};
    return {transform:`translate(${a.left-b.left}px,${a.top-b.top}px) scale(${a.width/b.width},${a.height/b.height})`,opacity:.25,borderRadius:'24px'};
  }
  function render(options){
    navigate=options.navigate;
    if(!host?.querySelector('.tree-shell'))setup(options.profile);
    const next=options.view||'hall',changed=next!==current,was=current,token=changed?++sequence:sequence;
    document.title=`民策通 · ${titles[next]||'居民服务'}`;
    document.body.dataset.treeView=next;
    const sheet=$('.tree-sheet'),content=$('#treeContent'),world=$('.tree-main');
    const count=$('#node-messages small');if(count)count.textContent=options.unread?`${options.unread} 条未读服务消息`:'查看提醒与服务进展';
    const avatar=$('.tree-avatar');if(avatar)avatar.textContent=options.profile.name?.slice(0,1)||'您';
    if(!changed){if(next!=='hall'&&!(next==='services'&&content.querySelector('#serviceFrame')))content.innerHTML=options.html;prepareContent(next);return;}
    transition?.cancel();current=next;
    $('.tree-status').textContent=next==='hall'?'已返回服务空间':`已打开${titles[next]}`;
    if(next==='hall'){
      document.body.classList.remove('tree-focused');window.scrollTo({top:rootScrollY,behavior:'instant'});world.inert=false;$('.tree-footer').inert=false;sheet.inert=true;scene?.step(0);
      if(was&&was!=='hall'){
        const end=geometry(lastLeaf,sheet);
        transition=sheet.animate([{transform:'none',opacity:1},end],{duration:reduced()?0:480,easing:'cubic-bezier(.4,0,.2,1)',fill:'both'});
        transition.finished.then(()=>{if(token!==sequence)return;sheet.hidden=true;content.replaceChildren();transition.cancel();host.querySelector('[data-titanium-id="'+lastLeaf?.dataset.leaf+'"]')?.focus({preventScroll:true});}).catch(()=>{});
      }else{sheet.hidden=true;}
      return;
    }
    if(was==='hall')rootScrollY=window.scrollY;
    sheet.hidden=false;sheet.inert=false;content.innerHTML=options.html;content.scrollTop=0;$('#sheetTitle').textContent=titles[next];prepareContent(next);
    if(next==='services'){
      const frame=$('#serviceFrame');if(serviceGroup)frame.src=`/titanium/services.html?embedded=1&group=${encodeURIComponent(serviceGroup)}`;
    }
    const origin=geometry(lastLeaf,sheet);
    document.body.classList.add('tree-focused');world.inert=true;$('.tree-footer').inert=true;scene?.step({search:2,services:3,messages:1,pilot:5}[next]||2);scene?.burst();
    transition=sheet.animate(was==='hall'||!was?[origin,{transform:'none',opacity:1,borderRadius:'30px'}]:[{transform:'translate(22px,0) scale(.99)',opacity:.35},{transform:'none',opacity:1}],{duration:reduced()?0:680,easing:'cubic-bezier(.16,1,.3,1)',fill:'both'});
    content.animate([{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'none'}],{duration:reduced()?0:500,delay:reduced()?0:160,easing:'cubic-bezier(.16,1,.3,1)'});
    transition.finished.then(()=>{if(token!==sequence)return;transition.cancel();const heading=content.querySelector('h1,h2');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}}).catch(()=>{});
  }
  function prepareContent(view){
    const content=$('#treeContent');content.dataset.content=view;
    if(view==='search'){
      const title=content.querySelector('.page-heading h1'),description=content.querySelector('.page-heading p'),needs=content.querySelector('.policy-needs h2');
      if(title)title.textContent='查询政策文件';
      if(description)description.textContent='按关键词或服务领域查找，办理前请核对当地有效规定。';
      if(needs)needs.textContent='选择当前需要，也可以直接搜索';
    }
    if(view==='messages'){
      const empty=[...content.querySelectorAll('.message-layout .small-note')].find(e=>e.textContent.trim()==='暂无服务消息。');
      if(empty){empty.classList.add('tree-empty-message');empty.innerHTML=`<span class="empty-vector" aria-hidden="true">${icon('message')}</span><strong>暂时没有服务消息</strong><span>需要时，您可以从服务空间主动查找。</span>`;}
    }
  }
  function leave(){
    ++sequence;transition?.cancel();abort?.abort();scene?.destroy();if(pointerFrame)cancelAnimationFrame(pointerFrame);sceneShell?.remove();document.body.classList.remove('tree-active','tree-focused','tree-still');delete document.body.dataset.treeView;host=null;current='';lastLeaf=null;selectedGroup='';
  }
  window.MincetongTitaniumTree={render,leave};
})();
