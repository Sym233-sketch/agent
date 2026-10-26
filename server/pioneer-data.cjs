'use strict';
const crypto=require('crypto');
const BATCH='synthetic-pioneers-v1';
function generate(count=3000,seed=20261026){
 let s=seed>>>0;const rand=()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296),pick=a=>a[Math.floor(rand()*a.length)];
 const surnames=[...'熊林陈李王张刘赵周吴郑徐孙马朱胡郭何高罗'],jobs=['教培机构教师','教培机构负责人','在校学生','学生家长','退休人员','社区工作者','求职人员','灵活就业人员','企业职工','个体经营者','护理人员','全职照护者'];
 return Array.from({length:count},(_,i)=>{
  const job=i===0?'教培机构教师':pick(jobs),age=job==='退休人员'?60+Math.floor(rand()*26):job==='在校学生'?18+Math.floor(rand()*8):22+Math.floor(rand()*38),marital=i===0?'丧偶':pick(['未婚','已婚','已婚','离异','丧偶','未提供']),mental=i===0?'自述有心理困扰，希望了解支持服务':pick(['未表达相关需求','未表达相关需求','自述近期压力较大','自述有心理困扰，希望了解支持服务','暂不愿说明']);
  const needStudy=/学生|教培/.test(job)||rand()<.15,needCare=age>=60||rand()<.18,needJob=/求职|灵活/.test(job)||rand()<.15,needLife=rand()<.24;
  return{id:crypto.createHash('sha256').update(BATCH+':'+i).digest('hex').slice(0,8)+'-0000-4000-8000-'+String(i+1).padStart(12,'0'),token:crypto.randomBytes(24).toString('hex'),displayName:(i===0?'熊女士':pick(surnames)+pick(['女士','先生']))+'（虚构'+String(i+1).padStart(4,'0')+'）',job,district:'全国测试样本（地区待确认）',joined:true,proactive:true,llmBackground:false,llmBackgroundProvider:null,synthetic:true,datasetBatch:BATCH,createdAt:new Date().toISOString(),topics:[...(needStudy?['教育服务']:[]),...(needCare?['养老照护']:[]),...(needJob?['就业服务']:[]),...(needLife?['生活支持']:[]),...(/困扰|压力/.test(mental)?['心理支持']:[])],facts:{student:job==='在校学生'?'yes':'unknown',senior:age>=60?'yes':'no',disability:pick(['unknown','unknown','no','yes']),needStudy,needCare,needJob,needLife,needAccess:rand()<.08},background:{age,maritalStatus:marital,psychologicalSupport:mental,diagnosis:'未作临床诊断',incomeBand:pick(['未提供','2000元以下（模拟）','2000—5000元（模拟）','5000—10000元（模拟）','10000元以上（模拟）']),household:pick(['独居','与配偶同住','与子女同住','与父母同住','未提供']),source:'随机合成测试数据，不对应真实个人',consent:'仅模拟先行者加入及主动消息授权，未授权后台模型调用'}};
 });
}
function seed(db){db.residents||=[];const existing=new Set(db.residents.map(r=>r.id));let added=0;for(const r of generate())if(!existing.has(r.id)){db.residents.push(r);added++}return added}
function matchProfile(r){return{displayName:r.displayName,district:r.district,job:r.job,facts:r.facts,topics:r.topics,proactive:r.proactive,joined:r.joined,synthetic:r.synthetic===true,...(r.synthetic?{background:r.background}:{})}}
function rank(r,text='',domain='general'){
 const reasons=[],hits=[],terms=[['education',/教育|培训|学生|学校|教培/,/教师|学生|家长|教培/.test(r.job)||r.facts?.needStudy,'教育参与者或从业者'],['elder',/养老|老年|助餐|照护/,r.facts?.senior==='yes'||r.facts?.needCare,'养老或照护服务需求'],['employment',/就业|求职|转岗|技能|失业/,r.facts?.needJob,'就业或技能服务需求'],['general',/救助|生活|支出|困难/,r.facts?.needLife,'已表达生活支持需求'],['mental',/心理|精神卫生|心理健康/,r.topics?.includes('心理支持'),'已表达心理支持需求']];
 for(const [d,re,ok,reason]of terms)if(ok&&(re.test(text)||(d!=='general'&&d===domain))){reasons.push(reason);hits.push(text.match(re)?.[0]||'')}
 return{score:reasons.length,reason:reasons.join('；')+(r.synthetic?'；虚构测试档案':''),quote:hits.find(Boolean)||''};
}
module.exports={BATCH,generate,seed,matchProfile,rank};
