/* Server-side matching retained independently of the restored resident interface. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.MincetongMatching=factory()})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const patterns={mental:/抑郁|焦虑|心理(?:支持|帮助|咨询|治疗|困扰|健康)|精神卫生|情绪(?:困扰|低落)|失眠|睡眠(?:困难|障碍)/,employment:/就业|求职|找工作|再就业|失业|转岗|职业培训/,elder:/养老|老年|助餐|照护|银发|退休/,education:/教育|学生|学校|教培|助学|家长|小学|入学|学籍|课后服务/,general:/救助|低保|困难|生活支持|医疗费用|看病费用/,accessibility:/无障碍|残疾|适老/,legal:/法律援助|律师|维权|诉讼/,childcare:/生育|育儿|托育|婴幼儿/,housing:/住房|租房|公租房|保租房/,health:/医保|参保|医疗保障/,pension:/养老金|养老保险|退休储备/,entrepreneurship:/创业|个体经营|开店/,rural:/乡村|农村|农业|种植|农户/};
 function positive(text,pattern){return String(text||'').split(/[，,。；;！!?？\n]|但是|不过|但/).some(s=>!/(没有|并非|不是|不需要|不想|不再|无需|无须|未患|否认|不求职|不找工作|未诊断|不患|无抑郁|无焦虑|不抑郁|不焦虑|已康复|已找到工作)/.test(s)&&!/(朋友|同事|邻居|父亲|母亲|爸爸|妈妈|家人|丈夫|妻子|女儿|儿子|案例|研究|论文|工作内容)/.test(s)&&pattern.test(s))}
 const topicMatch=(c,q)=>!!patterns[c]&&positive(q,patterns[c]);
 function interestMatch(d,q){if(d.tags?.includes('primary-school')&&!positive(q,/小学|义务教育|入学|学籍|课后服务|学生资助/))return false;if(!topicMatch(category(d),q))return false;if(d.key==='training-regulation')return positive(q,/校外培训|教培|培训机构|培训监管/);if(d.key==='family-education')return positive(q,/家庭教育|家长|育儿|未成年人/);return true}
 function extractSupport(text){return{needMental:positive(text,patterns.mental),needJob:positive(text,/求职|找工作|待业|失业|再就业|希望.*(?:就业|技能)/)}}
 function category(d){return d.category||(/^mental-|^depression-/.test(d.key)?'mental':d.key==='legal-aid'?'legal':d.key==='accessible-environment'?'accessibility':d.domain)}
 function profileScore(r,d){const f=r.facts||{},j=r.job||'',c=category(d),reasons=[];let score=0;
  // Pioneer topics express willingness to discuss drafts, not current service needs.
  if(c==='mental'&&(f.needMental===true||r.topics?.includes('心理支持'))){score=12;reasons.push('你主动选择了心理支持服务')}
  if(c==='elder'&&(/退休/.test(j)||Number(r.age)>=60&&r.age!==null||f.senior==='yes'||f.needCare)){score=8;reasons.push(f.needCare?'你希望了解助餐或照护服务':'已填写的年龄或家庭资料与养老服务相关')}
  if(c==='employment'&&(f.needJob===true||/求职|灵活就业|待业|失业/.test(j)&&!/退休|不求职|不找工作/.test(j))&&(!/youth-employment-2026/.test(d.key)||/毕业|应届|青年/.test(j))){score=8;reasons.push('你明确表达了求职或就业服务需求')}
  if(c==='education'){
   const relevant=d.tags?.includes('primary-school')?/小学.*家长|家长.*小学/.test(j):d.key==='training-regulation'?/教培|培训机构|校外培训/.test(j):d.key==='family-education'?/家长/.test(j)||(f.student==='yes'&&!/在校学生|大学生|学生$/.test(j)):(f.needStudy||f.student==='yes');
   if(relevant){score=6;reasons.push(d.key==='training-regulation'?'你填写的校外培训从业身份与监管规则相关':'已填写的家庭在读成员或教育服务需求与文件相关')}
  }
  if(c==='general'&&f.needLife){score=8;reasons.push('你希望了解生活或费用支持')}
  if(c==='accessibility'&&(f.disability==='yes'||f.needAccess)){score=8;reasons.push('你主动填写了无障碍服务需求')}
  if(c==='legal'&&f.needLegal){score=8;reasons.push('你希望了解法律援助')}
  for(const [type,flag,reason] of [['childcare','needChildcare','你自愿选择了生育或托育服务'],['housing','needHousing','你自愿选择了住房或租赁服务'],['health','needHealth','你自愿选择了医保参保服务'],['pension','needPension','你自愿选择了个人养老金信息'],['entrepreneurship','needBusiness','你自愿选择了创业服务'],['rural','needRural','你自愿选择了农业农村服务']])if(c===type&&f[flag]===true){score=9;reasons.push(reason)}
  return{score,reasons:score?reasons:[]};
 }
 return{positive,extractSupport,topicMatch,interestMatch,category,profileScore};
});
