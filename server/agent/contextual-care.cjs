'use strict';
const crypto=require('node:crypto'),demo=require('../demo-context.cjs');
const KINDS={paperwork:{title:'找个人一起理清材料',question:'这几轮我们一直在核对材料。要不要先帮你整理成一张清单，或者了解社区帮办服务？',query:'社区 帮办代办 社工 服务'},companionship:{title:'让身边多一份支持',question:'要不要了解社区社工的电话关怀或探访服务？可以先聊聊，再决定是否希望有人上门。',query:'社区 社工 探访关爱 服务'},caregiver:{title:'也给照护者一点喘息',question:'要不要了解短时照护或社区支持，让你有机会歇一歇？我们先查服务安排和费用。',query:'社区 照护者 喘息 服务'},meals:{title:'让吃饭这件事轻松一些',question:'要不要了解附近的社区助餐或送餐服务？先看看费用和配送范围，不用马上决定。',query:'社区 助餐 送餐 服务'},mobility:{title:'少跑一点，有人搭把手',question:'要不要了解帮办、助行或上门咨询？可以先确认哪些事情能在家准备。',query:'社区 助行 上门 帮办 服务'},emotional:{title:'给自己留一点支持',question:'这几轮聊下来，我想轻轻问一句：你愿不愿意了解可以倾听的社工或专业支持？也可以只继续办眼前的事。',query:'社区 社工 心理 支持 服务'}};
const fail=(status,message)=>Object.assign(Error(message),{status});
const ownContext=text=>!/^\s*(假如|假设|举例|小说|帮朋友|他|她)/.test(text)&&!/(?:我朋友|我同事|我的朋友|我的同事|我妈妈|我爸爸|我儿子|我女儿|我母亲|我父亲)/.test(text);
function turns(history,message){return [...history.filter(m=>m.role==='user').map(m=>m.text),message].filter(Boolean).slice(-12)}
function detect(messages){
 const rules=[['paperwork',/材料|证明|复印|申请表|填表|盖章|提交/,/还是|又|不懂|不明白|看不懂|哪里|怎么|不对|退回|跑了/],['caregiver',/照顾|照护|陪护|护理/,/累|抽不开|睡不好|没空|休息|撑/],['meals',/做饭|买菜|吃饭|用餐|饭菜/,/费劲|困难|来不及|凑合|没力气|不想动|不方便/],['mobility',/出门|走路|上下楼|跑一趟|去窗口/,/不便|困难|费劲|太远|没法|又|跑不动/],['companionship',/一个人|独居|没人说话|没人帮|无人商量/,/难|烦|累|孤单|顾不过来|没人/],['emotional',/睡不好|失眠|提不起劲|没意思|开心不起来|低落|撑不住|很累|什么都不想|不想见人/,/./]];
 return rules.flatMap(([kind,topic,friction])=>{const matches=messages.map((text,i)=>({text,i})).filter(x=>(!['emotional','companionship'].includes(kind)||(ownContext(x.text)&&!/(?:没有|并不|不是|不会).{0,5}(?:失眠|睡不好|低落|提不起劲|孤单)/.test(x.text)))&&!/^\s*(假如|假设|举例|小说|帮朋友|我朋友|我同事|他|她)/.test(x.text)&&!/不需要.*(?:社工|关怀|心理)|不要.*(?:推测|提醒|推荐)/.test(x.text)&&topic.test(x.text));const ids=new Set(matches.map(x=>x.i));if(ids.size<2||!matches.some(x=>friction.test(x.text))||(kind==='paperwork'&&ids.size<3&&!matches.some(x=>/不懂|不明白|看不懂|还是|又|退回/.test(x.text))))return[];return[{kind,evidence:matches.slice(-3).map(x=>x.text.slice(0,200)),reason:kind==='paperwork'?'最近几轮都在核对材料或办理步骤，可能需要更省力的协助。':'最近几轮出现了相关生活线索，可能值得提供一种支持选择；仍需你确认。',basis:'conversation-pattern'}]});
}
function validate(candidate,messages){
 if(!KINDS[candidate.kind]||!Array.isArray(candidate.evidence)||candidate.evidence.length<2||candidate.evidence.length>4)throw Error('支持建议需要两轮以上本人原话依据');
 const quotes=candidate.evidence;if(quotes.some(q=>typeof q!=='string'||q.length<3||q.length>200))throw Error('依据长度无效');
 if(['emotional','companionship'].includes(candidate.kind))messages=messages.filter(ownContext).filter(m=>!/(?:没有|并不|不是|不会).{0,5}(?:失眠|睡不好|低落|提不起劲|孤单)/.test(m));
 const used=new Set();for(const q of quotes){const i=messages.findIndex((m,i)=>!used.has(i)&&m.includes(q));if(i<0)throw Error('依据必须分别来自不同轮次的本人对话');used.add(i)}
 return{kind:candidate.kind,evidence:quotes,reason:'从最近几轮对话发现可能需要额外支持；这只是待你确认的服务建议。',basis:'llm-context'};
}
module.exports=function create({data,db,changed,provider,run,schema,redact,fetchDocument,clock=Date.now,fictionalDemo=false}){
 const state=c=>c.supportCare||={offers:[],muted:[],paused:false,lastShownAt:0};
 const owned=(r,id)=>{const c=data.cases.find(c=>c.id===id&&c.residentId===r.id);if(!c)throw fail(404,'没有找到这件事');return c};
 const visible=(c)=>{const s=state(c);return{caseId:c.id,demoContext:fictionalDemo?demo.context:null,paused:s.paused,offers:s.offers.filter(o=>o.status==='suggested'&&!s.muted.includes(o.kind)).slice(-1),notice:'依据本事项对话发现的支持选择，不是诊断或资格认定。'}};
 async function contextualRun(p,args){
  if(!args.input?.case?.id)return run(p,args);
  const c=data.cases.find(c=>c.id===args.input.case.id);if(!c)return run(p,args);
  const s=state(c),messages=turns(args.input.history||[],args.input.message),suppressed=s.paused||s.offers.some(o=>o.status==='suggested')||clock()-s.lastShownAt<24*3600000;
  const blocked=kind=>s.muted.includes(kind)||(kind==='emotional'&&db.residents.find(r=>r.id===c.residentId)?.facts?.mentalSupportDeclined);
  const candidates=suppressed?[]:detect(messages).filter(x=>!blocked(x.kind));
  const original=args.execute;
  const instructions=args.instructions+'\n主动关怀：结合本人多轮对话，发现办事阻力或生活支持线索，不必等用户说出服务名称。possibleSupportNeeds是待确认假设，不是档案事实。先回答当前问题，有证据时最多温和建议一种支持。可以调用suggest_contextual_support提出不同轮次原话支持的建议。不能推断或记录抑郁症等诊断、精神健康倾向评分，不依据年龄、婚姻或单条消息贴标签；不要把他人情况当本人。不得自动联系、分享聊天或声称已预约。拒绝、纠正和暂停优先；关闭主动建议时不再推荐社工或心理服务。';
  const tools=suppressed?args.tools:[...args.tools,schema('suggest_contextual_support','从至少两轮本人对话推理可能需要的服务支持，仅建议、不诊断、不联系',{kind:{type:'string',enum:Object.keys(KINDS)},evidence:{type:'array',items:{type:'string'}}})];
  const result=await run(p,{...args,instructions,input:{...args.input,possibleSupportNeeds:candidates.map(x=>({kind:x.kind,question:KINDS[x.kind].question})),supportSuggestionsPaused:suppressed,declinedSupportKinds:s.muted},tools,execute:async(name,input)=>{if(name!=='suggest_contextual_support'){if(name==='request_human_help'&&(!/(?:人工|社工)/.test(args.input.message)||!/(?:联系|找|转|安排|接通|协助)/.test(args.input.message)||/(?:不要|不用|不想|暂不)/.test(args.input.message)))throw Error('还没有获得联系人工的明确意愿，请先提供可选择的支持卡片');return original(name,input);}const proposal=validate(input,messages);if(suppressed||blocked(proposal.kind))throw Error('该支持建议已暂停或拒绝');if(!candidates.some(x=>x.kind===proposal.kind))candidates.push(proposal);return{status:'suggestion_only',question:KINDS[proposal.kind].question,notice:'尚未联系任何机构，需用户选择。'}}});
  return{...result,_careCandidates:candidates.slice(0,1)};
 }
 function wrapDesk(desk){const chat=desk.chat;desk.chat=async(r,input)=>{const result=await chat(r,input),c=owned(r,result.case.id),s=state(c);if(result._careCandidates?.length&&!result.replayed&&!s.paused&&!s.offers.some(o=>o.status==='suggested')){const candidate=result._careCandidates[0];if(!s.muted.includes(candidate.kind)){s.offers.push({id:crypto.randomUUID(),...candidate,...KINDS[candidate.kind],status:'suggested',createdAt:new Date(clock()).toISOString()});s.offers=s.offers.slice(-12);s.lastShownAt=clock();changed()}}delete result._careCandidates;return{...result,care:visible(c)}};return desk}
 async function handle(req,res,u,{resident,send,body}){
  if(!u.pathname.startsWith('/api/agent/care'))return false;const r=resident(req);
  if(u.pathname==='/api/agent/care'&&req.method==='GET'){const c=data.cases.filter(c=>c.residentId===r.id).at(-1);send(res,200,c?visible(c):{caseId:null,offers:[],paused:false});return true}
  const m=u.pathname.match(/^\/api\/agent\/care\/([a-f0-9-]+)(?:\/([a-f0-9-]+)\/(choice|options|prepare))?$/);if(!m||req.method!=='POST')throw fail(405,'不支持的关怀操作');
  const c=owned(r,m[1]),s=state(c),a=await body(req);if(!m[2]){if(typeof a.paused!=='boolean')throw fail(400,'请选择是否暂停');s.paused=a.paused;changed();send(res,200,visible(c));return true}
  const o=s.offers.find(x=>x.id===m[2]);if(!o)throw fail(404,'建议不存在');
  if(m[3]==='choice'){if(!['not_now','wrong','decline'].includes(a.choice))throw fail(400,'请选择处理方式');o.status=a.choice;if(a.choice!=='not_now')s.muted=[...new Set([...s.muted,o.kind])];o.evidence=[];changed();send(res,200,visible(c));return true}
  if(s.paused||o.status!=='suggested'||s.muted.includes(o.kind))throw fail(409,'该建议已暂停或关闭');
  if(m[3]==='options'){
   if(fictionalDemo){o.options={region:demo.context.region,simulated:true,organizations:[demo.organization(o.kind)],sources:[],checkedAt:new Date(clock()).toISOString(),verifiedService:false,notice:demo.context.notice};changed();send(res,200,o.options);return true}
   const region=redact(a.region||c.facts.district?.value||'').trim().slice(0,80);if(!region||/暂未|未知/.test(region))throw fail(400,'请先提供市、区或街道，不需要详细住址');
   if(!provider.key)throw fail(503,'模型搜索尚未连接，请稍后重试');
   const found=await require('./documents.cjs').search(provider,region+' '+KINDS[o.kind].query);const sources=[];
   for(const x of found.sources.slice(0,3)){try{const page=await fetchDocument(x.url);sources.push({title:page.title,url:page.url,excerpt:page.text.slice(0,900),retrievedAt:page.retrievedAt})}catch{}}
   if(!db.residents.includes(r)||!data.cases.includes(c)||s.paused||o.status!=='suggested')throw fail(409,'当前建议已取消');
   o.options={region,sources,checkedAt:new Date(clock()).toISOString(),verifiedService:false,notice:sources.length?'查询到的是官方服务资料；是否服务你所在社区、费用和可预约时间，还需向机构核实。':'没有读到可核验的当地官方资料；暂不提供机构或预约承诺。'};changed();send(res,200,o.options);return true;
  }
  if(a.confirm!==true||!['phone','visit','online'].includes(a.preference)||typeof a.summary!=='string'||!a.summary.trim()||a.summary.length>300||redact(a.summary)!==a.summary)throw fail(400,'请确认联系方式与不含敏感号码的分享摘要');
  if(!o.options?.simulated&&!o.options?.sources.length)throw fail(409,'请先查询并阅读官方服务资料');
  let task=data.handoffs.find(t=>t.residentId===r.id&&t.careOfferId===o.id);
  if(!task){task={id:crypto.randomUUID(),residentId:r.id,name:r.displayName,careOfferId:o.id,reason:a.summary.trim(),preference:a.preference,region:o.options.region,sources:o.options.sources.map(({title,url})=>({title,url})),status:'waiting',delivery:'local_queue_only',simulated:o.options.simulated===true,createdAt:new Date(clock()).toISOString()};data.handoffs.push(task)}
  o.status='prepared';o.evidence=[];changed();send(res,200,{task,message:'联系准备单已保存到站内人工队列；尚未联系社工、分享给外部机构或预约上门。请通过核实后的官方渠道联系。'});return true;
 }
 return{run:contextualRun,wrapDesk,handle};
};
module.exports.detect=detect;module.exports.validate=validate;
