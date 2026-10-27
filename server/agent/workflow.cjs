'use strict';
const crypto=require('crypto'),{official}=require('./documents.cjs'),hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const READS=new Set(['search_government_documents','read_government_document','read_service_policy','find_service_options','automatic-policy-search','automatic-policy-read']);
function begin(c,{requestId,message},changed=()=>{}){
 const fingerprint=hash(message),previous=c.workflow;if(previous?.requestId===requestId&&previous.fingerprint!==fingerprint)throw Object.assign(Error('请求编号已用于另一条消息'),{status:409});const reuse=previous?.requestId===requestId&&previous.fingerprint===fingerprint&&previous.status!=='completed'&&Date.now()-Date.parse(previous.updatedAt)<600000,job=reuse?previous:{id:crypto.randomUUID(),requestId,fingerprint,createdAt:new Date().toISOString(),cache:{},steps:[],attempts:0};job.attempts++;job.status='running';delete job.error;job.updatedAt=new Date().toISOString();c.workflow=job;changed();
 async function step(name,args,execute){const key=hash([name,args]),cached=READS.has(name)&&job.cache[key]&&Date.now()-(job.cache[key].cachedAt||Date.parse(job.createdAt))<600000&&job.cache[key],entry={name,status:'running',startedAt:new Date().toISOString(),reused:!!cached};job.steps.push(entry);job.steps=job.steps.slice(-50);changed();
  const started=Date.now();try{let value;if(cached){value=structuredClone(cached.value);for(const s of cached.sources||[])if(official(s.url)&&!c.sources.some(x=>x.url===s.url))c.sources.push({...s})}else{const before=new Set(c.sources.map(s=>s.url));value=await execute();if(READS.has(name)){job.cache[key]={cachedAt:Date.now(),value:structuredClone(value),sources:structuredClone(c.sources.filter(s=>!before.has(s.url)))};const keys=Object.keys(job.cache);for(const k of keys.slice(0,Math.max(0,keys.length-12)))delete job.cache[k]}}
  Object.assign(entry,{status:'completed',durationMs:Date.now()-started,finishedAt:new Date().toISOString()});job.updatedAt=entry.finishedAt;changed();return value;
  }catch(e){Object.assign(entry,{status:'failed',durationMs:Date.now()-started,error:String(e.message).slice(0,180)});changed();throw e}
 }
 return{step,complete(){job.status='completed';job.cache={};job.updatedAt=new Date().toISOString();changed()},fail(e){job.status='failed';job.error=String(e.message).slice(0,180);job.updatedAt=new Date().toISOString();changed()}};
}
function summary(c){const j=c.workflow;if(!j)return null;return{id:j.id,status:j.status,requestId:j.requestId,attempts:j.attempts,steps:j.steps.map(({name,status,durationMs,reused,error})=>({name,status,durationMs,reused,error})),updatedAt:j.updatedAt,error:j.error||null}}
module.exports={begin,summary};
