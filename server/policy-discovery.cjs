'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const retrieval=require('./policy-retrieval.cjs');
const CATEGORIES={education:'教育培训',elder:'养老照护',employment:'就业技能',general:'社会救助',mental:'心理支持',accessibility:'无障碍服务',legal:'法律援助'};
const {category,profileScore,topicMatch,interestMatch}=require("../public/policy-matching.js"),guidance=require("./policy-guidance.cjs");
const terms=q=>[...new Set(String(q).trim().toLowerCase().split(/[\s，,、；;]+/).filter(Boolean))].slice(0,8);
function cleanQuery(q){return String(q||'').replace(/\b\d{7,19}\b/g,'[号码已省略]').trim().slice(0,80)}
function queryScore(d,q){const qs=terms(q);if(!qs.length)return 1;const top=d.title+' '+d.summary;let score=0;for(const t of qs){let n=top.toLowerCase().includes(t)?5:d.text.toLowerCase().includes(t)?1:0;if(!n&&topicMatch(category(d),t))n=3;if(!n)return 0;score+=n}return score}
function loadCatalog(root=path.resolve(__dirname,'../resources/national-policies')){return fs.readdirSync(root).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'))).filter(d=>d.key&&d.text&&/^https:\/\/([^/]+\.)?gov\.cn\//.test(d.url)&&crypto.createHash('sha256').update(d.text).digest('hex')===d.sha256)}

function createDiscovery({db,changed,send,body,resident},options={}){
 const catalog=options.catalog||loadCatalog(),index=retrieval.indexFor(catalog),clock=options.clock||Date.now;db.policyInterests||={};
 let searchCache={signature:'',documents:catalog,index};
 function searchable(){
  const extra=(db.agent?.documents||[]).filter(d=>d.publicSource===true&&!d.catalogKey&&d.text&&d.verification&&require('./agent/documents.cjs').official(d.url));
  const signature=extra.map(d=>d.url+':'+(d.sha256||crypto.createHash('sha256').update(d.text).digest('hex'))).join('|');
  if(signature!==searchCache.signature){
   const seen=new Set(catalog.map(d=>d.url)),web=[];for(const d of extra){if(seen.has(d.url))continue;seen.add(d.url);web.push({...d,key:'web-'+crypto.createHash('sha256').update(d.url).digest('hex'),summary:d.summary||d.text.slice(0,260),domain:d.domain||'general',scope:'已读取政府网页，适用地区、时效和资格条件待核实',origin:'official-web',issued:d.issued||null,sha256:d.sha256||crypto.createHash('sha256').update(d.text).digest('hex')})}
   const documents=[...catalog,...web];searchCache={signature,documents,index:new retrieval.PolicyIndex(documents)};
  }return searchCache;
 }
 function prune(){let dirty=false;const now=clock();for(const p of Object.values(db.policyInterests)){const kept=p.events.filter(e=>now-e.at<=90*86400000).slice(-200);if(kept.length!==p.events.length){p.events=kept;dirty=true}}if(dirty)changed();return dirty}
 const preferences=r=>db.policyInterests[r.id]||{enabled:true,events:[],favorites:[],dismissed:[]};
 const metadata=(d,r)=>{const {text,...m}=d,p=preferences(r);return{...m,category:category(d),categoryName:CATEGORIES[category(d)]||'公共政策',favorite:p.favorites.includes(d.key),dismissed:p.dismissed.includes(d.key),guidance:guidance(d)}};
 function ranked(r){const pref=preferences(r),now=clock();return catalog.filter(d=>!d.reviewOnly&&!pref.dismissed.includes(d.key)).map(d=>{
 const c=category(d),base=profileScore(r,d),reasons=[...base.reasons],seen=new Set();let interest=0,explicit=pref.enabled&&pref.favorites.includes(d.key);
 if(pref.enabled){if(explicit){interest=6;reasons.push('你收藏了这份政策')}for(const e of [...pref.events].reverse()){const age=(now-e.at)/86400000;if(age<0||age>90)continue;let w=0;
 if(e.type==='search'&&interestMatch(d,e.query)){w=4;if(age<=30)explicit=true}if(e.key===d.key&&e.type==='view')w=1;if(e.key===d.key&&e.type==='dwell')w=2;if(!w)continue;
 const k=e.type+':'+(e.type==='search'?e.query:e.key);if(seen.has(k))continue;seen.add(k);interest+=w*Math.pow(.5,age/30);const label=e.type==='search'?'你在大厅主动搜索了相关服务':e.type==='view'?'你主动查看过这份政策':'你在大厅阅读过这份政策';if(!reasons.includes(label))reasons.push(label)}}
 const blocked=(c==='employment'&&!base.score&&!explicit)||(c==='mental'&&r.facts?.mentalSupportDeclined===true),score=blocked?0:base.score+Math.min(interest,10);
 return{...metadata(d,r),score:score?Math.round((score+guidance(d).priority)*100)/100:0,reasons,basis:interest>0?'profile-and-interest':'profile',notice:'服务相关线索；资格及本地办理条件待核实'};
 }).filter(d=>d.score>=1).sort((a,b)=>b.score-a.score||a.key.localeCompare(b.key))}
 function selected(r){const all=ranked(r),list=[],categories=new Set();for(const d of all)if(!categories.has(d.category)){list.push(d);categories.add(d.category)}for(const d of all)if(!list.includes(d))list.push(d);return list.slice(0,6)}
 function ensurePolicy(d){let p=db.policies.find(p=>p.catalogKey===d.key&&p.officialSource===d.url);if(!p){p={id:crypto.randomUUID(),catalogKey:d.key,kind:'publication',domain:d.domain,title:d.title,body:d.summary+'\n\n官方来源：'+d.url+'\n发布机关：'+d.issuer+'\n日期：'+d.issued+'\n适用范围：'+d.scope+'\n核验范围：'+d.verification+'\n\n官方网页全文快照：\n'+d.text,officialSource:d.url,sourceIssued:d.issued,sourceIssuer:d.issuer,sourceVerification:d.verification,sourceHash:d.sha256,createdAt:new Date(clock()).toISOString(),audience:'matched',recipientIds:[],guidance:guidance(d)};db.policies.push(p)}return p}
 function refresh(r){if(!r.proactive)return[];const list=selected(r);let dirty=false;for(const d of list){const p=ensurePolicy(catalog.find(x=>x.key===d.key));const existing=db.messages.find(m=>m.residentId===r.id&&m.policyId===p.id),reason=d.reasons.join('；')+'；具体适用条件待核实';if(existing){if(existing.reason!==reason){existing.reason=reason;dirty=true}continue}db.messages.push({id:crypto.randomUUID(),residentId:r.id,policyId:p.id,createdAt:new Date(clock()).toISOString(),readAt:null,reason,replies:[],automaticPolicyRecommendation:true});dirty=true}if(dirty)changed();return list}
 function visible(r,p){if(!p)return false;if(p.kind==='consultation')return true;if(!r.proactive)return false;const d=catalog.find(d=>d.key===p.catalogKey&&p.officialSource===d.url);if(!d)return false;const list=selected(r);return list.some(x=>x.key===d.key)}
 function record(r,input){const type=input.type;if(!['search','view','dwell','favorite','unfavorite','dismiss','restore'].includes(type))throw Object.assign(Error('不支持的兴趣事件'),{status:400});if(input.source!=='hall'&&input.source!=='policy-search')throw Object.assign(Error('仅记录办事大厅和政策搜索操作'),{status:400});if(!r.proactive)return{recorded:false,reason:'主动政策推荐已暂停'};
  const key=String(input.key||''),query=cleanQuery(input.query);if(type!=='search'&&!searchable().documents.some(d=>d.key===key))throw Object.assign(Error('政策不存在'),{status:404});if(type==='search'&&!query)return{recorded:false};if(type==='dwell'&&(!Number.isFinite(input.seconds)||input.seconds<20||input.seconds>3600))throw Object.assign(Error('阅读时间无效'),{status:400});
  const p=preferences(r);if(!p.enabled&&!['favorite','unfavorite','dismiss','restore'].includes(type))return{recorded:false,reason:'兴趣推荐已关闭'};
  const at=clock(),eventId=String(input.eventId||'').slice(0,80);p.events=p.events.filter(e=>at-e.at<=90*86400000);if(eventId&&p.events.some(e=>e.eventId===eventId))return{recorded:false,duplicate:true};if(type==='favorite')p.favorites=[...new Set([...p.favorites,key])];if(type==='unfavorite')p.favorites=p.favorites.filter(k=>k!==key);if(type==='dismiss')p.dismissed=[...new Set([...p.dismissed,key])];if(type==='restore')p.dismissed=p.dismissed.filter(k=>k!==key);
  p.events.push({type,key:type==='search'?undefined:key,query:type==='search'?query:undefined,at,eventId});p.events=p.events.slice(-200);db.policyInterests[r.id]=p;changed();refresh(r);return{recorded:true};
 }
 async function handle(req,res,u){if(!u.pathname.startsWith('/api/policy-'))return false;const r=resident(req),pref=preferences(r);
  if(u.pathname==='/api/policy-dataset'&&req.method==='GET'){send(res,200,{scope:'全国',exportedAt:new Date(clock()).toISOString(),count:catalog.length,documents:catalog});return true}
  if(u.pathname==='/api/policy-search'&&req.method==='GET'){const q=cleanQuery(u.searchParams.get('q')),c=u.searchParams.get('category')||'',page=Math.max(1,Math.min(1000,parseInt(u.searchParams.get('page'),10)||1));const search=searchable(),found=search.index.search(q,{limit:6,offset:(page-1)*6,accept:d=>(!c||category(d)===c)&&(!u.searchParams.has('favorites')||pref.favorites.includes(d.key))});const all=found.map(({document:d,score,passages,matchedTerms})=>({...metadata(d,r),searchScore:score,passages,matchedTerms}));send(res,200,{query:q,total:found.total??all.length,retrieval:{...search.index.stats,snapshots:catalog.length,officialWebPages:search.documents.length-catalog.length,scope:'检索校验快照和已读取的政府网页；时效、资格仍待核实，不表示全部政策已收录'},localTotal:search.documents.length,page,pageSize:6,items:all,categories:CATEGORIES,preferences:{enabled:pref.enabled,eventCount:pref.events.length},notice:'本地真实文件全文检索；具体条件及现行效力请向正式渠道核验'});return true}
  if(u.pathname==='/api/policy-recommendations'&&req.method==='GET'){send(res,200,{items:refresh(r),mode:'needs-first-v2',coverage:{documents:catalog.length,localRulesVerified:false},preferences:{enabled:pref.enabled,eventCount:pref.events.length},notice:'先核对本人需求，再推荐；先行者参与领域不作为办事需要，本地条件待核实'});return true}
  if(u.pathname==='/api/policy-needs'&&req.method==='POST'){const a=await body(req),allowed=['needLife','needStudy','needCare','needJob','needAccess','needMental','needLegal'];if(!allowed.some(k=>typeof a[k]==='boolean'))throw Object.assign(Error('请选择希望了解的支持'),{status:400});r.facts||={};for(const k of allowed)if(typeof a[k]==='boolean'){r.facts[k]=a[k];if(k==='needMental')r.facts.mentalSupportDeclined=!a[k]}r.updatedAt=new Date(clock()).toISOString();changed();send(res,200,{ok:true,items:refresh(r)});return true}
  if(u.pathname==='/api/policy-interest'&&req.method==='POST'){send(res,200,record(r,await body(req)));return true}
  if(u.pathname==='/api/policy-preferences'&&req.method==='POST'){const a=await body(req);if(a.clear===true){db.policyInterests[r.id]={enabled:pref.enabled,events:[],favorites:[],dismissed:[]}}else{if(typeof a.enabled!=='boolean')throw Object.assign(Error('请明确是否开启兴趣推荐'),{status:400});db.policyInterests[r.id]={...pref,enabled:a.enabled}}changed();send(res,200,{ok:true,...{enabled:preferences(r).enabled,eventCount:preferences(r).events.length}});return true}
  const m=u.pathname.match(/^\/api\/policy-search\/([a-z0-9-]+)$/);if(m&&req.method==='GET'){const d=searchable().documents.find(d=>d.key===m[1]);if(!d)throw Object.assign(Error('政策不存在'),{status:404});send(res,200,{...metadata(d,r),text:d.text});return true}
  send(res,405,{error:'不支持的政策操作'});return true;
 }
 // Keep both agent tools and the government library on the same verified local catalog.
 db.agent||={};db.agent.documents||=[];let imported=false;
 for(const d of catalog){const old=db.agent.documents.find(x=>x.catalogKey===d.key);if(!old){db.agent.documents.push({id:crypto.randomUUID(),catalogKey:d.key,...d});imported=true}else if(old.sha256!==d.sha256||old.retrievedAt!==d.retrievedAt){Object.assign(old,d);imported=true}const p=db.policies.find(p=>p.catalogKey===d.key&&p.officialSource===d.url);if(!p){ensurePolicy(d);imported=true}}
 if(imported)changed();prune();
 return{catalog,searchable:()=>searchable().documents,retrieve:(query,options)=>searchable().index.search(query,options),get retrievalStats(){return searchable().index.stats},ranked,refresh,visible,record,handle,prune};
}
module.exports={createDiscovery,loadCatalog,queryScore,profileScore,cleanQuery};
