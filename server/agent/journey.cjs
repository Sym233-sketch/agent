'use strict';
// A read-only, resident-scoped overview. Never includes form values or chat bodies.
module.exports=function journey(data,residentId){
 const owned=(data.cases||[]).filter(c=>c.residentId===residentId),applications=(data.applications||[]).filter(a=>a.residentId===residentId),ids=new Set(owned.map(c=>c.id));
 const items=owned.filter(c=>c.applicationId||c.serviceContext||c.messages?.length||c.facts?.service||c.facts?.needs).filter(c=>c.applicationId||!Object.values(c.matterCases||{}).some(id=>ids.has(id))).map(c=>{
  const a=applications.find(a=>a.id===c.applicationId&&a.caseId===c.id),status=a?.status==='submitted'?'submitted':c.workflow?.status==='failed'?'retry':a?.status==='ready'||a?.status==='needs_review'?'review':c.status==='confirmed'?'confirmed':'collecting';
  const names={'primary-school':'孩子的教育支持',eldercare:'社区养老支持',employment:'就业服务', 'mental-support':'心理支持'};
  return{id:c.id,title:String(c.serviceContext?.title||c.facts?.service?.value||names[c.recommendations?.event]||'和红通的对话').slice(0,80),status,hasApplication:!!a,virtual:!!a,receiptId:status==='submitted'?a.receipt?.id||null:null,updatedAt:a?.updatedAt||c.updatedAt||c.createdAt};
 }).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
 return{items,counts:{ongoing:items.filter(i=>['collecting','retry'].includes(i.status)).length,review:items.filter(i=>i.status==='review').length,submitted:items.filter(i=>i.status==='submitted').length},notice:'申报与受理为站内虚拟演示，正式办理须通过对应政务渠道。'};
};
