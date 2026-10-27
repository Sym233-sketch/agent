'use strict';
const crypto=require('node:crypto'),profileAge=require('../profile-age.cjs'),birthday=require('../birthday.cjs'),demo=require('../demo-context.cjs');
const DEFINITION={id:'mincetong-virtual-service-v1',version:1,title:'民策通公共服务虚拟申报表',virtual:true,receivingOffice:'民策通虚拟受理台',notice:'站内虚拟申报演示，不向真实政府部门提交，不产生现实审批、支付或法律效力。',fields:[
 {id:'applicant',label:'申报称呼（已脱敏）',required:true},
 {id:'service',label:'申报事项',required:true},
 {id:'district',label:'所在市区',required:true},
 {id:'needs',label:'申请服务与希望获得的帮助',required:true},
 {id:'age',label:'申报人年龄',required:false},
 {id:'occupation',label:'职业身份',required:false},
 {id:'beneficiary',label:'服务对象',required:false},
 {id:'household',label:'家庭安排',required:false},
 {id:'income',label:'本人提供的收入与费用说明',required:false},
 {id:'situation',label:'情况介绍（本人自述）',required:false},
 {id:'preference',label:'服务安排意愿',required:false},
 {id:'insurance',label:'参保情况',required:false},
 {id:'schedule',label:'希望办理或服务的时间',required:false}
]};
const UNKNOWN=/^(暂未|尚未|未提供|暂不|未知|演示社区|测试地区)/;
function wantsApplication(message){return String(message||'').split(/[，,。；;！!?？\n]|但是|但/).some(s=>!/(不要|不用|不想|别|暂不|不能|无需|不提交|不申报|不准备)/.test(s)&&(/(?:帮我|替我|给我|直接|我要).*(?:提交|申报)/.test(s)||/(?:帮我|替我|给我).*(?:准备|整理|填好|填写).*(?:资料|材料|表格|申报)/.test(s)||/(?:提交|申报)(?:这份|一下|申请|材料|资料|表格)/.test(s)))}
const trusted=f=>f&&typeof f.value==='string'&&f.value.trim()&&['self-report','profile','previous-case','service-record','matter-selection'].includes(f.source)&&typeof f.evidence==='string'&&f.evidence.trim()&&(f.source!=='self-report'||f.evidence.includes(f.value));
const fail=(status,message)=>Object.assign(Error(message),{status});
module.exports=function createApplications({data,changed,redact,clock=Date.now,getResident=()=>null}){
 data.applications||=[];data.virtualApplicationSequence||=0;
 const now=()=>new Date(clock()).toISOString(),own=(r,id)=>{const a=data.applications.find(a=>a.id===id&&a.residentId===r.id);if(!a)throw fail(404,'虚拟申报记录不存在');return a};
 function summary(a){return structuredClone({id:a.id,caseId:a.caseId,revision:a.revision,template:a.demoContext?{...DEFINITION,receivingOffice:demo.context.office,notice:demo.context.notice+' 站内虚拟申报，不向真实政府提交。'}:DEFINITION,demoContext:a.demoContext||null,status:a.status,virtual:true,fields:a.fields,materials:a.materials,missing:a.missing,receipt:a.receipt||null,createdAt:a.createdAt,updatedAt:a.updatedAt})}
 function forCase(c){const a=data.applications.find(a=>a.id===c.applicationId&&a.caseId===c.id&&a.residentId===c.residentId);if(a&&a.status!=='submitted'){const r=getResident(c.residentId);if(r)return prepare(r,c);refreshAge(a,null)}return a?summary(a):null}
 function refreshAge(a,r){if(a.status==='submitted')return;const f=a.fields?.find(f=>f.id==='age');if(!f)return;const next=r?profileAge.field(r,birthday.today(clock())):f.value==='0'?{value:null,source:null,evidence:null}:null;if(next&&['value','source','evidence'].some(k=>f[k]!==next[k])){Object.assign(f,next);a.revision++;a.fingerprint=null;changed()}}
 function collect(r,c){const f=c.facts,context=c.serviceContext||(c.recommendations?{subject:c.recommendations.subject,recommendationId:c.id}:{}),values={},profile=(id,value)=>{if(value!==undefined&&value!==null&&!UNKNOWN.test(String(value)))values[id]={value:redact(String(value)).slice(0,1500),source:'profile',evidence:'已登记的本人服务档案'}};
  profile('applicant',r.displayName?(r.displayName.includes('*')?r.displayName:r.displayName.slice(0,1)+'**'):null);values.age=profileAge.field(r,birthday.today(clock()));profile('occupation',r.job);profile('district',r.district);
  for(const id of ['service','district','needs','occupation','household','income','situation','preference','insurance','schedule'])if(trusted(f[id]))values[id]={...f[id]};
  if(!values.service&&context.title)values.service={value:context.title,source:'service-record',evidence:'本人选择的主动服务事项'};
  if(!values.needs){const known=[f.care,f.employment,f.study,f.preference,f.situation,f.service].find(trusted);values.needs=known?{...known}:values.service?{...values.service}:null}
  if(!values.district&&context.region&&!UNKNOWN.test(context.region))values.district={value:context.region,source:'service-record',evidence:'本人的服务登记地区'};
  if(!values.schedule&&context.dueDate)values.schedule={value:context.dueDate,source:'service-record',evidence:'本人登记的办理或预约日期'};
  values.beneficiary={value:context.recommendationId?(context.subject==='family'?'本人提及的家庭成员（资料未核实）':context.subject==='unspecified'?'咨询对象待核实':'本人'):context.subject==='family'?'已获授权家庭成员（未记录姓名）':'本人',source:'service-record',evidence:context.recommendationId?'本人选择的政策咨询或意愿登记':context.subject==='family'?'服务档案已注明家庭成员授权':'本人发起的虚拟申报'};
  if(c.demoContext){values.district=demo.fact(demo.context.region);if(!values.applicant)values.applicant=demo.fact('武畔演示居民（虚构称呼）');if(!values.service)values.service=demo.fact(context.title||'社区综合便民服务咨询（虚构演示）');if(!values.needs)values.needs=demo.fact((context.title||'了解社区帮办、服务安排与材料清单')+'（虚构演示需求）');}
  const fields=DEFINITION.fields.map(field=>({...field,label:c.demoContext&&field.id==='district'?'演示办理地区':field.label,mapping:field.id,value:values[field.id]?.value||null,source:values[field.id]?.source||null,evidence:values[field.id]?.evidence||null})),missing=fields.filter(f=>f.required&&!f.value).map(f=>({id:f.id,label:f.label}));
  const materials=[{id:'virtual-form',title:DEFINITION.title,status:'generated',kind:'virtual_form'},{id:'self-statement',title:'本人情况与服务意愿整理',status:values.needs?'generated':'pending',kind:'self_report'}];if(context.recordId||context.noticeId)materials.push({id:'service-reference',title:'已登记的主动服务线索',status:'included',kind:'own_service_record'});
  if(c.demoContext){materials.push({id:'demo-business-sheet',title:'武畔市服务需求登记样例（虚构演示）',status:'generated',kind:'demo_sample',sample:'虚构办理地区：汉东省武畔市；虚构受理机构：武畔市虚拟政务服务中心；事项：'+values.service.value+'；个人未知信息不填。'},{id:'demo-material-checklist',title:'武畔市材料清单样例（虚构演示）',status:'generated',kind:'demo_sample',sample:'演示材料：服务意愿登记样例、事项说明样例；不索取真实证件、户籍、收入证明或病历。'});}
  return{fields,missing,materials,demoContext:c.demoContext||null,fingerprint:crypto.createHash('sha256').update(JSON.stringify({fields,materials})).digest('hex')};
 }
 function prepare(r,c){if(c.residentId!==r.id)throw fail(404,'办理记录不存在');const values=collect(r,c);let a=data.applications.find(a=>a.id===c.applicationId&&a.residentId===r.id&&a.caseId===c.id);if(a&&a.fingerprint===values.fingerprint&&JSON.stringify(a.fields)===JSON.stringify(values.fields))return summary(a);
  if(!a||a.status==='submitted'){a={id:crypto.randomUUID(),residentId:r.id,caseId:c.id,revision:0,createdAt:now()};data.applications.push(a);c.applicationId=a.id}
  Object.assign(a,values,{revision:a.revision+1,status:values.missing.length?'draft':'ready',updatedAt:now()});c.applicationIntent=true;changed();return summary(a);
 }
 function submit(r,id,input,c,{busy=false}={}){const a=own(r,id);if(input.userConfirmed!==true)throw fail(400,'请由本人点击“确认并提交虚拟申报”');if(a.status==='submitted')return{application:summary(a),duplicate:true};if(busy)throw fail(409,'资料还在整理，请稍等后再确认');if(!c||c.id!==a.caseId||c.residentId!==r.id||c.applicationId!==a.id)throw fail(409,'当前申报草稿已变化，请重新查看');
  const latest=prepare(r,c);if(latest.id!==id||latest.revision!==input.revision)throw fail(409,'申报资料已更新，请核对最新内容后再提交');if(a.missing.length)throw fail(400,'还需了解：'+a.missing.map(f=>f.label).join('、'));if(Object.hasOwn(input,'fields')||Object.hasOwn(input,'materials'))throw fail(400,'提交时不能绕过聊天修改申报内容');
  const day=new Date(clock()+8*3600000).toISOString().slice(0,10).replaceAll('-',''),sequence=++data.virtualApplicationSequence;
  a.status='submitted';a.updatedAt=now();a.receipt={id:'XN'+day+String(sequence).padStart(6,'0'),applicationId:a.id,status:'received_virtual',virtual:true,receivingOffice:a.demoContext?demo.context.office:DEFINITION.receivingOffice,submittedAt:now(),message:'民策通虚拟受理台已接收本次虚拟申报。',notice:DEFINITION.notice};changed();return{application:summary(a),duplicate:false};
 }
 function mine(r){return data.applications.filter(a=>a.residentId===r.id).slice().reverse().map(a=>{refreshAge(a,r);return summary(a)})}
 function government(){return{virtual:true,receivingOffice:DEFINITION.receivingOffice,items:data.applications.filter(a=>a.status==='submitted').slice().reverse().map(a=>({id:a.id,receiptId:a.receipt.id,status:'received_virtual',virtual:true,service:DEFINITION.title,applicant:(a.fields.find(f=>f.id==='applicant')?.value||'居民').slice(0,1)+'**',submittedAt:a.receipt.submittedAt})),notice:'仅显示站内虚拟申报回执摘要，未向真实政府部门提交。'}}
 return{template:DEFINITION,prepare,submit,mine,government,forCase,own,summary};
};
module.exports.wantsApplication=wantsApplication;
