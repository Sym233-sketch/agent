/* Small, event-driven motion layer. No cursor replacement or per-frame render loop. */
(()=>{
  'use strict';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const fine=matchMedia('(hover: hover) and (pointer: fine)');
  const animations=new Set(),seen=new WeakSet();
  let currentNav=null,lastNav=null,surface=null,frame=0,resizeFrame=0,point={x:0,y:0};
  let serviceTransition=null,queuedServiceUpdate=null,lastServiceTab=null;
  const wrappedServiceTabs=new WeakSet();
  const enabled=()=>document.body.classList.contains('precision-ui')&&!document.body.classList.contains('onboarding-active');
  function animate(element,keyframes,options){
    if(reduced.matches||!element.animate)return;
    const animation=element.animate(keyframes,options);
    animations.add(animation);
    animation.finished.then(()=>animations.delete(animation),()=>animations.delete(animation));
  }
  function mountNav(force=false){
    const nav=document.querySelector('.modern-ui .user-nav');
    if(!nav){currentNav=null;return}
    if(nav===currentNav&&!force)return;
    const active=nav.querySelector('button.active');
    if(!active)return;
    const box=nav.getBoundingClientRect(),button=active.getBoundingClientRect();
    const next={x:button.left-box.left,y:button.top-box.top,width:button.width,height:button.height};
    let track=nav.querySelector('.modern-nav-track');
    if(!track){track=document.createElement('div');track.className='modern-nav-track';track.setAttribute('aria-hidden','true');nav.append(track)}
    for(const animation of track.getAnimations())animation.cancel();
    const transform=r=>`translate3d(${r.x}px,${r.y}px,0)`;
    track.style.transform=transform(next);track.style.width=next.width+'px';track.style.height=next.height+'px';
    if(lastNav&&!force)animate(track,[{transform:transform(lastNav),width:lastNav.width+'px',height:lastNav.height+'px'},{transform:transform(next),width:next.width+'px',height:next.height+'px'}],{duration:420,easing:'cubic-bezier(.16,1,.3,1)'});
    currentNav=nav;lastNav=next;
  }
  function serviceSwap(update){
    if(!document.startViewTransition||reduced.matches||document.hidden){update();return}
    if(serviceTransition){queuedServiceUpdate=update;serviceTransition.skipTransition();return}
    document.body.classList.add('service-view-changing');
    let transition;
    try{transition=document.startViewTransition(update)}catch{document.body.classList.remove('service-view-changing');update();return}
    serviceTransition=transition;transition.ready.catch(()=>{});
    const finish=()=>{
      if(serviceTransition!==transition)return;
      serviceTransition=null;document.body.classList.remove('service-view-changing');
      const next=queuedServiceUpdate;queuedServiceUpdate=null;if(next)serviceSwap(next);
    };
    transition.finished.then(finish,finish);
  }
  function mountServiceTabs(force=false){
    const nav=document.querySelector('.modern-service-ui .tabs'),active=nav?.querySelector('button.active');
    if(!active)return;
    for(const button of nav.querySelectorAll('[data-tab]'))if(!wrappedServiceTabs.has(button)&&button.onclick){
      wrappedServiceTabs.add(button);
      const handler=button.onclick;
      button.onclick=event=>{
        if(button.classList.contains('active')&&!serviceTransition)return;
        serviceSwap(()=>handler.call(button,event));
      };
    }
    if(lastServiceTab===active&&!force)return;
    const parent=nav.getBoundingClientRect(),next=active.getBoundingClientRect();
    let track=nav.querySelector('.service-tabs-track'),before=null;
    if(track){const b=track.getBoundingClientRect();before={x:b.left-parent.left,width:b.width};for(const a of track.getAnimations())a.cancel()}
    else{track=document.createElement('div');track.className='service-tabs-track';track.setAttribute('aria-hidden','true');nav.append(track)}
    const x=next.left-parent.left;track.style.width=next.width+'px';track.style.transform=`translateX(${x}px)`;
    if(before&&!force)animate(track,[{width:before.width+'px',transform:`translateX(${before.x}px)`},{width:next.width+'px',transform:`translateX(${x}px)`}],{duration:420,easing:'cubic-bezier(.16,1,.3,1)'});
    lastServiceTab=active;
  }
  const reveal='IntersectionObserver' in window?new IntersectionObserver(entries=>{
    for(const entry of entries){
      if(!entry.isIntersecting)continue;
      reveal.unobserve(entry.target);
      if(document.body.classList.contains('is-view-changing')||document.body.classList.contains('service-view-changing'))continue;
      animate(entry.target,[{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:440,easing:'cubic-bezier(.16,1,.3,1)'});
    }
  },{threshold:.05,rootMargin:'0px 0px 24px 0px'}):null;
  function mount(){
    if(!enabled())return;
    if(document.body.classList.contains('modern-service-ui')){
      for(const label of document.querySelectorAll('.stat span'))if(label.textContent==='服务 Agent')label.textContent='服务分类';
      for(const label of document.querySelectorAll('.agent-count'))if(label.textContent.includes('SCENARIOS'))label.textContent=label.textContent.replace('SCENARIOS','项服务');
    }
    for(const holder of document.querySelectorAll('[data-modern-sculpture]:not([data-art-ready])')){
      holder.dataset.artReady='true';holder.innerHTML=window.MINCETONG_ART?.sculpture||'';
    }
    mountNav();
    mountServiceTabs();
    for(const card of document.querySelectorAll('.modern-overview-lead,.modern-quick,.policy-result-card,.agent-card,.scenario')){
      card.classList.add('motion-surface');
      if(!seen.has(card)){
        seen.add(card);
        if(reveal&&card.matches('.policy-result-card,.agent-card,.scenario'))reveal.observe(card);
      }
    }
  }
  function resetSurface(){
    if(frame){cancelAnimationFrame(frame);frame=0}
    if(surface){surface.classList.remove('has-pointer');surface.style.removeProperty('--parallax-x');surface.style.removeProperty('--parallax-y')}
    surface=null;
  }
  document.addEventListener('mincetong:before-view',()=>{
    const nav=document.querySelector('.modern-ui .user-nav'),track=nav?.querySelector('.modern-nav-track');
    if(!track)return;
    const parent=nav.getBoundingClientRect(),box=track.getBoundingClientRect();
    lastNav={x:box.left-parent.left,y:box.top-parent.top,width:box.width,height:box.height};
  });
  function paint(){
    frame=0;
    if(!surface?.isConnected)return;
    const box=surface.getBoundingClientRect();
    const x=Math.max(0,Math.min(1,(point.x-box.left)/box.width)),y=Math.max(0,Math.min(1,(point.y-box.top)/box.height));
    surface.style.setProperty('--light-x',(x*100).toFixed(2)+'%');
    surface.style.setProperty('--light-y',(y*100).toFixed(2)+'%');
    if(surface.classList.contains('modern-overview-lead')){
      surface.style.setProperty('--parallax-x',((x-.5)*9).toFixed(2)+'px');
      surface.style.setProperty('--parallax-y',((y-.5)*7).toFixed(2)+'px');
    }
  }
  document.addEventListener('pointermove',event=>{
    if(!enabled()||reduced.matches||!fine.matches||event.pointerType==='touch'){if(surface)resetSurface();return}
    const target=event.target instanceof Element?event.target.closest('.motion-surface'):null;
    if(target!==surface){resetSurface();surface=target;surface?.classList.add('has-pointer')}
    if(!surface)return;
    point={x:event.clientX,y:event.clientY};if(!frame)frame=requestAnimationFrame(paint);
  },{passive:true});
  document.addEventListener('pointerleave',resetSurface,{passive:true});
  document.addEventListener('visibilitychange',()=>{
    document.body.classList.toggle('motion-hidden',document.hidden);if(document.hidden)resetSurface();
  });
  window.addEventListener('resize',()=>{
    if(resizeFrame)cancelAnimationFrame(resizeFrame);
    resizeFrame=requestAnimationFrame(()=>{resizeFrame=0;if(enabled()){mountNav(true);mountServiceTabs(true)}});
  },{passive:true});
  reduced.addEventListener('change',()=>{
    if(reduced.matches){for(const animation of animations)animation.cancel();resetSurface()}
  });
  new MutationObserver(mount).observe(document.getElementById('app')||document.getElementById('content')||document.body,{childList:true,subtree:true});
  mount();
})();
