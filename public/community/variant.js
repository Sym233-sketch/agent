/* Presentation helpers for the independent preview; existing business actions stay in their original modules. */
(()=>{'use strict';
let pending=false,intentApplied=false;const requestedView=location.hash.slice(1);
function enhance(){
 document.querySelectorAll('a[href="care-library.html"]').forEach(a=>a.setAttribute('href','/care-library.html'));
 const sidebar=document.querySelector('.app-sidebar');
 if(sidebar&&!intentApplied&&['hall','search','pilot','messages'].includes(requestedView)){intentApplied=true;if(location.hash.slice(1)!==requestedView)sidebar.querySelector('[data-view="'+requestedView+'"]')?.click();}
 if(sidebar&&!sidebar.querySelector('.community-home-nav')){const a=document.createElement('a');a.className='community-home-nav';a.href='resident.html';a.innerHTML='<svg aria-hidden="true"><use href="#hall"/></svg>服务首页';sidebar.querySelector('.resident-tag')?.after(a);}
 const discovery=document.querySelector('.policy-discovery');if(discovery&&!discovery.querySelector('.community-context-note')){const note=document.createElement('p');note.className='community-context-note';note.textContent='先了解政策  →  核对适用条件  →  由您确认下一步';discovery.querySelector('.page-heading')?.after(note);}
 document.querySelectorAll('.stat span,.agent-count').forEach(el=>{const next=el.textContent.replace('服务 Agent','服务类别').replace('SCENARIOS','项服务');if(next!==el.textContent)el.textContent=next;});
 const back=document.querySelector('#backLink');if(back?.getAttribute('href')==='/#policy')back.href='index.html#policy';
 document.querySelectorAll('.step').forEach(step=>{if(step.classList.contains('active'))step.setAttribute('aria-current','step');else step.removeAttribute('aria-current');});
}
enhance();const host=document.querySelector('#app')||document.querySelector('main')||document.body;
new MutationObserver(()=>{if(pending)return;pending=true;queueMicrotask(()=>{pending=false;enhance();});}).observe(host,{childList:true,subtree:true});
})();
