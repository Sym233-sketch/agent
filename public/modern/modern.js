/* Presentation layer only. The original resident controller owns data and actions. */
(()=>{
  'use strict';
  const root=document.getElementById('app');
  if(!root)return;
  const icons={
    home:'<path d="m3 10 9-7 9 7v10H3zM9 20v-7h6v7"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
    up:'<path d="M6 18 18 6M6 6h12v12"/>',
    mail:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',
    shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6"/>',
    support:'<path d="M12 15c-8-4-6-10-2-8l2 2 2-2c4-2 6 4-2 8ZM3 14l3 4h12l3-4M7 21h10"/>',
    elder:'<path d="M4 20h16M6 17v-5h12v5M9 4a3 3 0 0 1 6 0M12 7v2M3 7l2 1m16-1-2 1M8 17v3m8-3v3"/>',
    homeCare:'<path d="m3 10 9-7 9 7M5 9v11h14V9M12 17c-5-3-3-6-1-4l1 1 1-1c2-2 4 1-1 4Z"/>',
    work:'<rect x="3" y="7" width="18" height="14" rx="3"/><path d="M8 7V4h8v3M3 12c5 4 13 4 18 0M10 14h4"/>',
    study:'<path d="M12 6C8 3 5 4 3 5v15c3-2 6-2 9 0 3-2 6-2 9 0V5c-3-1-6-2-9 1Zm0 0v14M6 9l3 1m-3 3 3 1m6-4 3-1m-3 5 3-1"/>',
    access:'<circle cx="12" cy="4" r="2"/><path d="m3 9 9 2 9-2M12 11v4m0 0-5 7m5-7 5 7"/>',
    legal:'<path d="M12 3v17M5 21h14M3 7l9-2 9 2M5 7l-3 7h6L5 7Zm14 0-3 7h6l-3-7ZM2 14c1 4 5 4 6 0m8 0c1 4 5 4 6 0"/>'
  };
  const icon=(name,cls='')=>`<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${icons[name]||icons.arrow}</svg>`;
  let comingFromIntro=document.body.classList.contains('onboarding-active');
  let firstApp=true;
  let pendingFocusView=null,activeTransition=null,queuedTransition=null;
  const go=(view,focus=false)=>{
    pendingFocusView=focus?view:null;
    root.querySelector(`.user-nav [data-view="${view}"]`)?.click();
  };
  function changeView(update){
    if(!document.startViewTransition||matchMedia('(prefers-reduced-motion: reduce)').matches||document.hidden){update();return}
    if(activeTransition){queuedTransition=update;activeTransition.skipTransition();return}
    document.body.classList.add('is-view-changing');
    let transition;
    try{transition=document.startViewTransition(update)}catch{document.body.classList.remove('is-view-changing');update();return}
    activeTransition=transition;
    transition.ready.catch(()=>{});
    const finish=()=>{
      if(activeTransition!==transition)return;
      activeTransition=null;document.body.classList.remove('is-view-changing');
      const next=queuedTransition;queuedTransition=null;if(next)changeView(next);
    };
    transition.finished.then(finish,finish);
  }
  function openHelp(){
    const dialog=document.getElementById('userDialog');
    const body=document.getElementById('userDialogBody');
    if(!dialog||!body)return;
    body.innerHTML='<span class="pill">使用帮助</span><h2>从您需要的事情开始</h2><ul class="modern-help-list"><li><b>查找政策</b><span>在工作台输入关键词，或选择一项生活需求。打开政策后，可以查看依据、办理线索及官方原文。</span></li><li><b>修改匹配资料</b><span>在消息页选择“更新匹配资料”，补充职业、收入和具体需求。资料与资格核验由正式部门确认。</span></li><li><b>管理服务与提醒</b><span>进入“服务与提醒”添加事项。主动消息的接收方式，可在“我的服务档案”中调整。</span></li></ul><p class="small-note">这是本地演示，身份、银行和家庭登记接口尚未接入。政策适用情况请结合文件原文及当地办理要求核对。</p><button class="btn" id="modernHelpSearch" type="button">去查找政策</button>';
    document.getElementById('modernHelpSearch').onclick=()=>{dialog.close();go('search',true)};
    document.getElementById('topCloseUserDialog').onclick=()=>dialog.close();
    document.getElementById('closeUserDialog').onclick=()=>dialog.close();
    dialog.showModal();
  }
  function enhanceOverview(discovery){
    discovery.classList.add('modern-overview');
    const heading=discovery.querySelector('.page-heading');
    heading.querySelector('.eyebrow').textContent='居民服务 · 个人工作台';
    heading.querySelector('h1').innerHTML='您的服务<span class="title-sheen">工作台</span>';
    heading.querySelector('p').textContent='查政策、看消息，准备好下一步。';
    const date=document.createElement('span');
    date.className='modern-date';
    date.textContent=new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'}).format(new Date());
    heading.append(date);
    const panel=discovery.querySelector('.policy-search-panel');
    panel.querySelector('form>label').textContent='想找哪方面的支持？';
    panel.querySelector('#policyQuery').placeholder='如：就业、养老、生活困难';
    panel.querySelector('.btn').textContent='查找政策';
    panel.querySelector('.policy-search-row').insertAdjacentHTML('afterbegin',icon('search','modern-search-icon'));
    panel.querySelector('form').addEventListener('submit',()=>go('search'));
    const options=document.createElement('details');
    options.className='modern-search-options';
    options.innerHTML='<summary>搜索范围与记录设置</summary>';
    for(const node of [...panel.querySelectorAll('.policy-search-filters,.small-note,.policy-interest-controls')])options.append(node);
    panel.append(options);
    const lead=document.createElement('section');
    lead.className='modern-overview-lead';
    lead.setAttribute('aria-label','政策查询入口');
    panel.before(lead);
    lead.append(panel);
    heading.after(lead);
    const art=document.createElement('figure');
    art.className='modern-orbit';
    art.setAttribute('aria-hidden','true');
    art.innerHTML=(window.MINCETONG_ART?.sculpture||'')+'<figcaption>MINCETONG / SERVICE</figcaption>';
    lead.append(art);
    const quick=document.createElement('nav');
    quick.className='modern-quick-actions';
    quick.setAttribute('aria-label','常用服务');
    quick.innerHTML=`<button type="button" class="modern-quick" data-modern-go="search">${icon('search')}<div><b>政策查询</b><small>按关键词与领域查找</small></div>${icon('up','modern-arrow')}</button><a class="modern-quick" href="services.html">${icon('clock')}<div><b>服务与提醒</b><small>整理重要日期与事项</small></div>${icon('up','modern-arrow')}</a><button type="button" class="modern-quick" data-modern-go="messages">${icon('mail')}<div><b>我的消息</b><small>查看已有服务回复</small></div>${icon('up','modern-arrow')}</button>`;
    panel.append(quick);
    const needs=discovery.querySelector('.policy-needs');
    const grid=document.createElement('div');
    grid.className='modern-dashboard-grid';
    needs.before(grid);
    grid.append(needs);
    const guide=document.createElement('aside');
    guide.className='modern-guide';
    guide.setAttribute('aria-label','办事指引');
    guide.innerHTML='<h2>每一步，都更清楚</h2><ol><li>选择您的需求<small>从具体的生活事项开始</small></li><li>看清政策依据<small>官方原文与办理线索一起查看</small></li><li>核对实际情况<small>适用资格以正式审核为准</small></li></ol><button type="button" class="text-button" data-modern-help>查看使用帮助 ↗</button>';
    grid.append(guide);
    const recs=discovery.querySelector('.policy-recommendations');
    const title=recs.querySelector('h2');
    title.textContent='可能用得上的支持';
    const sectionHead=document.createElement('div');
    sectionHead.className='modern-section-heading';
    title.before(sectionHead);
    sectionHead.append(title);
    sectionHead.insertAdjacentHTML('beforeend','<button type="button" class="text-button" data-modern-go="search">查看政策库 ↗</button>');
  }
  function enhance(){
    const sidebar=root.querySelector('.app-sidebar');
    if(!sidebar){comingFromIntro=true;document.body.classList.remove('modern-ui','precision-ui');return}
    if((comingFromIntro||firstApp&&!location.hash)&&!['hall','search','pilot'].includes(location.hash.slice(1))){
      comingFromIntro=false;firstApp=false;go('hall');return;
    }
    comingFromIntro=false;firstApp=false;
    document.body.classList.add('modern-ui','precision-ui');
    document.title='民策通 · 个人服务工作台';
    const nav=sidebar.querySelector('.user-nav');
    const hall=nav.querySelector('[data-view="hall"]');
    hall.lastChild.textContent='服务概览';
    nav.prepend(hall);
    const search=nav.querySelector('[data-view="search"]');
    search.lastChild.textContent='政策查询';
    const pilot=nav.querySelector('[data-view="pilot"]');
    pilot.lastChild.textContent='意见征询';
    let service=nav.querySelector('[data-service-launcher]');
    if(!service){service=document.createElement('a');service.dataset.serviceLauncher='';service.className='service-launcher';service.innerHTML=icon('clock')+'<span>服务与提醒</span><b data-service-count></b>'}
    service.href='services.html';
    service.querySelector('span').textContent='服务与提醒';
    nav.insertBefore(service,nav.querySelector('[data-view="messages"]'));
    for(const button of nav.querySelectorAll('[data-view]')){
      if(button.classList.contains('active'))button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    }
    const support=sidebar.querySelector('.sidebar-support');
    support.innerHTML=icon('shield')+'<b>需要时，随时找到帮助</b><p>资料可以核对，消息可以暂停。每一步的选择都由您决定。</p><button type="button" class="modern-help-button" data-modern-help>查看使用指引 '+icon('arrow')+'</button>';
    const header=root.querySelector('.app-header');
    header.querySelector('.care-library-link')?.remove();
    const view=root.querySelector('.user-nav button.active')?.dataset.view;
    const name={hall:'服务概览',search:'政策查询',messages:'我的消息',pilot:'意见征询'}[view]||'居民服务';
    header.firstElementChild.className='modern-breadcrumb';
    header.firstElementChild.innerHTML=icon('home')+'<span>居民服务</span><i>/</i><b>'+name+'</b>';
    const command=document.createElement('button');
    command.className='modern-command-button';command.type='button';command.setAttribute('aria-label','搜索政策，快捷键 Ctrl K');
    command.innerHTML=icon('search')+'<span>搜索</span><kbd>Ctrl K</kbd>';
    command.onclick=()=>go('search',true);
    header.lastElementChild.prepend(command);
    for(const span of header.querySelectorAll('span'))if(span.textContent.includes('双端'))span.classList.add('modern-connection');
    const profileButton=header.querySelector('[data-action="profile"]');
    const avatar=header.querySelector('.avatar');
    const profileAvatar=document.createElement('button');
    profileAvatar.className='avatar modern-profile-button';profileAvatar.type='button';profileAvatar.setAttribute('aria-label','我的服务档案');profileAvatar.title='我的服务档案';
    profileAvatar.textContent=avatar.textContent;profileAvatar.onclick=()=>profileButton.click();avatar.replaceWith(profileAvatar);
    const humanButton=document.createElement('button');humanButton.type='button';humanButton.className='modern-human-button';humanButton.textContent='人工协助';
    humanButton.onclick=()=>{
      const original=document.querySelector('.always-human button');
      if(original)original.click();else openHelp();
    };
    profileAvatar.before(humanButton);
    const discovery=root.querySelector('.policy-discovery');
    if(discovery){
      if(discovery.dataset.discovery==='hall')enhanceOverview(discovery);
      else{
        discovery.querySelector('h1').textContent='政策查询';
        discovery.querySelector('.page-heading p').textContent='查看政策原文、办理线索与适用条件。';
        const searchPanel=discovery.querySelector('.policy-search-panel');
        discovery.querySelector('.page-heading').after(searchPanel);
        const results=discovery.querySelector('[aria-label="政策搜索结果"]');
        searchPanel.after(results);
        const extras=document.createElement('details');
        extras.className='modern-discovery-extras';
        extras.innerHTML='<summary>按生活需求寻找更多支持</summary>';
        extras.append(discovery.querySelector('.policy-needs'),discovery.querySelector('.policy-recommendations'));
        results.after(extras);
      }
      const domains=[['心理','support','#d2b3eb'],['养老','elder','#d9c499'],['生活','homeCare','#abc5f0'],['工作','work','#bab8f2'],['学习','study','#9dcdca'],['无障碍','access','#98c7e3'],['法律','legal','#d9b9c2']];
      discovery.querySelector('.policy-needs h2').textContent='选择您需要的支持';
      for(const [index,button] of [...discovery.querySelectorAll('[data-policy-need]')].entries()){
        const fullName=button.firstChild.textContent.trim();button.setAttribute('aria-label',fullName);
        if(fullName==='生活与费用支持')button.firstChild.textContent='生活与费用';
        const domain=domains.find(([word])=>button.textContent.includes(word))||domains[0];
        const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
        svg.setAttribute('viewBox','0 0 44 44');svg.setAttribute('class','need-illustration');svg.setAttribute('aria-hidden','true');
        svg.innerHTML=`<defs><linearGradient id="mce-need-${index}" x2="1" y2="1"><stop stop-color="${domain[2]}" stop-opacity=".17"/><stop offset="1" stop-color="${domain[2]}" stop-opacity=".025"/></linearGradient></defs><rect x="1" y="1" width="42" height="42" rx="14" fill="url(#mce-need-${index})" stroke="${domain[2]}" stroke-opacity=".22" stroke-width=".7"/><g transform="translate(10 9)" fill="none" stroke="${domain[2]}" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">${icons[domain[1]]}</g>`;
        button.style.setProperty('--need-accent',domain[2]);button.prepend(svg);
      }
    }
    if(view==='messages'){
      const chat=root.querySelector('.chat-panel');
      if(chat&&!chat.querySelector('.chat-head')){
        chat.innerHTML=`<div class="modern-empty"><div class="modern-empty-graphic" aria-hidden="true">${window.MINCETONG_ART?.mail||icon('mail')}</div><h2>服务消息，在这里继续</h2><p>查阅政策，保留往来回复。主动消息的接收方式，可在服务档案中自行设置。</p><button type="button" class="btn light" data-modern-go="search">查找我需要的政策 ${icon('arrow')}</button></div>`;
      }
    }
    const footer=root.querySelector('.user-footer');
    footer.lastElementChild.textContent='本地演示 · 身份与办理资格尚未经正式核验';
    for(const button of root.querySelectorAll('[data-modern-go]'))button.onclick=()=>go(button.dataset.modernGo,button.dataset.modernGo==='search');
    for(const button of root.querySelectorAll('[data-modern-help]'))button.onclick=openHelp;
    for(const button of nav.querySelectorAll('[data-view]')){
      const handler=button.onclick;
      button.onclick=event=>{
        if(event?.isTrusted)pendingFocusView=null;
        const update=()=>{document.dispatchEvent(new Event('mincetong:before-view'));handler.call(button,event)};
        if(button.classList.contains('active')&&!activeTransition){
          if(pendingFocusView===button.dataset.view){pendingFocusView=null;document.getElementById('policyQuery')?.focus()}
          else window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
          return;
        }
        changeView(update);
      };
    }
    if(pendingFocusView===view){pendingFocusView=null;document.getElementById('policyQuery')?.focus()}
  }
  new MutationObserver(enhance).observe(root,{childList:true});
  document.addEventListener('keydown',event=>{
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'&&document.body.classList.contains('modern-ui')&&!document.body.classList.contains('onboarding-active')&&!document.querySelector('dialog[open]')){
      event.preventDefault();go('search',true);
    }
  });
  enhance();
})();
