'use strict';
const demo=require('../demo-context.cjs');
const {official}=require('./documents.cjs');
// These are consultation / intention-registration demonstrations, never real approvals.
const MATTERS={
 'school-aftercare':{event:'primary-school',title:'课后服务意愿登记',help:'想了解放学后的照看和课程，可以先整理参加意愿。',condition:'自愿参加；课程、接送安排和收费向本校核实。',keys:['school-aftercare'],materials:['课后服务意愿与时间安排']},
 'school-status':{event:'primary-school',title:'学籍信息核对咨询',help:'核对入学后的学籍资料，或了解信息更正该找谁。',condition:'由学校核验和办理；这里不收集孩子证件号、学籍号。',keys:['school-status-2025'],materials:['学籍核对咨询需求']},
 'school-aid':{event:'primary-school',title:'学生资助条件咨询',help:'若家庭有经济压力，可以了解困难学生生活补助等支持。',condition:'须核实家庭经济情况、寄宿情况和当地标准，不代表已经符合条件。',keys:['school-finance-2026'],materials:['资助政策咨询需求']},
 'school-enrollment':{event:'primary-school',title:'小学入学材料咨询',help:'准备入学时，先核对所在区县当年的报名要求。',condition:'学区、年龄条件、报名时间和材料均以当地当年公告为准。',keys:['school-enrollment-2026'],materials:['入学材料咨询需求']},
 'job-support':{event:'employment',title:'公共就业服务咨询',help:'先整理求职意愿，再了解公共招聘、职业指导和培训服务。',condition:'岗位、培训名额和具体条件由当地公共就业服务机构核实。',keys:['employment-promotion'],materials:['就业服务意愿整理']},
 'elder-support':{event:'eldercare',title:'社区养老服务需求登记',help:'整理助餐、探访或居家照护需求，了解社区可用的支持。',condition:'服务范围、收费、补贴及服务对象条件须向当地社区核实。',keys:['basic-elder-services','silver-economy'],materials:['养老服务需求整理']},
 'mental-support':{event:'mental-support',title:'心理支持服务咨询',help:'可以先了解心理支持和就医服务，不需要在这里证明自己有多难受。',condition:'这不是诊断或补助认定；服务地点、转介方式及支付政策需当地核实。',keys:['mental-services-2026','depression-support'],materials:['本人愿意提供的支持需求']}
};
const NAMES={'primary-school':'孩子的小学生活',employment:'求职与就业支持',eldercare:'社区养老支持','mental-support':'心理支持'};
function detect(message){
 const text=String(message||'');
 if(/举个例子|假如|假设|代码|测试用例|小说|提示词/.test(text))return null;
 const family=/我(?:的)?(?:儿子|女儿|孩子|小孩)|我们家(?:孩子|小孩)|我家/.test(text);
 if(/小学|一年级|幼升小/.test(text)&&!/不是.*小学|没有.*(?:孩子|儿子|女儿)|还(?:没|未)到.*(?:上小学|入学)|小学老师|小学教师/.test(text)&&!/(?:朋友|邻居|同事|别人)(?:的)?(?:儿子|女儿|孩子)/.test(text)){
  const upcoming=/(?:准备|打算|明年|下学期|即将|将要|还没|尚未|要上|快上).{0,10}(?:小学|入学)|幼升小|入学报名/.test(text),already=/已经.*(?:上小学|入学)|已经在.*小学|在上小学|上小学了/.test(text)&&!/(?:准备|明年|下学期|即将|将要|快要|快|要)上小学了/.test(text);
  return{event:'primary-school',phase:upcoming&&!already?'planned':'enrolled',subject:family?'family':'unspecified',yearOffset:/明年/.test(text)?1:0,requestedYear:Number(text.match(/(20\d{2})年.{0,6}(?:小学|入学)/)?.[1])||null,evidence:text.slice(0,600)};
 }
 if(/(?:失业了|刚失业|最近待业|想找工作|找不到工作|求职.*(?:政策|推荐)|就业.*(?:政策|推荐))/.test(text)&&!/没(?:有)?失业|不是失业|并未失业/.test(text))return{event:'employment',subject:'self',evidence:text.slice(0,600)};
 if(/退休了|刚退休|(?:父母|母亲|父亲|爸妈|老人).*(?:独居|没人照顾|需要照护)|(?:养老|老人).*(?:什么政策|办理|推荐)/.test(text))return{event:'eldercare',subject:/父母|母亲|父亲|爸妈/.test(text)?'family':'self',evidence:text.slice(0,600)};
 if(/(?:我|本人|儿子|女儿|孩子).*(?:抑郁|情绪低落|心理困扰)|(?:心理支持|心理咨询).*(?:推荐|政策|办理)/.test(text)&&!/没有抑郁|并未抑郁|不是抑郁/.test(text))return{event:'mental-support',subject:family?'family':'self',evidence:text.slice(0,600)};
 return null;
}
function statedRegion(message){return String(message||'').match(/(?:我在|住在|家在|居住在|地区(?:改成|是)?|所在地(?:是)?|^)[\s：:]*([\p{Script=Han}]{2,8}市[\p{Script=Han}]{1,8}?(?:区|县))/u)?.[1]||null}
const regionOf=c=>{const r=c.facts.district?.value;if(!r||/^(?:暂未|未知|未提供|演示|测试)/.test(r))return null;return statedRegion(r)||(/^[\p{Script=Han}]{2,8}(?:市|省|自治区|县|区)$/u.test(r)?r:null)};
const metadata=d=>({key:d.key||d.catalogKey,title:d.title,url:d.url,issued:d.issued,scope:d.scope,sourceNote:d.sourceNote,verification:d.verification});
module.exports=function createDiscovery({catalog,search,read,clock=Date.now,fictionalDemo=false}){
 async function discover(c,message,{force=false}={}){
  const found=detect(message),previous=c.recommendations;if(!found&&!previous)return null;
  const event=found||{event:previous.event,phase:previous.phase,subject:previous.subject,evidence:previous.evidence},region=fictionalDemo?demo.context.region:regionOf(c),year=found?(found.requestedYear||new Date(clock()).getFullYear()+(found.yearOffset||0)):previous.year,fingerprint=JSON.stringify([event.event,event.phase,event.subject,region,year]);
  if(!force&&previous?.fingerprint===fingerprint&&clock()-Date.parse(previous.researchedAt)<(previous.research.status==='failed'?60000:86400000))return previous;
  const entries=Object.entries(MATTERS).filter(([id,m])=>m.event===event.event&&(event.event!=='primary-school'||(event.phase==='planned'?id!=='school-status':id!=='school-enrollment')));
  const items=entries.map(([id,m])=>({id,title:m.title,help:m.help,condition:m.condition,virtual:true,materials:m.materials,sources:catalog().filter(d=>m.keys.includes(d.key||d.catalogKey)&&official(d.url)).map(metadata)})).filter(m=>m.sources.length);
  const plan={...event,title:NAMES[event.event],region,year,fingerprint,researchedAt:new Date(clock()).toISOString(),localRulesVerified:false,items,research:{status:'searching',sources:[],notice:'地方办理条件仍须核实。'}};
  if(fictionalDemo){plan.demoContext=demo.context;plan.items=plan.items.map(m=>({...m,condition:'虚构演示：自愿登记，示例材料由系统准备，最后由本人确认提交。',demo:true,materials:[...m.materials.map(x=>x+'（虚构演示样例）')]}));plan.research={status:'simulated',sources:[],notice:demo.context.notice};c.recommendations=plan;for(const d of items.flatMap(m=>m.sources))if(!c.sources.some(s=>s.url===d.url))c.sources.push(metadata(d));return plan}
  // Query only topic and city/district, never the message, names or medical details.
  const topic={'primary-school':event.phase==='planned'?'小学 入学报名 课后服务 学生资助':'小学 课后服务 学籍 学生资助',employment:'公共就业服务 办理指南',eldercare:'社区养老 助餐 居家服务 办理','mental-support':'心理健康公共服务 服务指南'}[event.event];
  plan.research.query=[region||'全国',year,topic,'官方政策'].join(' ');
  try{
   const result=await search(plan.research.query);if(!result){plan.research.status='deferred';plan.research.notice='本轮检索次数已用完；先列出已核对的全国政策，地方要求待继续检索。'}
   else{
    const candidates=(result.sources||[]).filter(s=>official(s.url)).slice(0,2);
    for(const candidate of candidates){try{const d=await read(candidate.url);if(!official(d.url)||!d.text?.trim()||d.text.includes('\uFFFD'))continue;plan.research.sources.push({...metadata(d),documentId:d.id,excerpt:d.text.slice(0,6000),applicability:'已读取正文，地区、时效及具体条件仍待核实'})}catch{/* Retain trusted catalog entries when an official site cannot be read. */}}
    plan.research.status=plan.research.sources.length?'read':candidates.length?'unread':'no-results';
    plan.research.notice=plan.research.sources.length?'已检索并读取官方网页；地方条件仍须逐项核实。':candidates.length?'搜到候选网页，但正文未能读取；以下依据来自已核对的全国文件。':'本轮未找到可读取的官方结果；以下依据来自已核对的全国文件。';
   }
  }catch{plan.research.status='failed';plan.research.notice='在线检索暂未成功；先按已核对的全国政策提供线索，地方要求待核实。'}
  c.recommendations=plan;
  for(const d of [...items.flatMap(m=>m.sources),...plan.research.sources])if(!c.sources.some(s=>s.url===d.url))c.sources.push(metadata(d));
  return plan;
 }
 return{discover};
};
module.exports.detect=detect;module.exports.statedRegion=statedRegion;module.exports.MATTERS=MATTERS;
