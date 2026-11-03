'use strict';
// Domain adaptation inspired by dsh-superagent; no Harness, shell executor or model calls.
const crypto=require('node:crypto');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const error=(status,message)=>Object.assign(Error(message),{status});
const RULES={policy:'发布后匹配',needs:'本人需求变化',materials:'办理准备缺项',due:'准备期限临近',overdue:'准备期限已过'};
module.exports=function createEventCenter({db,changed,send,body,resident,discovery,clock=Date.now}){
 db.eventCenter||={version:1,mode:'observe',events:[],watches:[],notices:[],tasks:[],policies:{}};
 const data=db.eventCenter,now=()=>new Date(clock()).toISOString();
 const profileVersion=r=>hash([r.facts,r.job,r.age,r.proactive]);
 data.profiles||=Object.fromEntries(db.residents.map(r=>[r.id,profileVersion(r)]));
 const people=()=>new Map(db.residents.map(r=>[r.id,r]));
 const caseFor=w=>(db.agent?.cases||[]).find(c=>c.id===w.caseId&&c.residentId===w.residentId);
 const application=c=>(db.agent?.applications||[]).find(a=>a.id===c.applicationId&&a.caseId===c.id&&a.residentId===c.residentId);
 const policyVersion=p=>hash([p.body,p.kind,p.domain,p.deadline,p.review,p.workflow?.revision]);
 // Installation establishes a cursor; historical policy imports must not create a notification storm.
 if(!data.initializedAt){for(const p of db.policies)data.policies[p.id]=policyVersion(p);data.initializedAt=now();changed()}
 function retire(w,state){for(const n of data.notices.filter(n=>n.watchId===w.id&&n.status==='open'))n.status=state;
  for(const t of data.tasks.filter(t=>t.watchId===w.id&&['pending','accepted'].includes(t.state))){t.state=state;t.history.push({state,at:now()})}}
 function viewState(w){const r=people().get(w.residentId),c=caseFor(w);if(!r||!c||!w.enabled)return{reason:'授权已撤回或事项已移除'};
  const a=application(c);if(a?.status==='submitted'||c.confirmedAt)return{reason:'办理准备已确认或已虚拟提交'};
  const missing=(a?.fields||[]).filter(f=>f.required&&!f.value&&!c.memory?.declined?.[f.id]).map(f=>({id:f.id,label:f.label}));
  const hours=w.deadline?(Date.parse(w.deadline)-clock())/3600000:null;
  const rule=hours!==null&&hours<0?'overdue':hours!==null&&hours<=72?'due':missing.length?'materials':null;
  return{r,c,a,missing,rule,revision:a?.revision??c.revision??0};
 }
 function admissible(e){
  if(e.kind==='needs'){const r=people().get(e.entityId);return !r||r.proactive!==true?'主动政策消息未获授权':profileVersion(r)!==e.version?'需求资料已更新，旧事件失效':null}
  if(e.kind==='policy'){
   const p=db.policies.find(p=>p.id===e.entityId);
   if(!p||p.kind!=='publication'||policyVersion(p)!==e.version)return '政策已修改或移除，需按新版本判断';
   if(p.deadline&&Date.parse(p.deadline+'T23:59:59.999+08:00')<clock())return '政策登记有效期已过，需人工核对';
   return null;
  }
  const w=data.watches.find(w=>w.id===e.entityId),s=w&&viewState(w);
  if(!w||s.reason)return s?.reason||'事项订阅不存在';
  if(w.generation!==e.generation||s.rule!==e.kind||hash(s.missing.map(f=>f.id))!==e.missingHash)return '事项已变化，旧提醒失效';
  return null;
 }
 function execute(e){
  if(e.kind==='needs'){discovery.refresh(people().get(e.entityId));return}
  if(e.kind==='policy'){
   const p=db.policies.find(p=>p.id===e.entityId);
   // Catalog delivery reuses expressed needs and current consent. Reviewed custom drafts still require staff delivery.
   if(p.catalogKey&&p.officialSource){for(const r of db.residents)if(r.proactive===true)discovery.refresh(r)}
   if(!data.tasks.some(t=>t.eventId===e.id))data.tasks.push({id:crypto.randomUUID(),eventId:e.id,policyId:p.id,title:'新发布政策匹配待核对',state:'pending',createdAt:now(),history:[],notice:'目录推荐复用原有授权；先行者匹配和草案递送仍须工作人员确认。'});
   return;
  }
  const w=data.watches.find(w=>w.id===e.entityId),s=viewState(w);
  if(data.notices.some(n=>n.eventId===e.id))return;
  retire(w,'superseded');
  const title=RULES[e.kind],description=e.kind==='overdue'?'已超过本人登记的办理准备日期，请核实是否需要继续协助。':e.kind==='due'?'距本人登记的办理准备日期不足72小时，可以提前检查材料。':'当前虚拟申报表仍有必填项待补充，可继续与红通整理。';
  const notice={id:crypto.randomUUID(),eventId:e.id,watchId:w.id,residentId:w.residentId,caseId:w.caseId,title,description,missing:s.missing.map(f=>f.label),deadline:w.deadline,status:'open',createdAt:now(),readAt:null,source:'站内事项及本人登记日期',boundary:'这是办理准备提醒，不是正式补正通知或法定办件超时认定。'};
  data.notices.push(notice);
  if(e.kind==='overdue')data.tasks.push({id:crypto.randomUUID(),eventId:e.id,watchId:w.id,residentId:w.residentId,caseId:w.caseId,title:'办理准备超期待跟进',state:'pending',createdAt:now(),history:[],notice:'站内跟进待办，需人工核实；不代表已向真实部门派单。'});
 }
 function evaluate(e){
  if(!['queued','observed','failed'].includes(e.status)||(e.retryAt&&Date.parse(e.retryAt)>clock())||e.attempts>=3)return;
  const reason=admissible(e);if(reason){e.status='filtered';e.reason=reason;e.updatedAt=now();changed();return}
  if(data.mode==='observe'){if(e.status!=='observed'){e.status='observed';e.reason='规则命中，观察模式不执行';e.updatedAt=now();changed()}return}
  try{e.attempts++;execute(e);e.status='executed';e.reason='授权及当前状态复核通过，已执行站内动作';delete e.retryAt}
  catch(err){e.status='failed';e.reason='执行失败，待重试';e.retryAt=new Date(clock()+2000*2**e.attempts).toISOString()}
  e.updatedAt=now();changed();
 }
 function emit(input){const id=hash(input),old=data.events.find(e=>e.id===id);if(old){evaluate(old);return old}
  const e={id,...input,ruleVersion:1,status:'queued',attempts:0,createdAt:now(),updatedAt:now()};
  data.events.push(e);changed(); // Persist intent before any side effect; replay uses the same event id.
  evaluate(e);return e;
 }
 function scan(){
  for(const r of db.residents){const version=profileVersion(r);if(data.profiles[r.id]!==version){data.profiles[r.id]=version;emit({kind:'needs',source:'resident-store',entityId:r.id,residentId:r.id,version})}}
  for(const p of db.policies){const version=policyVersion(p);if(data.policies[p.id]===version)continue;data.policies[p.id]=version;if(p.kind==='publication')emit({kind:'policy',source:'policy-store',entityId:p.id,version});else changed()}
  for(const w of data.watches){const s=viewState(w);if(s.reason){retire(w,'cancelled');continue}
   const signature=hash([s.rule,s.missing.map(f=>f.id)]);if(w.signature!==signature){w.signature=signature;w.generation++;changed()}
   if(s.rule)emit({kind:s.rule,source:'case-store',entityId:w.id,residentId:w.residentId,generation:w.generation,missingHash:hash(s.missing.map(f=>f.id))});else retire(w,'resolved')}
  for(const e of data.events)if(['queued','observed','failed'].includes(e.status))evaluate(e);
  // Logs are bounded; durable watch generations and policy cursors prevent historical replays.
  if(data.events.length>2000){const removable=data.events.filter(e=>['executed','filtered'].includes(e.status)&&!data.watches.some(w=>w.enabled&&w.id===e.entityId));const drop=new Set(removable.slice(0,data.events.length-2000).map(e=>e.id));data.events=data.events.filter(e=>!drop.has(e.id));}
  changed();return{mode:data.mode,checkedAt:now(),events:data.events.length};
 }
 function watch(r,input){const c=(db.agent?.cases||[]).find(c=>c.id===input.caseId&&c.residentId===r.id);if(!c)throw error(404,'只能订阅本人已有事项');
  if(typeof input.enabled!=='boolean'||input.enabled&&input.consent!==true)throw error(400,'开启事项提醒需要本人明确授权');
  let deadline=null;if(input.deadline){if(!/^\d{4}-\d{2}-\d{2}$/.test(input.deadline)||new Date(input.deadline+'T12:00:00Z').toISOString().slice(0,10)!==input.deadline)throw error(400,'准备日期无效');deadline=new Date(input.deadline+'T23:59:59.999+08:00').toISOString()}
  let w=data.watches.find(w=>w.caseId===c.id&&w.residentId===r.id);if(!w){w={id:crypto.randomUUID(),residentId:r.id,caseId:c.id,generation:0,createdAt:now()};data.watches.push(w)}
  retire(w,'cancelled');Object.assign(w,{enabled:input.enabled,deadline,generation:w.generation+1,updatedAt:now()});changed();scan();return{...w,residentId:undefined};
 }
 function mine(r){return{mode:data.mode,watches:data.watches.filter(w=>w.residentId===r.id).map(({residentId,...w})=>w),
  cases:(db.agent?.cases||[]).filter(c=>c.residentId===r.id).map(c=>({id:c.id,title:c.facts?.service?.value||c.serviceContext?.title||'我的办理事项'})),
  notices:data.notices.filter(n=>n.residentId===r.id&&n.status==='open').slice(-50).reverse().map(({residentId,...n})=>n),
  events:data.events.filter(e=>e.residentId===r.id).slice(-50).reverse().map(({residentId,...e})=>e)};}
 function government(){return{mode:data.mode,rules:RULES,events:data.events.slice(-100).reverse().map(({residentId,...e})=>e),tasks:data.tasks.slice(-100).reverse().map(({residentId,...t})=>t),notice:'站内事件规则与跟进记录；未接入正式办件状态，不自动审批、提交或派单。'}}
 function removeResident(id){for(const key of ['watches','events','notices','tasks'])data[key]=data[key].filter(x=>x.residentId!==id);delete data.profiles[id];changed()}
 function simulate(){
  const demoTime=clock(),demoDb={residents:[{id:'example-resident',proactive:true}],policies:[],agent:{cases:[],applications:[]}};
  const demo=createEventCenter({db:demoDb,changed(){},clock:()=>demoTime,discovery:{refresh(){}},send,body,resident});
  for(const [index,days] of [null,1,-1].entries()){
   const c={id:'example-case-'+index,residentId:'example-resident',applicationId:'example-form-'+index,revision:1};demoDb.agent.cases.push(c);
   demoDb.agent.applications.push({id:c.applicationId,caseId:c.id,residentId:c.residentId,revision:1,status:'draft',fields:[{id:'needs',label:'服务需要',required:true,value:null}]});
   demo.watch(demoDb.residents[0],{caseId:c.id,enabled:true,consent:true,...days===null?{}:{deadline:new Date(demoTime+days*86400000+8*3600000).toISOString().slice(0,10)}});
  }
  demoDb.policies.push({id:'example-policy',kind:'publication',body:'虚构助餐方案，仅用于隔离演示'});demo.scan();
  const observed=demo.data.events.length;demo.data.mode='auto';demo.scan();
  return{isolated:true,persisted:false,liveModelCalls:0,observed,...demo.government(),notices:demo.data.notices.map(({residentId,...n})=>n)};
 }
 async function handle(req,res,u){const p=u.pathname;if(!p.startsWith('/api/event-center/'))return false;let result;
  if(p==='/api/event-center/government'&&req.method==='GET')result=government();
  else if(p==='/api/event-center/government/simulate'&&req.method==='POST')result=simulate();
  else if(p==='/api/event-center/government/mode'&&req.method==='POST'){const a=await body(req);if(!['observe','auto'].includes(a.mode)||a.confirm!==true)throw error(400,'请确认事件运行模式');data.mode=a.mode;changed();scan();result=government()}
  else if(p==='/api/event-center/government/scan'&&req.method==='POST')result=scan();
  else if(/^\/api\/event-center\/government\/tasks\/[\w-]+$/.test(p)&&req.method==='POST'){
   const a=await body(req),t=data.tasks.find(t=>t.id===p.split('/').at(-1));if(!t)throw error(404,'待办不存在');
   if(a.confirm!==true||!({pending:['accepted'],accepted:['completed']}[t.state]||[]).includes(a.state))throw error(409,'请依次确认认领及处理完成');
   t.state=a.state;t.history.push({state:a.state,at:now()});if(a.state==='completed'&&t.watchId){const w=data.watches.find(w=>w.id===t.watchId);if(w){w.enabled=false;retire(w,'resolved')}}changed();result={ok:true};
  }else if(p==='/api/event-center/me'&&req.method==='GET')result=mine(resident(req));
  else if(p==='/api/event-center/me/watch'&&req.method==='POST')result=watch(resident(req),await body(req));
  else if(/^\/api\/event-center\/me\/notices\/[\w-]+\/read$/.test(p)&&req.method==='POST'){const r=resident(req),n=data.notices.find(n=>n.id===p.split('/').at(-2)&&n.residentId===r.id);if(!n)throw error(404,'提醒不存在');n.readAt=now();changed();result={ok:true}}
  else throw error(404,'事件操作不存在');send(res,200,result);return true;
 }
 return{scan,watch,mine,government,handle,removeResident,simulate,data};
};
