(()=>{'use strict';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const government=new URLSearchParams(location.search).get('view')==='government';let token='',state;
try{token=JSON.parse(sessionStorage.getItem('mince-resident-session-v1'))?.profile?.remote?.token||''}catch{}
const labels={queued:'等待判断',observed:'观察命中',executed:'已执行',filtered:'已过滤',failed:'执行失败',pending:'待认领',accepted:'已认领',completed:'已完成',cancelled:'已取消',superseded:'已被新提醒替代',resolved:'已结束'};
async function api(path,input){const r=await fetch('/api/event-center/'+path,{method:input===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(!government&&token?{Authorization:'Bearer '+token}:{})},...(input===undefined?{}:{body:JSON.stringify(input)})});const data=await r.json();if(!r.ok)throw Error(data.error||'请求未完成');return data}
function events(items){return '<details><summary>事件判断记录（'+items.length+'）</summary>'+items.map(e=>'<article><b>'+esc(({policy:'政策发布',needs:'本人需求变化',materials:'材料缺项',due:'准备期限临近',overdue:'准备期限已过'})[e.kind]||e.kind)+'</b><p>'+esc(labels[e.status])+' · '+esc(e.reason)+'</p><small>规则版本 '+e.ruleVersion+' · '+esc(e.createdAt)+'<br>事件 '+esc(e.id.slice(0,12))+'</small></article>').join('')+'</details>'}
function render(){
 $('#status').textContent=state.mode==='observe'?'观察模式：只记录判断，暂不发送提醒或生成待办。':'执行模式：授权范围内的站内提醒与待办已开启。';
 if(government){$('#heading').textContent='事件与主动跟进';$('#back').href='/#policy';$('#back').textContent='返回政府工作台';
  $('#controls').innerHTML='<div class="row"><button id="mode">'+(state.mode==='observe'?'开启规则执行':'切换为观察模式')+'</button><button id="scan">检查当前事项</button><button id="example">运行隔离示例</button></div><p>开启执行后，会复核当前订阅和事项状态，再处理观察记录。先行者草案递送仍需工作人员确认。</p><div id="exampleResult"></div>';
  $('#content').innerHTML='<h2>跟进待办</h2>'+(state.tasks.length?state.tasks.map(t=>'<article><h3>'+esc(t.title)+'</h3><p>'+esc(labels[t.state])+'</p><p>'+esc(t.notice)+'</p>'+(['pending','accepted'].includes(t.state)?'<button data-task="'+esc(t.id)+'" data-state="'+(t.state==='pending'?'accepted':'completed')+'">'+(t.state==='pending'?'确认认领':'确认已核实处理')+'</button>':'')+'</article>').join(''):'<p>暂无跟进待办。</p>')+events(state.events);
  $('#mode').onclick=()=>action(()=>api('government/mode',{mode:state.mode==='observe'?'auto':'observe',confirm:true}));$('#scan').onclick=()=>action(()=>api('government/scan',{}));
  $('#example').onclick=()=>action(async()=>{const d=await api('government/simulate',{});$('#exampleResult').innerHTML='<article><h3>隔离示例已完成</h3><p>'+d.observed+' 个事件先观察、再执行；生成 '+d.notices.length+' 条示例提醒和 '+d.tasks.length+' 项示例待办。</p><p>未写入业务数据、未向居民递送、模型调用为0。</p>'+events(d.events)+'</article>'},false);
  document.querySelectorAll('[data-task]').forEach(b=>b.onclick=()=>action(()=>api('government/tasks/'+b.dataset.task,{state:b.dataset.state,confirm:true})));
 }else{
  $('#controls').innerHTML=state.cases.length?'<form id="watch"><h2>订阅一件事</h2><label>办理事项<select name="caseId">'+state.cases.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.title)+'</option>').join('')+'</select></label><label>希望完成准备的日期（选填）<input type="date" name="deadline"></label><p>日期由你登记，仅用于准备提醒。未填写日期时，只检查现有虚拟表单的必填缺项。</p><label><input type="checkbox" name="consent" required>我同意针对这件事接收站内提醒，并在超过准备日期时生成站内跟进待办。</label><button>开启或更新订阅</button></form>':'<p>请先和红通聊一件想办理的事，再回来开启跟进。</p>';
  $('#content').innerHTML='<h2>我的订阅</h2>'+state.watches.map(w=>'<article><b>'+esc(state.cases.find(c=>c.id===w.caseId)?.title||'我的事项')+'</b><p>'+(w.enabled?'已开启':'已暂停')+' · '+(w.deadline?'准备日期 '+esc(new Date(w.deadline).toLocaleDateString('zh-CN')):'未登记准备日期')+'</p>'+(w.enabled?'<button data-pause="'+esc(w.caseId)+'">暂停本事项提醒</button>':'')+'</article>').join('')+'<h2>需要关注</h2>'+(state.notices.length?state.notices.map(n=>'<article><h3>'+esc(n.title)+'</h3><p>'+esc(n.description)+'</p>'+(n.missing.length?'<p>待补充：'+n.missing.map(esc).join('、')+'</p>':'')+'<p>'+esc(n.boundary)+'</p><a href="/user.html#progress" target="_top">到我的进度继续准备</a>'+(!n.readAt?'<button data-read="'+esc(n.id)+'">标记已读</button>':'<small>已读</small>')+'</article>').join(''):'<p>暂无待查看提醒。</p>')+events(state.events);
  $('#watch')?.addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.target);action(()=>api('me/watch',{caseId:f.get('caseId'),deadline:f.get('deadline'),enabled:true,consent:f.has('consent')}))});
  document.querySelectorAll('[data-pause]').forEach(b=>b.onclick=()=>action(()=>api('me/watch',{caseId:b.dataset.pause,enabled:false})));
  document.querySelectorAll('[data-read]').forEach(b=>b.onclick=()=>action(()=>api('me/notices/'+b.dataset.read+'/read',{})));
 }
}
async function reload(){state=await api(government?'government':'me');render()}
async function action(fn,refresh=true){document.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();if(refresh)await reload()}catch(e){$('#status').textContent=e.message}finally{document.querySelectorAll('button').forEach(b=>b.disabled=false)}}
reload().catch(e=>$('#status').textContent=e.message);
})();
