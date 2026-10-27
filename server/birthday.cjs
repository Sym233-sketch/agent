'use strict';
const {text}=require('./agent/llm.cjs');
const today=(now=Date.now())=>new Date(now+8*3600000).toISOString().slice(0,10);
function age(birth,day=today()){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(birth||'')||birth<'1900-01-01'||birth>day)return null;
 const d=new Date(birth+'T00:00:00Z');if(!Number.isFinite(+d)||d.toISOString().slice(0,10)!==birth)return null;
 return +day.slice(0,4)- +birth.slice(0,4)-(day.slice(5)<birth.slice(5)?1:0);
}
function create({provider,changed,clock=Date.now,exists=()=>true}){
 const pending=new Map();
 async function greeting(r){
  const day=today(clock());if(age(r.birthDate,day)===null||r.birthDate.slice(5)!==day.slice(5))return{status:'not_today'};
  if(r.birthdayGreeting?.day===day&&r.birthdayGreeting.birthDate===r.birthDate)return r.birthdayGreeting;
  if(!provider.key)return{status:'not_configured',day};
  if(pending.has(r.id))return pending.get(r.id);
  const birthDate=r.birthDate;
  const task=(async()=>{const response=await provider.response({instructions:'你是民策通生日关怀 Agent。今天是用户生日，请写一份80至140字的温暖中文生日祝福，有画面感、自然真诚。不要假设年龄、家庭、健康、经济或人生经历，不提供政策建议，不索取资料。仅输出祝福正文，不输出标题或Markdown。',input:'今天是我的生日，请送我一份特别的祝福。',max_output_tokens:500});const answer=text(response).trim();if(!answer||response.status==='incomplete')throw Error('生日祝福生成未完成，请稍后重试');if(!exists(r)||r.birthDate!==birthDate||today(clock())!==day)return{status:'cancelled'};r.birthdayGreeting={status:'ready',day,birthDate,answer:answer.slice(0,1200),mode:'live-llm',model:provider.model};changed();return r.birthdayGreeting})();
  pending.set(r.id,task);try{return await task}finally{pending.delete(r.id)}
 }
 return{greeting};
}
module.exports={today,age,create};
