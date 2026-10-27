'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),makeDiscovery=require('../server/agent/service-discovery.cjs'),{detect,statedRegion}=makeDiscovery,create=require('../server/agent/server.cjs'),{ModelProvider}=require('../server/agent/llm.cjs'),{createDiscovery:catalogDiscovery,loadCatalog}=require('../server/policy-discovery.cjs'),docs=require('../server/agent/documents.cjs');
const answer=text=>({output:[{type:'message',content:[{type:'output_text',text}]}]}),tool=(name,args)=>({type:'function_call',name,arguments:JSON.stringify(args),call_id:name,id:name});
function setup({district='暂未提供',failSearch=false,failModel=false}={}){
 const requests=[],url='https://www.gov.cn/test-school-guide',provider=new ModelProvider({fetchImpl:async(endpoint,options)=>{const body=JSON.parse(options.body);requests.push({endpoint,body});if(endpoint.endsWith('/tools/search')){if(failSearch)throw Error('test search unavailable');return{ok:true,json:async()=>({results:[{url,title:'官方指南（测试）'},{url:'https://gov.cn.evil.com/fake',title:'伪造'}]})}}if(failModel)throw Error('test model unavailable');return{ok:true,json:async()=>answer('已整理相关事项，可以选择虚拟办理。')}}});provider.key='unit-test-only';
 const a={id:'a',displayName:'林**',age:60,job:'退休居民',district,proactive:true,facts:{}},b={...a,id:'b',facts:{}},db={residents:[a,b],policies:[],messages:[]},deps={db,changed(){},send(res,status,value){res.status=status;res.value=value},body:async req=>req.payload,resident:req=>db.residents.find(r=>r.id===req.headers.authorization),eligible:()=>({ok:true})},catalog=catalogDiscovery(deps),service=create(deps,{provider,getDiscovery:()=>catalog,documentOptions:{lookup:async()=>[{address:'1.2.3.4'}],fetchImpl:async()=>new Response('<title>学校服务指南（测试）</title><p>课后服务需要自愿参加，学校核实时间、课程和费用。学生资助需向本地教育部门核实家庭经济情况等条件。</p>',{headers:{'content-type':'text/html;charset=utf-8'}})}});
 const chat=(message,extra={})=>service.chat(a,{channel:'services',allowLLM:true,message,...extra}),request=async(path,payload,who='a')=>{const res={};await service.handle({method:payload?'POST':'GET',headers:{authorization:who},payload},res,new URL(path,'http://localhost'));return res};return{a,b,db,service,chat,request,requests};
}
test('life event recognition distinguishes enrolled children from planned enrollment without assuming an age',()=>{
 for(const text of ['我儿子上小学了，有什么政策和办理推荐一下','我女儿已经在上小学了','我们家孩子上小学了'])assert.equal(detect(text).phase,'enrolled');
 for(const text of ['我儿子明年上小学，有什么推荐','我家孩子准备上小学','我女儿还没入学，想了解小学入学报名'])assert.equal(detect(text).phase,'planned');
 for(const text of ['我没有孩子，介绍小学老师的工作','假如我儿子上小学了','朋友的儿子上小学了','我不是小学学生','我没有失业'])assert.equal(detect(text),null);
 assert.equal(detect('我刚失业了，有什么政策').event,'employment');assert.equal(detect('我母亲独居，需要照护').subject,'family');assert.equal(detect('我有抑郁症，有什么支持').event,'mental-support');
 assert.equal(statedRegion('我在杭州市西湖区'), '杭州市西湖区');assert.equal(statedRegion('杭州市西湖区'),'杭州市西湖区');
});
test('school requests automatically search and read official sources, present useful matters, and cache repeat research',async()=>{
 const s=setup(),r=await s.chat('我儿子上小学了，有什么政策和办理推荐一下',{requestId:'first'}),p=r.case.recommendations;
 assert.equal(p.subject,'family');assert.equal(p.region,null);assert.equal(p.localRulesVerified,false);assert.equal(p.research.status,'read');assert.deepEqual(p.items.map(x=>x.id),['school-aftercare','school-status','school-aid']);assert.ok(p.items.every(x=>x.virtual&&x.sources.every(y=>docs.official(y.url))));assert.ok(!p.items.some(x=>x.id==='school-enrollment'));assert.match(p.items.find(x=>x.id==='school-aid').condition,/不代表已经符合/);assert.equal(r.case.application,null);
 assert.equal(s.requests.filter(x=>x.endpoint.endsWith('/tools/search')).length,1);assert.ok(!s.requests[0].body.query.includes('儿子'));assert.ok(!s.requests[0].body.query.includes('林'));assert.equal(p.research.sources.length,1);assert.ok(!JSON.stringify(p).includes('evil.com'));assert.ok(!('excerpt' in p.research.sources[0]));const input=JSON.parse(s.requests[1].body.input[0].content);assert.match(input.case.recommendations.research.sources[0].excerpt,/家庭经济情况/);
 await s.chat('还有哪些需要注意的',{caseId:r.case.id});assert.equal(s.requests.filter(x=>x.endpoint.endsWith('/tools/search')).length,1);
 const replay=await s.chat('我儿子上小学了，有什么政策和办理推荐一下',{caseId:r.case.id,requestId:'first'});assert.equal(replay.replayed,true);assert.equal(s.requests.length,3);
});
test('locality answers trigger regional research and planned enrollment uses appropriate matters',async()=>{
 const s=setup(),r=await s.chat('我儿子明年上小学，有什么政策推荐？');assert.ok(r.case.recommendations.items.some(x=>x.id==='school-enrollment'));assert.ok(!r.case.recommendations.items.some(x=>x.id==='school-status'));
 const next=await s.chat('杭州市西湖区',{caseId:r.case.id});assert.equal(next.case.recommendations.region,'杭州市西湖区');assert.equal(next.case.draft.fields.find(f=>f.id==='district').value,'杭州市西湖区');assert.match(s.requests.filter(x=>x.endpoint.endsWith('/tools/search')).at(-1).body.query,/杭州市西湖区/);assert.match(s.requests[0].body.query,new RegExp(String(new Date().getFullYear()+1)));assert.equal(next.case.recommendations.localRulesVerified,false);
});
test('failed search retains real catalog evidence and never fabricates a successful lookup',async()=>{
 const s=setup({failSearch:true}),r=await s.chat('我儿子上小学了');assert.equal(r.case.recommendations.research.status,'failed');assert.equal(r.case.recommendations.items.length,3);assert.match(r.case.recommendations.research.notice,/暂未成功/);assert.equal(r.case.recommendations.research.sources.length,0);
});
test('unread candidates and an exhausted search budget cannot become verified local rules',async()=>{
 const c={facts:{},sources:[]},d=makeDiscovery({catalog:loadCatalog,search:async()=>({sources:[{url:'https://www.gov.cn/unread'}]}),read:async()=>{throw Error('blocked')}});await d.discover(c,'我儿子上小学了');assert.equal(c.recommendations.research.status,'unread');assert.equal(c.recommendations.research.sources.length,0);assert.equal(c.recommendations.localRulesVerified,false);
 const x=makeDiscovery({catalog:loadCatalog,search:async()=>null,read:async()=>{throw Error('never')}});await x.discover(c,'我儿子准备上小学',{force:true});assert.equal(c.recommendations.research.status,'deferred');
});
test('virtual entry reuses known city but does not turn a parent into the pupil or infer child identity or consent',async()=>{
 const s=setup({district:'杭州市西湖区'}),root=(await s.chat('我儿子上小学了，有什么政策推荐')).case;
 const path='/api/agent/desk/'+root.id+'/matters/school-aftercare/prepare';await assert.rejects(s.request(path,{},'b'),e=>e.status===404);await assert.rejects(s.request('/api/agent/desk/'+root.id+'/matters/school-enrollment/prepare',{}),e=>e.status===404);
 const child=(await s.request(path,{})).value.case,a=child.application;assert.equal(a.status,'ready');assert.equal(child.recommendationParentId,root.id);assert.equal(a.fields.find(f=>f.id==='service').value,'课后服务意愿登记');assert.equal(a.fields.find(f=>f.id==='district').value,'杭州市西湖区');assert.equal(a.fields.find(f=>f.id==='age').value,'60');assert.equal(a.fields.find(f=>f.id==='occupation').value,'退休居民');assert.match(a.fields.find(f=>f.id==='beneficiary').value,/家庭成员.*未核实/);assert.ok(!JSON.stringify(a).includes('已获授权'));assert.ok(!a.fields.some(f=>/孩子年龄|学生姓名|身份证号/.test(f.label)));assert.equal(s.service.data.applications.filter(a=>a.status==='submitted').length,0);
 const receipt=(await s.request('/api/agent/applications/'+a.id+'/submit',{revision:a.revision,userConfirmed:true})).value;assert.equal(receipt.application.status,'submitted');assert.ok(receipt.application.receipt.virtual);
 const resumed=(await s.request('/api/agent/desk/'+root.id+'/resume',{})).value.case;assert.equal(resumed.id,root.id);assert.equal(resumed.recommendations.items.length,3);assert.equal((await s.request(path,{})).value.case.application.id,a.id);assert.equal(s.requests.filter(x=>x.endpoint.endsWith('/tools/search')).length,1);
});
test('missing locality keeps virtual submission disabled until chat supplies it and refreshed drafts reject stale revisions',async()=>{
 const s=setup(),root=(await s.chat('我儿子上小学了')).case,child=(await s.request('/api/agent/desk/'+root.id+'/matters/school-status/prepare',{})).value.case;assert.deepEqual(child.application.missing.map(f=>f.id),['district']);await assert.rejects(s.request('/api/agent/applications/'+child.application.id+'/submit',{revision:child.application.revision,userConfirmed:true}),e=>e.status===400);
 const updated=await s.chat('我在杭州市西湖区',{caseId:child.id});assert.equal(updated.case.application.status,'ready');assert.equal(updated.case.application.fields.find(f=>f.id==='service').value,'学籍信息核对咨询');await assert.rejects(s.request('/api/agent/applications/'+child.application.id+'/submit',{revision:child.application.revision,userConfirmed:true}),e=>e.status===409);
});
test('a new life event gets its own case after application, retries remain idempotent and model errors roll back research',async()=>{
 const s=setup({district:'杭州市西湖区'}),c=s.service.desk.create(s.a);s.service.desk.apply(c,[{key:'service',value:'助餐',evidence:'助餐'}],'助餐');s.service.desk.applications.prepare(s.a,c);
 const r=await s.chat('我儿子上小学了',{caseId:c.id,requestId:'redirect'}),n=s.requests.length;assert.notEqual(r.case.id,c.id);assert.equal(r.case.application,null);const replay=await s.chat('我儿子上小学了',{caseId:c.id,requestId:'redirect'});assert.equal(replay.case.id,r.case.id);assert.equal(replay.replayed,true);assert.equal(s.requests.length,n);
 const failed=setup({failModel:true});await assert.rejects(failed.chat('我儿子上小学了，我在杭州市西湖区'),/test model/);assert.equal(failed.service.data.cases[0].recommendations,undefined);assert.equal(failed.service.data.cases[0].facts.district,undefined);assert.equal(failed.service.data.cases[0].sources.length,0);
});
test('government HTML declared GBK/GB2312 is decoded before evidence matching',async()=>{
 const bytes=Buffer.concat([Buffer.from('<meta charset="gb2312"><title>'),Buffer.from([0xd6,0xd0,0xce,0xc4]),Buffer.from('</title>')]);assert.match(docs.decodeHTML(bytes),/中文/);assert.match(docs.decodeHTML(Buffer.from([0xd6,0xd0,0xce,0xc4]),'text/plain;charset=gbk'),/中文/);assert.equal(docs.decodeHTML(Buffer.from('okay'),'charset=unknown-test-encoding'),'okay');
 const d=await docs.retrieve('https://www.gov.cn/test',{lookup:async()=>[{address:'1.2.3.4'}],fetchImpl:async()=>new Response(bytes,{headers:{'content-type':'text/html;charset=gb2312'}})});assert.equal(d.title,'中文');assert.equal(d.text,'中文');
});
