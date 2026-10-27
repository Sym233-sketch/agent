'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),create=require('../server/agent/contextual-care.cjs');
const {detect,validate}=create;
test('repeated material questions reveal friction without requiring an explicit request for help',()=>{
 assert.equal(detect(['申请表怎么填？']).length,0);
 assert.equal(detect(['材料有哪些？','证明去哪里开？']).length,0);
 assert.equal(detect(['申请表怎么填？','这个证明还是不明白怎么开。'])[0].kind,'paperwork');
 assert.equal(detect(['要准备什么材料？','复印件需要几份？','材料交到哪里？'])[0].kind,'paperwork');
 assert.equal(detect(['我退休了，今年70岁。','我离婚了。']).length,0);
 assert.equal(detect(['我朋友最近失眠。','我朋友什么都不想做。']).length,0);
 assert.equal(detect(['最近睡不好。','白天什么都不想做。'])[0].kind,'emotional');
});
test('model proposals require distinct user turns and can never persist diagnostic categories',()=>{
 assert.throws(()=>validate({kind:'depression',evidence:['睡不好','不想动']},['睡不好','不想动']),/两轮/);
 assert.throws(()=>validate({kind:'emotional',evidence:['睡不好','睡不好']},['一直睡不好']),/不同轮次/);
 assert.throws(()=>validate({kind:'emotional',evidence:['睡不好','凭空编造']},['睡不好','不想动']),/不同轮次/);
 assert.equal(validate({kind:'emotional',evidence:['睡不好','不想动']},['睡不好','不想动']).kind,'emotional');
});
function fixture(){
 const r={id:'a',displayName:'林**',facts:{}},other={id:'b'},c={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',residentId:'a',facts:{district:{value:'杭州市西湖区'}},messages:[]};
 const data={cases:[c],handoffs:[]},db={residents:[r,other]},pages=[],provider={key:'test-only'},deps={data,db,provider,changed(){},schema:(name,description,properties)=>({name,description,properties}),redact:s=>String(s).replace(/\d{11,}/g,'[号码已省略]'),fetchDocument:async url=>{pages.push(url);return{url,title:'社区帮办服务（测试夹具）',text:'请向所在社区核实服务时间和费用。',retrievedAt:'2026-10-27'}},run:async(p,args)=>{deps.last=args;return{answer:'我先帮你把材料分清楚。',trace:[]}}};
 const service=create(deps),request=async(path,payload,who=r)=>{const res={};await service.handle({method:payload?'POST':'GET',payload},res,new URL(path,'http://localhost'),{resident:()=>who,body:async req=>req.payload,send:(res,status,value)=>Object.assign(res,{status,value})});return res.value};
 const base=()=>({chat:async(r,input)=>{const result=await service.run(provider,{instructions:'办事助手',input:{message:input.message,case:{id:c.id},history:c.messages},tools:[],execute:async()=>({})});c.messages.push({role:'user',text:input.message});return{...result,case:{id:c.id}}}}),desk=service.wrapDesk(base());
 return{r,other,c,data,db,deps,service,request,desk,pages};
}
test('offers are generated after successful turns, explanations stay scoped, and declines and pause persist',async()=>{
 const f=fixture();await f.desk.chat(f.r,{message:'申请表怎么填？'});assert.equal((await f.request('/api/agent/care')).offers.length,0);
 const result=await f.desk.chat(f.r,{message:'证明还是不明白怎么开。'}),o=result.care.offers[0];assert.equal(o.kind,'paperwork');assert.equal(f.data.handoffs.length,0);assert.equal(f.deps.last.input.possibleSupportNeeds[0].kind,'paperwork');
 assert.equal((await f.request('/api/agent/care',undefined,f.other)).offers.length,0);
 await assert.rejects(f.request('/api/agent/care/'+f.c.id+'/'+o.id+'/choice',{choice:'wrong'},f.other),e=>e.status===404);
 await f.request('/api/agent/care/'+f.c.id+'/'+o.id+'/choice',{choice:'wrong'});assert.equal(o.evidence.length,0);
 assert.equal((await f.desk.chat(f.r,{message:'材料又退回了。'})).care.offers.length,0);
 await f.request('/api/agent/care/'+f.c.id,{paused:true});assert.equal(f.c.supportCare.paused,true);
 await f.desk.chat(f.r,{message:'材料还是看不懂。'});assert.equal(f.deps.last.input.supportSuggestionsPaused,true);
});
test('no failed turn or declined mental-support preference creates a care record',async()=>{
 const f=fixture();f.r.facts.mentalSupportDeclined=true;f.c.messages=[{role:'user',text:'最近睡不好。'}];assert.equal((await f.desk.chat(f.r,{message:'每天都提不起劲。'})).care.offers.length,0);
 const g=fixture();g.c.messages=[{role:'user',text:'材料怎么开？'}];g.deps.run=undefined;
 const bad=g.service.wrapDesk({chat:async()=>{throw Error('模型失败')}});await assert.rejects(bad.chat(g.r,{message:'材料还是不懂'}),/模型失败/);assert.equal(g.c.supportCare,undefined);
});
test('contact preparation requires reviewed sources and explicit confirmation and never dispatches externally',async()=>{
 const f=fixture();f.c.messages=[{role:'user',text:'材料怎么开？'}];const {care}=await f.desk.chat(f.r,{message:'材料还是不懂。'}),o=care.offers[0],path='/api/agent/care/'+f.c.id+'/'+o.id+'/prepare';
 await assert.rejects(f.request(path,{confirm:false,summary:'请帮忙理材料',preference:'phone'}),e=>e.status===400);
 await assert.rejects(f.request(path,{confirm:true,summary:'请帮忙理材料',preference:'phone'}),e=>e.status===409);
 o.options={region:'杭州市西湖区',sources:[{title:'已读取官方资料（测试）',url:'https://www.gov.cn/test-only'}]};
 const a=await f.request(path,{confirm:true,summary:'只分享这个办理需要',preference:'phone'});assert.equal(a.task.delivery,'local_queue_only');assert.equal(a.task.reason,'只分享这个办理需要');assert.ok(!JSON.stringify(a.task).includes('还是不懂'));assert.match(a.message,/尚未联系/);assert.equal(f.data.handoffs.length,1);
 await assert.rejects(f.request(path,{confirm:true,summary:'再提交',preference:'phone'}),e=>e.status===409);
});
