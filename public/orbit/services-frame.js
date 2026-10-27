(() => {
  'use strict';
  const params=new URLSearchParams(location.search);
  if(params.get('embedded')==='1')document.body.classList.add('embedded');
  if(params.get('group'))document.body.classList.add('embedded-group');
  const names={'服务 Agent':'服务分类'};
  function polish(){
    document.querySelectorAll('[data-tab="catalog"]').forEach(b=>{if(names[b.textContent.trim()])b.textContent=names[b.textContent.trim()];});
    document.querySelectorAll('.stat span').forEach(s=>{if(s.textContent==='服务 Agent')s.textContent='服务分类';});
    const title=document.querySelector('.hero h1'),description=document.querySelector('.hero p');
    if(title)title.textContent='生活服务与提醒';
    if(description)description.textContent='按事项查看要求，确认后再添加提醒。';
    const grid=document.querySelector('#content>.agent-grid');
    if(params.get('group')&&grid){
      const picker=document.createElement('details');picker.className='service-category-picker';
      picker.innerHTML='<summary>切换服务分类<span>6 类服务</span></summary>';
      grid.before(picker);picker.append(grid);
    }
    const heading=document.querySelector('.section-heading h2');
    if(heading?.textContent==='每一种需要，都有人记着。')heading.textContent='可添加的服务提醒';
  }
  const observer=new MutationObserver(()=>{
    polish();
    const group=params.get('group');
    if(group&&!document.body.dataset.groupOpened){
      const button=[...document.querySelectorAll('[data-group]')].find(b=>b.dataset.group===group);
      if(button){document.body.dataset.groupOpened='true';button.click();window.scrollTo({top:0,behavior:'instant'});}
    }
  });
  observer.observe(document.querySelector('#content'),{childList:true});polish();
  const back=document.querySelector('#backLink');
  if(params.get('embedded')==='1')back.addEventListener('click',event=>{event.preventDefault();parent.postMessage({type:'mincetong-tree-back'},location.origin);});
})();
