'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),create=require('../server/event-center.cjs');
function fixture(){let time=Date.parse('2026-11-03T04:00:00Z');const r={id:'r1',proactive:true},c={id:'c1',residentId:r.id,applicationId:'a1',revision:1};
 const db={residents:[r],policies:[],agent:{cases:[c],applications:[{id:'a1',caseId:c.id,residentId:r.id,revision:1,status:'draft',fields:[{id:'needs',label:'服务需要',required:true,value:null}]}]}};
 let refreshes=0,saves=0;const args={db,changed:()=>saves++,clock:()=>time,discovery:{refresh:()=>refreshes++},resident:req=>{const person=db.residents.find(r=>r.id===req.who);if(!person)throw Object.assign(Error('身份无效'),{status:401});return person},body:async req=>req.input,send:(res,status,value)=>Object.assign(res,{status,value})};
 const center=create(args);return{center,db,r,c,args,get refreshes(){return refreshes},get saves(){return saves},advance:ms=>time+=ms,request:async(path,input,who='r1',method=input===undefined?'GET':'POST')=>{const res={};await center.handle({method,input,who},res,new URL(path,'http://test'));return res}};
}
const subscribe=h=>h.center.watch(h.r,{caseId:'c1',enabled:true,consent:true});
test('observation records a decision but creates no side effect; auto rechecks it and restart never duplicates',()=>{
 const h=fixture();subscribe(h);assert.equal(h.center.data.events.length,1);assert.equal(h.center.data.events[0].status,'observed');assert.equal(h.center.data.notices.length,0);
 h.center.data.mode='auto';h.center.scan();assert.equal(h.center.data.notices.length,1);assert.equal(h.center.data.events[0].status,'executed');
 const persisted=JSON.parse(JSON.stringify(h.db));const restarted=create({...h.args,db:persisted});restarted.scan();restarted.scan();assert.equal(restarted.data.notices.length,1);assert.equal(restarted.data.events.length,1);
});
test('authorization, ownership and withdrawal are checked again before acting on observed work',()=>{
 const h=fixture();assert.throws(()=>h.center.watch({id:'another'},{caseId:'c1',enabled:true,consent:true}),/本人/);assert.throws(()=>h.center.watch(h.r,{caseId:'c1',enabled:true}),/授权/);
 subscribe(h);h.center.watch(h.r,{caseId:'c1',enabled:false});h.center.data.mode='auto';h.center.scan();assert.equal(h.center.data.notices.length,0);assert.equal(h.center.data.events[0].status,'filtered');
 assert.throws(()=>h.center.watch(h.r,{caseId:'c1',enabled:true,consent:true,deadline:'2026-02-30'}),/日期/);
});
test('time itself produces due and overdue triggers, prioritizes one reminder, and creates one follow-up task',()=>{
 const h=fixture();h.center.data.mode='auto';h.center.watch(h.r,{caseId:'c1',enabled:true,consent:true,deadline:'2026-11-05'});
 assert.equal(h.center.mine(h.r).notices[0].title,'准备期限临近');h.advance(3*86400000);h.center.scan();h.center.scan();
 assert.equal(h.center.mine(h.r).notices.length,1);assert.equal(h.center.mine(h.r).notices[0].title,'准备期限已过');assert.equal(h.center.data.tasks.length,1);
 assert.match(h.center.mine(h.r).notices[0].boundary,/不是正式/);
});
test('material corrections and virtual submission invalidate stale observations without auto-submitting anything',()=>{
 const h=fixture();subscribe(h);h.db.agent.applications[0].fields[0].value='希望了解助餐';h.center.data.mode='auto';h.center.scan();assert.equal(h.center.data.notices.length,0);assert.equal(h.center.data.events[0].status,'filtered');
 h.db.agent.applications[0].fields[0].value=null;h.center.scan();assert.equal(h.center.data.notices.length,1);
 h.db.agent.applications[0].status='submitted';h.center.scan();assert.equal(h.center.mine(h.r).notices.length,0);assert.equal(h.db.agent.applications[0].status,'submitted');
});
test('new policy and version events are durable, historical imports are quiet, custom drafts never auto-deliver',()=>{
 const h=fixture();h.db.policies.push({id:'p1',kind:'publication',body:'助餐方案',catalogKey:'elder',officialSource:'https://test.gov.cn/p'});h.center.scan();assert.equal(h.refreshes,0);
 h.r.proactive=false;h.center.data.mode='auto';h.center.scan();assert.equal(h.refreshes,0);
 h.r.proactive=true;h.db.policies[0].body='修订的助餐方案';h.center.scan();assert.equal(h.refreshes,2);
 h.db.policies.push({id:'p2',kind:'publication',body:'人工确认发布的自定义方案',workflow:{revision:1}});h.center.scan();assert.equal(h.refreshes,2);assert.equal(h.db.messages,undefined);
 const legacy={...h.db,eventCenter:undefined};const cold=create({...h.args,db:legacy});cold.scan();assert.equal(cold.data.events.length,0);
});
test('current policy version and stored deadline filter old observations',()=>{
 const h=fixture();h.db.policies.push({id:'p',kind:'publication',body:'旧版本',deadline:'2026-11-01'});h.center.scan();assert.equal(h.center.data.events[0].status,'filtered');
 h.db.policies.push({id:'q',kind:'publication',body:'原稿'});h.center.scan();h.db.policies[1].kind='consultation';h.center.data.mode='auto';h.center.scan();assert.equal(h.center.data.tasks.length,0);
});
test('side-effect failure is retained and retried with consent revalidation, with no model involved',()=>{
 const h=fixture();let calls=0;h.args.discovery.refresh=()=>{calls++;throw Error('network unavailable')};h.center.data.mode='auto';h.db.policies.push({id:'p',kind:'publication',catalogKey:'x',officialSource:'https://test.gov.cn/x',body:'正文'});h.center.scan();
 assert.equal(h.center.data.events[0].status,'failed');h.center.scan();assert.equal(calls,1);h.r.proactive=false;h.advance(10000);h.center.scan();assert.equal(calls,1);assert.equal(h.center.data.events[0].status,'executed');
});
test('resident read and task transitions enforce ownership, confirmation and order; deletion purges event data',async()=>{
 const h=fixture();h.center.data.mode='auto';h.center.watch(h.r,{caseId:'c1',enabled:true,consent:true,deadline:'2026-11-01'});const t=h.center.data.tasks[0],n=h.center.data.notices[0];
 h.db.residents.push({id:'r2'});assert.equal((await h.request('/api/event-center/me',undefined,'r2')).value.notices.length,0);
 await assert.rejects(h.request('/api/event-center/me/notices/'+n.id+'/read',{},'r2'),/不存在/);
 await assert.rejects(h.request('/api/event-center/government/tasks/'+t.id,{state:'completed',confirm:true}),/依次/);
 await h.request('/api/event-center/government/tasks/'+t.id,{state:'accepted',confirm:true});await h.request('/api/event-center/government/tasks/'+t.id,{state:'completed',confirm:true});h.center.scan();assert.equal(h.center.mine(h.r).notices.length,0);
 h.center.removeResident('r1');for(const key of ['events','notices','tasks','watches'])assert.equal(h.center.data[key].filter(x=>x.residentId==='r1').length,0);
});
test('isolated demo covers all four rules without changing production state or calling a model',()=>{
 const h=fixture(),before=JSON.stringify(h.db);const result=h.center.simulate();assert.equal(result.isolated,true);assert.equal(result.liveModelCalls,0);assert.equal(result.events.length,4);assert.equal(result.notices.length,3);assert.equal(result.tasks.length,2);assert.equal(JSON.stringify(h.db),before);
});
test('declined fields do not cause repeated material requests and stale reminders retire',()=>{
 const h=fixture();h.center.data.mode='auto';subscribe(h);assert.equal(h.center.mine(h.r).notices.length,1);
 h.c.memory={declined:{needs:true}};h.center.scan();assert.equal(h.center.mine(h.r).notices.length,0);
});
test('explicit service-need changes refresh recommendations only with current policy-message consent',()=>{
 const h=fixture();h.r.facts={needCare:true};h.center.scan();assert.equal(h.refreshes,0);assert.equal(h.center.data.events[0].kind,'needs');
 h.center.data.mode='auto';h.center.scan();h.center.scan();assert.equal(h.refreshes,1);
 h.r.proactive=false;h.r.facts={needCare:false};h.center.scan();assert.equal(h.refreshes,1);assert.equal(h.center.data.events.at(-1).status,'filtered');
});
