'use strict';
const metadata=require('./policy-metadata.cjs');
function assess({matter,case:c,documents,region,year,demo=false}){
 if(demo)return{status:'demo',label:'虚构业务示例',conditions:[],missing:[],notice:'全国与地方真实政策仅作背景，不作为武畔市虚构业务条件。'};
 const refs=(matter.sources||[]).map(s=>documents.find(d=>d.url===s.url)).filter(Boolean),conditions=[];
 function proof(term){const d=refs.find(d=>d.text?.includes(term));if(!d)return null;const at=d.text.indexOf(term),start=Math.max(0,at-45),end=Math.min(d.text.length,at+term.length+100);return{key:d.key,url:d.url,title:d.title,quote:d.text.slice(start,end),start,end,sha256:d.sha256}}
 const f=c.facts||{},stated=key=>f[key]?.value||null,add=(field,label,state,evidence,source)=>conditions.push({field,label,status:state,evidence:evidence||null,source:source||null});
 for(const d of refs){const s=metadata.status(d,{region,year});if(!s.regionMatches)add(null,'适用地区','not-matched',region,{key:d.key,url:d.url,title:d.title,quote:d.scope});if(['outside-year','expired','superseded','draft','not-yet-effective'].includes(s.timeStatus))add(null,'文件时效','not-matched',s.timeStatus,{key:d.key,url:d.url,title:d.title,quote:d.title})}
 const school=/^school-/.test(matter.id),stage=stated('beneficiaryGrade')||stated('study')||(c.recommendations?.event==='primary-school'?c.recommendations.evidence:null);
 if(school){const primary=stage&&/小学|一年级|[一二三四五六1-6]年级/.test(stage);add('study','学生所处阶段',stage&&/初中|高中|大学|不是小学|不再上小学|小学毕业/.test(stage)?'not-matched':primary?'supported':'missing',stage,proof(matter.id==='school-status'?'学籍':'义务教育')||proof('学校'));
  const age=stated('beneficiaryAge');if(age&&Number(age)>=18)add('beneficiaryAge','学生年龄与小学事项一致性','not-matched',age,null);
 }
 if(matter.id==='school-aftercare')add('preference','是否自愿参加课后服务',/不愿|不想|不参加|拒绝|非自愿/.test(stated('preference')||'')?'not-matched':/愿意|希望参加|要参加|自愿/.test(stated('preference')||'')?'supported':'missing',stated('preference'),proof('自愿'));
 if(matter.id==='school-aid')add('income','家庭经济困难条件与正式认定',/不符合家庭经济困难|不是困难家庭/.test(stated('income')||'')?'not-matched':stated('income')?'needs-verification':'missing',stated('income'),proof('家庭经济困难'));
 if(matter.id==='school-enrollment')add(null,'当年区县报名窗口与受理材料','needs-verification',null,proof('报名')||proof('招生'));
 if(matter.id==='elder-support')add('care','具体照护、助餐或探访需要',stated('care')?'supported':'missing',stated('care'),proof('养老'));
 if(matter.id==='job-support')add('employment','本人希望获得就业服务',/找工作|求职|就业|失业/.test(stated('employment')||c.recommendations?.evidence||'')?'supported':'missing',stated('employment')||c.recommendations?.evidence,proof('就业'));
 if(matter.id==='mental-support')add(null,'服务机构、预约方式及费用支付范围','needs-verification',null,proof('心理')||proof('精神卫生'));
 const conflict=conditions.some(x=>x.status==='not-matched'),pending=conditions.some(x=>x.status==='missing'||x.status==='needs-verification');return{status:conflict?'inconsistent':pending?'pending':'supported-information',label:conflict?'有条件需重新核对':pending?'尚有条件待核实':'已有资料支持，待正式核验',conditions,missing:conditions.filter(x=>x.status==='missing'&&x.field).map(x=>x.field),notice:'逐项比对已有资料与原文线索，不是正式资格或审批结论；未知条件不自动补造。'};
}
module.exports={assess};
