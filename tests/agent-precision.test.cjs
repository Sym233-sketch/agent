'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{PolicyIndex,passages,indexFor}=require('../server/policy-retrieval.cjs'),{loadCatalog}=require('../server/policy-discovery.cjs'),createReview=require('../server/agent/review.cjs'),{locate,sensitiveChange,windows}=createReview,{validate}=require('../server/agent/fact-provenance.cjs'),{state}=require('../server/agent/conversation-state.cjs'),{ModelProvider,run,schema}=require('../server/agent/llm.cjs'),{audit}=require('../server/agent/tools.cjs');
test('Chinese natural-language recall ranks services, preserves exact passages and never asserts local eligibility',()=>{
 const index=new PolicyIndex(loadCatalog());for(const [q,key]of [['孩子放学没人接','school-aftercare'],['幼升小报名材料','school-enrollment-2026'],['学生资助','school-finance-2026'],['学籍信息更正','school-status-2025'],['请不起律师','legal-aid'],['老人做不了饭','basic-elder-services']]){const r=index.search(q,{limit:3,region:'杭州市'});assert.equal(r[0].document.key,key,q);assert.ok(r.every(x=>x.region!=='verified'));for(const hit of r)for(const p of hit.passages)assert.equal(hit.document.text.slice(p.start,p.end),p.text)}
 assert.equal(index.search('qwertyunfindablezz').length,0);assert.equal(indexFor(index.documents),indexFor(index.documents));
 const p=passages('导航信息\n'.repeat(3000)+'课后服务遵循自愿参加原则。\n尾部', '孩子放学没人接');assert.ok(p.some(x=>x.text.includes('自愿参加')));assert.ok(p[0].start>10000);
});
test('inverted index pagination retains totals and applies filters before cutting a page',()=>{
 const docs=Array.from({length:250},(_,i)=>({key:'d'+i,title:'小学课后服务 '+i,text:'课后服务自愿登记，学校提供课程安排。',domain:i%2?'education':'elder',issued:i%2?'2026-01-01':'2027-01-01'})),index=new PolicyIndex(docs),r=index.search('课后服务',{offset:110,limit:6,accept:d=>d.domain==='education',asOf:'2026-10-27'});assert.equal(r.total,125);assert.equal(r.length,6);assert.ok(r.every(x=>x.document.domain==='education'));assert.equal(index.search('',{offset:249,limit:6}).total,250);
});
test('semantic edits require exact location, repeated quotes need offsets, and substantive changes never become one-click fixes',()=>{
 assert.equal(locate('按排，按排','按排',null),null);assert.equal(locate('按排，按排','按排',3),3);assert.equal(locate('正确按排','按排',99),2);assert.equal(locate('按排','伪造',0),null);
 assert.equal(sensitiveChange('统一按排','统一安排'),null);for(const [a,b]of [['补助100元','补助1000元'],['年满60岁','年满50岁'],['不得收费','可以收费'],['面向居民','仅限本地户籍居民']])assert.ok(sensitiveChange(a,b));
});
function reviewModel(fn){const calls=[],provider=new ModelProvider({fetchImpl:async(url,opts)=>{const body=JSON.parse(opts.body),context=JSON.parse(body.input[0].content);calls.push(context);const done=body.input.some(x=>x.type==='function_call_output');return{ok:true,json:async()=>done?{output:[{type:'message',content:[{type:'output_text',text:'本段核查完成，政策实质仍需核实。'}]}]}:fn(context)}}});provider.key='unit-test-only';return{calls,review:createReview({provider,run,schema,audit})}}
const editCall=edits=>({output:[{type:'function_call',id:'f',call_id:'c',name:'record_edit_suggestions',arguments:JSON.stringify({edits})}]});
test('long semantic review covers beyond the former 20000-character cutoff with immutable file offsets',async()=>{
 const text='正文内容保持一致。\n'.repeat(2300)+'最后一段统一按排。',s=reviewModel(c=>{const offset=c.text.indexOf('按排');return editCall(offset<0?[]:[{quote:'按排',replacement:'安排',reason:'常见错字',offset}])}),r=await s.review({documents:[{id:'doc',name:'长稿',text}]});assert.ok(r.languageReview.coverage.complete);assert.equal(r.languageReview.coverage.reviewedCharacters,text.length);assert.ok(r.edits.some(e=>e.offset>20000&&e.fileId==='doc'&&text.slice(e.offset,e.offset+e.quote.length)===e.quote));assert.ok(s.calls.every(c=>c.text.length<=8000));
});
test('ambiguous and invented edits are rejected while money and eligibility edits are flagged for verification',async()=>{
 const s=reviewModel(()=>editCall([{quote:'按排',replacement:'安排',reason:'ambiguous',offset:null},{quote:'原文没有',replacement:'新句子',reason:'fabricated',offset:null},{quote:'每人100元',replacement:'每人1000元',reason:'提高标准',offset:null}])),r=await s.review({text:'统一按排。再次按排。每人100元。'});assert.equal(r.edits.length,1);assert.equal(r.edits[0].safeToApply,false);assert.ok(r.edits[0].requiresVerification);assert.equal(r.languageReview.rejectedSuggestions,2);
});
test('coverage reports bounded and failed chunks honestly; no key triggers no semantic calls',async()=>{
 const parts=windows([{id:'d',text:'甲'.repeat(120000)}]);assert.equal(parts.length,12);const s=reviewModel(c=>{if(c.file.start>0)throw Error('mock failure');return editCall([])}),r=await s.review({documents:[{id:'d',text:'甲'.repeat(10000)}]});assert.equal(r.languageReview.status,'partial');assert.ok(!r.languageReview.coverage.complete);assert.ok(r.languageReview.coverage.failedChunks>0);
 const no=createReview({provider:{key:''},run:()=>{throw Error('No live requests')},schema,audit});assert.equal((await no({text:'统一按排'})).languageReview.status,'not_configured');
});
test('filling facts rejects hypotheses, questions, other people and obsolete values while allowing grounded corrections',()=>{
 for(const f of [{key:'income',value:'3000元',evidence:'假设我收入3000元'},{key:'occupation',value:'教师',evidence:'我儿子是教师'},{key:'income',value:'3000元',evidence:'收入证明是不是填3000元？'},{key:'district',value:'杭州市',evidence:'杭州市改成宁波市'}])assert.throws(()=>validate(f));
 for(const f of [{key:'income',value:'没有稳定收入',evidence:'我没有稳定收入'},{key:'district',value:'宁波市',evidence:'地区改成宁波市'},{key:'occupation',value:'教师',evidence:'我本人是教师'},{key:'needs',value:'假如我有收入怎么办',evidence:'假如我有收入怎么办'}])assert.doesNotThrow(()=>validate(f));
});
test('conversation state respects explain-only and declined questions rather than repeatedly collecting fields',()=>{
 const c={facts:{income:{value:'3000元',source:'self-report',evidence:'我收入3000元'}},messages:[{role:'user',text:'收入我不想说，删除吧。'}],recommendations:{},application:{missing:[{id:'income'},{id:'district'}]}};
 const r=state(c,'先帮我看看有什么支持');assert.ok(r.declinedFields.includes('income'));assert.equal(r.nextQuestion.field,'district');assert.equal(state(c,'只想了解，暂时不办').questionLimit,0);assert.equal(state(c,'先暂停，不聊了').questionLimit,0);assert.equal(state(c,'我很难受，最近一直失眠').tone,'gentle-and-practical');
});
test('publicly searched official pages enter explicit retrieval without becoming unsolicited policy pushes',async()=>{
 const {createDiscovery}=require('../server/policy-discovery.cjs'),db={residents:[],policies:[],messages:[]},r={id:'a',proactive:true,facts:{needLife:true},job:'企业职员'},service=createDiscovery({db,changed(){},resident:()=>r,body:async req=>req.payload,send(res,status,value){res.status=status;res.value=value}});
 db.agent.documents.push({id:'public-web',url:'https://www.gov.cn/zhengce/test-only-precision',title:'公开政策检索测试夹具',text:'独特检索词：竹林助学服务。此处仅为回归测试夹具。',verification:'已读取政府网页（测试）',publicSource:true},{id:'direct-read',url:'https://www.gov.cn/user-provided-document',title:'直接提供链接的测试文件',text:'不应跨用户索引的私密检索词',verification:'用户提供链接，公开性未确认'});
 let found=service.retrieve('竹林助学服务');assert.ok(found.some(x=>x.document.id==='public-web'));assert.ok(!service.retrieve('私密检索词').some(x=>x.document.id==='direct-read'));assert.ok(!service.ranked(r).some(x=>x.id==='public-web'));const key=found.find(x=>x.document.id==='public-web').document.key;
 const res={};await service.handle({method:'GET'},res,new URL('/api/policy-search/'+key,'http://localhost'));assert.equal(res.status,200);assert.match(res.value.text,/竹林助学/);
 db.agent.documents.find(d=>d.id==='public-web').text='新的公开政策词：青松补助登记。';found=service.retrieve('青松补助登记');assert.ok(found.some(x=>x.document.id==='public-web'));assert.equal(service.retrievalStats.documents,service.catalog.length+1);
});
test('overlapping semantic windows cannot offer conflicting replacements as directly applicable edits',async()=>{
 const text='甲'.repeat(7900)+'用语不当'+'乙'.repeat(900),s=reviewModel(c=>{const offset=c.text.indexOf('用语不当');return editCall(offset<0?[]:[{quote:'用语不当',replacement:c.file.start?'文字明确':'用词清楚',reason:'测试冲突',offset}])}),r=await s.review({documents:[{id:'conflict',text}]});assert.equal(r.edits.length,2);assert.ok(r.edits.every(e=>!e.safeToApply&&e.requiresVerification.includes('不同修改建议')));
});
test('article extraction removes navigation and keeps nested paragraphs; source truncation is explicit',async()=>{
 const {articleHTML}=require('../server/agent/html-evidence.cjs'),docs=require('../server/agent/documents.cjs'),body='课后服务遵循自愿参加原则。'.repeat(20),html='<nav>与政策无关的导航</nav><div class="TRS_Editor"><p>'+body+'</p><div>内层正文保持完整。</div></div><footer>友情链接</footer>',article=articleHTML(html);assert.equal(article.scope,'article');assert.ok(article.html.includes('内层正文'));assert.ok(!article.html.includes('导航'));assert.ok(!article.html.includes('友情链接'));assert.equal(articleHTML('<article>未闭合内容').scope,'page');
 const r=await docs.retrieve('https://www.gov.cn/zhengce/test',{lookup:async()=>[{address:'1.2.3.4'}],fetchImpl:async()=>new Response('<article>'+body.repeat(200)+'</article>',{headers:{'content-type':'text/html'}})});assert.equal(r.readingScope,'article');assert.equal(r.truncated,true);assert.equal(r.text.length,35000);assert.ok(r.sourceCharacters>r.text.length);
});
test('the real desk rejects ungrounded personal fields atomically before they reach virtual forms',()=>{
 const create=require('../server/agent/server.cjs'),r={id:'applicant',displayName:'林**',job:'暂未提供',district:'暂未提供',facts:{}},db={residents:[r],policies:[],messages:[]},service=create({db,changed(){},send(){},body(){},resident:()=>r,eligible:()=>({ok:true})},{provider:{key:'',provider:'deepseek'}}),c=service.desk.create(r);
 assert.throws(()=>service.desk.apply(c,[{key:'district',value:'杭州市西湖区',evidence:'杭州市西湖区'},{key:'income',value:'3000元',evidence:'收入证明填3000元吗？'}],'杭州市西湖区，收入证明填3000元吗？'),/提问/);assert.equal(c.facts.district,undefined);assert.equal(c.facts.income,undefined);assert.equal(c.revision,0);
 assert.throws(()=>service.desk.apply(c,[{key:'occupation',value:'教师',evidence:'我儿子是教师'}],'我儿子是教师'),/家属/);assert.throws(()=>service.desk.apply(c,[{key:'income',value:'未知',evidence:'收入未知'}],'收入未知'),/未知/);
});
